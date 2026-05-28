import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { stripePrices, tenants } from "@/db/schema";
import {
  STRIPE_SAAS_PAID_PLAN_KEYS,
  type StripeSaasPaidPlanKey,
} from "@/lib/stripe/plan-metadata";
import { pickRepresentativePrice } from "@/modules/core/platform-admin/subscriptions/utils/pick-representative-price";
import { requirePlatformUser } from "@/modules/core/platform-admin/services/platform-users";

// ---------------------------------------------------------------------------
// Platform-admin MRR/ARR computation.
//
// The local tenant row only stores `subscriptionPlan` (the plan key, e.g.
// "starter"), not the specific Stripe price id the tenant is subscribed
// to. So we approximate revenue by picking a representative *active*
// price for each plan from the cached Stripe catalog and multiplying it
// by the count of active paying tenants on that plan.
//
// Approximation surfaces with a warning when:
//   - a plan has tenants but no active price in the catalog
//   - multiple currencies are in play (we report the dominant one)
//   - a plan has only an annual price (we divide by 12 for MRR)
//
// `comped` and `trialing` tenants are excluded — they're "active" in the
// product sense but not contributing revenue this month.
// ---------------------------------------------------------------------------

export type PlanRevenueBreakdown = {
  plan: StripeSaasPaidPlanKey;
  activeCount: number;
  monthlyUnitAmountCents: number | null;
  monthlyRevenueCents: number;
  /** stripePriceId used as the basis for the contribution, if any. */
  basisPriceId: string | null;
  basisInterval: "month" | "year" | null;
  currency: string | null;
};

export type PlatformSubscriptionRevenue = {
  monthlyRecurringRevenueCents: number;
  annualRecurringRevenueCents: number;
  currency: string;
  byPlan: PlanRevenueBreakdown[];
  warnings: string[];
};

export async function computePlatformAdminSubscriptionRevenue(): Promise<PlatformSubscriptionRevenue> {
  await requirePlatformUser();

  // Active paid tenants grouped by plan. Excludes trialing + comped to
  // avoid inflating MRR with non-paying accounts.
  const planCountRows = await db
    .select({
      plan: tenants.subscriptionPlan,
      count: sql<number>`count(*)::int`,
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.subscriptionStatus, "active"),
        eq(tenants.isActive, true),
      ),
    )
    .groupBy(tenants.subscriptionPlan);

  const activeCountsByPlan = new Map<string, number>();
  for (const row of planCountRows) {
    activeCountsByPlan.set(row.plan, row.count);
  }

  const catalog = await db
    .select({
      stripePriceId: stripePrices.stripePriceId,
      billingPlanKey: stripePrices.billingPlanKey,
      currency: stripePrices.currency,
      unitAmount: stripePrices.unitAmount,
      recurringInterval: stripePrices.recurringInterval,
      recurringIntervalCount: stripePrices.recurringIntervalCount,
      active: stripePrices.active,
    })
    .from(stripePrices);

  const warnings: string[] = [];
  const byPlan: PlanRevenueBreakdown[] = [];

  for (const plan of STRIPE_SAAS_PAID_PLAN_KEYS) {
    const activeCount = activeCountsByPlan.get(plan) ?? 0;
    const basis = pickRepresentativePrice(catalog, plan);

    if (activeCount > 0 && !basis) {
      warnings.push(
        `Plan "${plan}" has ${activeCount} active tenant${
          activeCount === 1 ? "" : "s"
        } but no active Stripe price — revenue contribution treated as $0.`,
      );
    }

    const monthlyUnitAmountCents = basis?.monthlyUnitAmountCents ?? null;
    const monthlyRevenueCents =
      monthlyUnitAmountCents != null ? monthlyUnitAmountCents * activeCount : 0;

    byPlan.push({
      plan,
      activeCount,
      monthlyUnitAmountCents,
      monthlyRevenueCents,
      basisPriceId: basis?.stripePriceId ?? null,
      basisInterval: basis?.basisInterval ?? null,
      currency: basis?.currency ?? null,
    });
  }

  // Currency reconciliation. If multiple currencies appear, surface the
  // dominant one (most active tenants on that currency) and warn.
  const currencyTotals = new Map<string, number>();
  for (const p of byPlan) {
    if (!p.currency || p.activeCount === 0) continue;
    currencyTotals.set(
      p.currency,
      (currencyTotals.get(p.currency) ?? 0) + p.activeCount,
    );
  }
  let dominantCurrency = "usd";
  let dominantCount = 0;
  for (const [currency, count] of currencyTotals) {
    if (count > dominantCount) {
      dominantCurrency = currency;
      dominantCount = count;
    }
  }
  if (currencyTotals.size > 1) {
    const listed = Array.from(currencyTotals.keys())
      .map(c => c.toUpperCase())
      .join(", ");
    warnings.push(
      `Multiple price currencies in use (${listed}). Revenue is summed naively in ${dominantCurrency.toUpperCase()}; mixed-currency MRR is approximate.`,
    );
  }

  const annualBasisWarnings = byPlan
    .filter(p => p.basisInterval === "year" && p.activeCount > 0)
    .map(
      p =>
        `Plan "${p.plan}" uses an annual-only price; MRR derived as annual ÷ 12.`,
    );
  warnings.push(...annualBasisWarnings);

  const monthlyRecurringRevenueCents = byPlan.reduce(
    (sum, p) => sum + p.monthlyRevenueCents,
    0,
  );

  return {
    monthlyRecurringRevenueCents,
    annualRecurringRevenueCents: monthlyRecurringRevenueCents * 12,
    currency: dominantCurrency,
    byPlan,
    warnings,
  };
}
