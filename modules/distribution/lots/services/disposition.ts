"use server";

import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  dispositionDecisions,
  lots,
  markdownHistories,
} from "@/db/schema";
import { captureServerEvent } from "@/lib/posthog-server";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import type { DispositionConfig, MarkdownConfig, DonateConfig } from "./disposition-analytics";

export async function getPriorMarkdownStats(
  tenantId: string,
  productCategory: string,
): Promise<{ count: number; avgSellThrough: number }> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const rows = await db
    .select({
      count: count(),
      avgSellThrough: sql<number>`avg(${markdownHistories.actualSellThroughPct})`,
    })
    .from(markdownHistories)
    .where(
      and(
        eq(markdownHistories.tenantId, tenantId),
        eq(markdownHistories.productCategory, productCategory),
        gte(markdownHistories.completedAt, ninetyDaysAgo),
      ),
    );

  return {
    count: rows[0]?.count ?? 0,
    avgSellThrough: Number(rows[0]?.avgSellThrough ?? 0) / 100,
  };
}

export async function getDispositionDecisionsForLot(lotId: string) {
  const tenant = await getCurrentTenant();
  return db.query.dispositionDecisions.findMany({
    where: and(
      eq(dispositionDecisions.tenantId, tenant.id),
      eq(dispositionDecisions.lotId, lotId),
    ),
    with: { decidedBy: { columns: { id: true, fullName: true } } },
    orderBy: [desc(dispositionDecisions.createdAt)],
  });
}

export async function createDispositionDecision(input: {
  lotId: string;
  option: "markdown" | "outreach" | "donate" | "repurpose" | "discard";
  expectedNet?: number;
  config: DispositionConfig;
}) {
  const tenant = await getCurrentTenant();
  const user = await getCurrentPortalUser();

  const [row] = await db
    .insert(dispositionDecisions)
    .values({
      tenantId: tenant.id,
      lotId: input.lotId,
      decidedByUserId: user.id,
      option: input.option,
      status: "draft",
      expectedNet: input.expectedNet?.toFixed(2),
      config: input.config,
    })
    .returning();

  return row;
}

export async function applyMarkdownDecision(input: {
  decisionId: string;
  lotId: string;
  config: MarkdownConfig;
  expectedNet: number;
}) {
  const [tenant, user] = await Promise.all([
    getCurrentTenant(),
    getCurrentPortalUser(),
  ]);

  await db.transaction(async tx => {
    await tx
      .update(lots)
      .set({ state: "marked_down" })
      .where(and(eq(lots.id, input.lotId), eq(lots.tenantId, tenant.id)));

    await tx
      .update(dispositionDecisions)
      .set({ status: "applied", appliedAt: new Date(), config: input.config })
      .where(
        and(
          eq(dispositionDecisions.id, input.decisionId),
          eq(dispositionDecisions.tenantId, tenant.id),
        ),
      );
  });

  await captureServerEvent({
    userId: user.id,
    tenantId: tenant.id,
    event: "markdown.applied",
    properties: {
      discount_percent: input.config.discountPercent,
      channel_count: input.config.channels.length,
    },
  });
}

export async function applyDonateDecision(input: {
  decisionId: string;
  lotId: string;
  config: DonateConfig;
}) {
  const tenant = await getCurrentTenant();

  await db.transaction(async tx => {
    await tx
      .update(lots)
      .set({ state: "donated" })
      .where(and(eq(lots.id, input.lotId), eq(lots.tenantId, tenant.id)));

    await tx
      .update(dispositionDecisions)
      .set({ status: "applied", appliedAt: new Date(), config: input.config })
      .where(
        and(
          eq(dispositionDecisions.id, input.decisionId),
          eq(dispositionDecisions.tenantId, tenant.id),
        ),
      );
  });
}

export async function recordMarkdownOutcome(input: {
  lotId: string;
  dispositionDecisionId: string;
  productCategory: string;
  discountPercent: number;
  quantityOfferedLbs: number;
  actualSellThroughPct: number;
  expectedNet: number;
  actualNet: number;
}) {
  const tenant = await getCurrentTenant();

  const now = new Date();

  await db.transaction(async tx => {
    await tx.insert(markdownHistories).values({
      tenantId: tenant.id,
      lotId: input.lotId,
      dispositionDecisionId: input.dispositionDecisionId,
      productCategory: input.productCategory,
      discountPercent: input.discountPercent.toFixed(2),
      quantityOfferedLbs: input.quantityOfferedLbs.toFixed(4),
      actualSellThroughPct: input.actualSellThroughPct.toFixed(2),
      expectedNet: input.expectedNet.toFixed(2),
      actualNet: input.actualNet.toFixed(2),
      completedAt: now,
    });

    await tx
      .update(dispositionDecisions)
      .set({
        status: "completed",
        completedAt: now,
        actualNet: input.actualNet.toFixed(2),
      })
      .where(eq(dispositionDecisions.id, input.dispositionDecisionId));

    await tx
      .update(lots)
      .set({ state: "active" })
      .where(eq(lots.id, input.lotId));
  });
}

export type DispositionDecision = Awaited<
  ReturnType<typeof getDispositionDecisionsForLot>
>[number];
