import { and, count, eq, gte, inArray, isNull, lt, sum } from "drizzle-orm";

import { db } from "@/db";
import {
  aiUsageEvents,
  customers,
  portalUsers,
  products,
  salesOrders,
  tenants,
  userInvitations,
} from "@/db/schema";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";

export type TenantPlanUsage = {
  currentPlan: TenantSubscriptionPlan;
  portalUsers: {
    current: number;
    limit: number;
  };
  products: {
    current: number;
    limit: number;
  };
  customers: {
    current: number;
    limit: number;
  };
  monthlyOrders: {
    current: number;
    limit: number;
  };
  /**
   * Month-to-date AI spend (#235) — sum of `ai_usage_events.cost_micros`
   * for the current calendar month plus the configured ceiling. Both
   * numbers are micro-USD so the dashboard can format with consistent
   * precision; the plan-and-usage card divides by 1e6 for display.
   */
  aiSpend: {
    currentMicros: number;
    limitMicros: number;
  };
};

export function getCurrentServerMonthRange(): {
  monthStart: Date;
  nextMonthStart: Date;
} {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

  return { monthStart, nextMonthStart };
}

export async function countPortalUserUsageForTenant(
  tenantId: string,
): Promise<number> {
  const [activePortalUsers, pendingInvitations] = await Promise.all([
    db
      .select({ c: count() })
      .from(portalUsers)
      .where(
        and(
          eq(portalUsers.tenantId, tenantId),
          eq(portalUsers.isActive, true),
        ),
      )
      .then(rows => rows[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.tenantId, tenantId),
          eq(userInvitations.status, "pending"),
        ),
      )
      .then(rows => rows[0]?.c ?? 0),
  ]);

  return activePortalUsers + pendingInvitations;
}

export async function countActiveProductsForTenant(
  tenantId: string,
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), isNull(products.archivedAt)));

  return row?.c ?? 0;
}

export async function countActiveCustomersForTenant(
  tenantId: string,
): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), isNull(customers.archivedAt)));

  return row?.c ?? 0;
}

// Statuses that consume a monthly-orders quota slot. Draft (`sales_order`)
// and `cancelled` orders are explicitly excluded — drafts because the
// autosave path creates them on every keystroke session, and cancelled
// because they don't represent fulfilled work. Quota is consumed at the
// confirm transition (`updateSalesOrderStatus`) and on direct-confirm
// creates (`createSalesOrder` with status: "confirmed").
const QUOTA_COUNTING_ORDER_STATUSES = ["confirmed", "fulfilled"] as const;

export async function countCurrentMonthSalesOrdersForTenant(
  tenantId: string,
): Promise<number> {
  const { monthStart, nextMonthStart } = getCurrentServerMonthRange();

  const [row] = await db
    .select({ c: count() })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.tenantId, tenantId),
        gte(salesOrders.createdAt, monthStart),
        lt(salesOrders.createdAt, nextMonthStart),
        inArray(salesOrders.status, [...QUOTA_COUNTING_ORDER_STATUSES]),
      ),
    );

  return row?.c ?? 0;
}

/**
 * Sum month-to-date AI spend (#235) across every writer that records into
 * `ai_usage_events`: bill text + vision extraction, expense-receipt
 * vision, product-match calls. Returns micro-USD so the comparison
 * against `maxMonthlyAiCostMicros` is a direct integer compare with no
 * float rounding. Includes failed-call rows because the OpenAI bill
 * doesn't care whether the response parsed cleanly.
 */
export async function getCurrentMonthAiSpendForTenant(
  tenantId: string,
): Promise<number> {
  const { monthStart, nextMonthStart } = getCurrentServerMonthRange();
  const [row] = await db
    .select({ total: sum(aiUsageEvents.costMicros) })
    .from(aiUsageEvents)
    .where(
      and(
        eq(aiUsageEvents.tenantId, tenantId),
        gte(aiUsageEvents.createdAt, monthStart),
        lt(aiUsageEvents.createdAt, nextMonthStart),
      ),
    );
  // drizzle's sum() returns a string (Postgres NUMERIC) which is `null`
  // when there are zero matching rows.
  const total = row?.total ?? null;
  if (total == null) return 0;
  const parsed = Number(total);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function getCurrentTenantPlanUsage(): Promise<TenantPlanUsage> {
  const tenant = await getCurrentTenant();
  const usage = await getTenantPlanUsageByTenantId(tenant.id);

  if (!usage) {
    throw new Error("Current tenant usage could not be resolved.");
  }

  return usage;
}

export async function getTenantPlanUsageByTenantId(
  tenantId: string,
): Promise<TenantPlanUsage | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: {
      id: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
    },
  });

  if (!tenant) {
    return null;
  }

  const [
    portalUserUsage,
    activeProducts,
    activeCustomers,
    monthlyOrders,
    aiSpendMicros,
  ] = await Promise.all([
    countPortalUserUsageForTenant(tenantId),
    countActiveProductsForTenant(tenantId),
    countActiveCustomersForTenant(tenantId),
    countCurrentMonthSalesOrdersForTenant(tenantId),
    getCurrentMonthAiSpendForTenant(tenantId),
  ]);

  return {
    currentPlan: tenant.subscriptionPlan,
    portalUsers: {
      current: portalUserUsage,
      limit: getPlanLimit(tenant, "maxPortalUsers"),
    },
    products: {
      current: activeProducts,
      limit: getPlanLimit(tenant, "maxProducts"),
    },
    customers: {
      current: activeCustomers,
      limit: getPlanLimit(tenant, "maxCustomers"),
    },
    monthlyOrders: {
      current: monthlyOrders,
      limit: getPlanLimit(tenant, "maxMonthlyOrders"),
    },
    aiSpend: {
      currentMicros: aiSpendMicros,
      limitMicros: getPlanLimit(tenant, "maxMonthlyAiCostMicros"),
    },
  };
}
