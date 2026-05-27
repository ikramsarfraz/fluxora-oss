import "server-only";

import { isPlatformAdminAuthUser } from "@/lib/platform-admin";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import { captureServerEvent } from "@/lib/posthog-server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

import { AiSpendCapError, decideAiSpendStatus } from "./ai-spend-cap";
import { getCurrentMonthAiSpendForTenant } from "./subscription-usage";

/**
 * Action-layer gate (#235). Sums this tenant's MTD AI spend, compares
 * against the plan's `maxMonthlyAiCostMicros`, and either:
 *
 *   - `ok`        — returns, action proceeds.
 *   - `warn`      — returns; emits a PostHog `ai_spend_cap.warn` event so
 *                   the operator can see the drift in dashboards. Action
 *                   still proceeds — we don't want to nag users at 80%.
 *   - `blocked`   — throws `AiSpendCapError`, action layer surfaces a
 *                   user-friendly toast. The bytes never reach OpenAI.
 *
 * Platform admins bypass entirely so internal QA + support runs never
 * hit a cap. The same bypass rule the rate-limit gate uses.
 */
export async function enforceAiSpendCap(args: {
  tenantId: string;
  authUserId: string;
  /**
   * Where the gate fired from — purely for PostHog properties so we can
   * separate "supplier invoice upload hit the cap" from "expense receipt
   * upload hit the cap". The string is opaque to the helper.
   */
  source:
    | "supplier_invoice.parse"
    | "supplier_invoice.bulk_parse"
    | "expense_receipt.parse";
}): Promise<void> {
  if (await isPlatformAdminAuthUser(args.authUserId)) return;

  const tenantRow = await db.query.tenants.findFirst({
    where: eq(tenants.id, args.tenantId),
    columns: { subscriptionPlan: true, subscriptionStatus: true },
  });
  // A missing tenant row would already have failed earlier in the call
  // chain; defensive null here just means "no enforceable limit", which
  // is the safe direction.
  if (!tenantRow) return;

  const limitMicros = getPlanLimit(tenantRow, "maxMonthlyAiCostMicros");
  // Cheap short-circuit for the enterprise / comped path — no DB read
  // needed when the plan has no cap. `Number.isFinite` covers UNLIMITED
  // (POSITIVE_INFINITY) and any future sentinel.
  if (!Number.isFinite(limitMicros) || limitMicros <= 0) return;

  const usedMicros = await getCurrentMonthAiSpendForTenant(args.tenantId);
  const decision = decideAiSpendStatus({ usedMicros, limitMicros });

  if (decision.status === "warn") {
    // Best-effort telemetry; never block on this. The dashboard panel
    // shows the warn band visually, so this event mainly drives
    // alerting if we want to email the operator at the soft threshold.
    await captureServerEvent({
      tenantId: args.tenantId,
      event: "ai_spend_cap.warn",
      properties: {
        source: args.source,
        ratio: decision.ratio,
        used_micros: decision.usedMicros,
        limit_micros: decision.limitMicros,
      },
    });
    return;
  }

  if (decision.status === "blocked") {
    await captureServerEvent({
      tenantId: args.tenantId,
      event: "ai_spend_cap.blocked",
      properties: {
        source: args.source,
        ratio: decision.ratio,
        used_micros: decision.usedMicros,
        limit_micros: decision.limitMicros,
      },
    });
    throw new AiSpendCapError(decision);
  }
}
