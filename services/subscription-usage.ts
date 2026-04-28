import { and, count, eq, gte, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import {
  customers,
  portalUsers,
  products,
  salesOrders,
  userInvitations,
} from "@/db/schema";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import type { TenantSubscriptionPlan } from "@/lib/tenant-subscription";
import { getCurrentTenant } from "@/services/tenants";

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

export async function getCurrentTenantPlanUsage(): Promise<TenantPlanUsage> {
  const tenant = await getCurrentTenant();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

  const [activePortalUsers, pendingInvitations, activeProducts, activeCustomers, monthlyOrders] =
    await Promise.all([
      db
        .select({ c: count() })
        .from(portalUsers)
        .where(
          and(
            eq(portalUsers.tenantId, tenant.id),
            eq(portalUsers.isActive, true),
          ),
        )
        .then(rows => rows[0]?.c ?? 0),
      db
        .select({ c: count() })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.tenantId, tenant.id),
            eq(userInvitations.status, "pending"),
          ),
        )
        .then(rows => rows[0]?.c ?? 0),
      db
        .select({ c: count() })
        .from(products)
        .where(and(eq(products.tenantId, tenant.id), isNull(products.archivedAt)))
        .then(rows => rows[0]?.c ?? 0),
      db
        .select({ c: count() })
        .from(customers)
        .where(and(eq(customers.tenantId, tenant.id), isNull(customers.archivedAt)))
        .then(rows => rows[0]?.c ?? 0),
      db
        .select({ c: count() })
        .from(salesOrders)
        .where(
          and(
            eq(salesOrders.tenantId, tenant.id),
            gte(salesOrders.createdAt, monthStart),
            lt(salesOrders.createdAt, nextMonthStart),
          ),
        )
        .then(rows => rows[0]?.c ?? 0),
    ]);

  return {
    currentPlan: tenant.subscriptionPlan,
    portalUsers: {
      current: activePortalUsers + pendingInvitations,
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
