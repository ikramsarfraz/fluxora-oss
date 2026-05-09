import { and, count, eq, gte, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import {
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
      ),
    );

  return row?.c ?? 0;
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

  const [portalUserUsage, activeProducts, activeCustomers, monthlyOrders] =
    await Promise.all([
      countPortalUserUsageForTenant(tenantId),
      countActiveProductsForTenant(tenantId),
      countActiveCustomersForTenant(tenantId),
      countCurrentMonthSalesOrdersForTenant(tenantId),
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
  };
}
