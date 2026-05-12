"use server";

import { and, count, eq, gte, lt, min, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  inventoryItems,
  lots,
  markdownHistories,
  supplierInvoices,
  supplierInvoiceLines,
} from "@/db/schema";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

// ── Flag definitions ──────────────────────────────────────────────────────

export type DataReadinessFlag =
  | "auto_matching_ready"
  | "reliability_scores_ready"
  | "price_drift_alerts_ready"
  | "variance_baselines_ready"
  | "markdown_predictions_ready"
  | "seasonality_aware"
  | "multi_supplier_comparison";

export type DataReadinessContext = {
  supplierId?: string;
  productId?: string;
  category?: string;
  skuId?: string;
};

export type DataReadinessResult = {
  ready: boolean;
  current: number;
  needed: number;
  unlockLabel: string;
};

// ── Per-flag computations ─────────────────────────────────────────────────

async function checkAutoMatchingReady(
  tenantId: string,
  ctx: DataReadinessContext,
): Promise<DataReadinessResult> {
  if (!ctx.supplierId) {
    return { ready: false, current: 0, needed: 5, unlockLabel: "invoices from this supplier" };
  }
  const [row] = await db
    .select({ n: count() })
    .from(supplierInvoices)
    .where(
      and(
        eq(supplierInvoices.tenantId, tenantId),
        eq(supplierInvoices.supplierId, ctx.supplierId),
      ),
    );
  const current = row?.n ?? 0;
  return {
    ready: current >= 5,
    current,
    needed: 5,
    unlockLabel: "invoices from this supplier for auto-matching",
  };
}

async function checkReliabilityScoresReady(
  tenantId: string,
  ctx: DataReadinessContext,
): Promise<DataReadinessResult> {
  if (!ctx.supplierId) {
    return { ready: false, current: 0, needed: 5, unlockLabel: "invoices from this supplier" };
  }
  const [row] = await db
    .select({ n: count() })
    .from(supplierInvoices)
    .where(
      and(
        eq(supplierInvoices.tenantId, tenantId),
        eq(supplierInvoices.supplierId, ctx.supplierId),
      ),
    );
  const current = row?.n ?? 0;
  return {
    ready: current >= 5,
    current,
    needed: 5,
    unlockLabel: "invoices from this supplier for reliability score",
  };
}

async function checkPriceDriftAlertsReady(
  tenantId: string,
): Promise<DataReadinessResult> {
  const [row] = await db
    .select({ oldest: min(supplierInvoices.invoiceDate) })
    .from(supplierInvoices)
    .where(eq(supplierInvoices.tenantId, tenantId));

  const oldestDate = row?.oldest ? new Date(row.oldest) : null;
  const now = new Date();
  const daysSinceOldest = oldestDate
    ? Math.floor((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    ready: daysSinceOldest >= 30,
    current: daysSinceOldest,
    needed: 30,
    unlockLabel: "days of invoice history for price drift alerts",
  };
}

async function checkVarianceBaselinesReady(
  tenantId: string,
  ctx: DataReadinessContext,
): Promise<DataReadinessResult> {
  if (!ctx.productId) {
    return { ready: false, current: 0, needed: 5, unlockLabel: "lot receipts for this SKU" };
  }
  const [row] = await db
    .select({ n: count() })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.productId, ctx.productId),
      ),
    );
  const current = row?.n ?? 0;
  return {
    ready: current >= 5,
    current,
    needed: 5,
    unlockLabel: "lot receipts for this SKU to establish weight baseline",
  };
}

async function checkMarkdownPredictionsReady(
  tenantId: string,
  ctx: DataReadinessContext,
): Promise<DataReadinessResult> {
  const category = ctx.category ?? "all";
  const whereClause =
    category !== "all"
      ? and(
          eq(markdownHistories.tenantId, tenantId),
          eq(markdownHistories.productCategory, category),
        )
      : eq(markdownHistories.tenantId, tenantId);

  const [row] = await db
    .select({ n: count() })
    .from(markdownHistories)
    .where(whereClause);

  const current = row?.n ?? 0;
  return {
    ready: current >= 3,
    current,
    needed: 3,
    unlockLabel: `markdowns of this category to enable prediction`,
  };
}

async function checkSeasonalityAware(
  tenantId: string,
): Promise<DataReadinessResult> {
  const [row] = await db
    .select({ oldest: min(supplierInvoices.invoiceDate) })
    .from(supplierInvoices)
    .where(eq(supplierInvoices.tenantId, tenantId));

  const oldestDate = row?.oldest ? new Date(row.oldest) : null;
  const now = new Date();
  const daysSinceOldest = oldestDate
    ? Math.floor((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    ready: daysSinceOldest >= 90,
    current: daysSinceOldest,
    needed: 90,
    unlockLabel: "days of history for seasonality-aware pricing",
  };
}

async function checkMultiSupplierComparison(
  tenantId: string,
  ctx: DataReadinessContext,
): Promise<DataReadinessResult> {
  if (!ctx.productId) {
    return { ready: false, current: 0, needed: 2, unlockLabel: "suppliers for this SKU" };
  }
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${supplierInvoices.supplierId})` })
    .from(supplierInvoiceLines)
    .innerJoin(supplierInvoices, eq(supplierInvoiceLines.supplierInvoiceId, supplierInvoices.id))
    .where(
      and(
        eq(supplierInvoices.tenantId, tenantId),
        eq(supplierInvoiceLines.productId, ctx.productId),
      ),
    );

  const current = row?.n ?? 0;
  return {
    ready: current >= 2,
    current,
    needed: 2,
    unlockLabel: "suppliers for this SKU to enable comparison",
  };
}

// ── Public API ────────────────────────────────────────────────────────────

export async function checkDataReadiness(
  flag: DataReadinessFlag,
  context: DataReadinessContext = {},
): Promise<DataReadinessResult> {
  const tenant = await getCurrentTenant();
  const tenantId = tenant.id;

  switch (flag) {
    case "auto_matching_ready":
      return checkAutoMatchingReady(tenantId, context);
    case "reliability_scores_ready":
      return checkReliabilityScoresReady(tenantId, context);
    case "price_drift_alerts_ready":
      return checkPriceDriftAlertsReady(tenantId);
    case "variance_baselines_ready":
      return checkVarianceBaselinesReady(tenantId, context);
    case "markdown_predictions_ready":
      return checkMarkdownPredictionsReady(tenantId, context);
    case "seasonality_aware":
      return checkSeasonalityAware(tenantId);
    case "multi_supplier_comparison":
      return checkMultiSupplierComparison(tenantId, context);
    default:
      return { ready: false, current: 0, needed: 1, unlockLabel: "unknown flag" };
  }
}

export async function checkAllDataReadiness(
  flags: DataReadinessFlag[],
  context: DataReadinessContext = {},
): Promise<Record<DataReadinessFlag, DataReadinessResult>> {
  const results = await Promise.all(
    flags.map(async flag => [flag, await checkDataReadiness(flag, context)] as const),
  );
  return Object.fromEntries(results) as Record<DataReadinessFlag, DataReadinessResult>;
}
