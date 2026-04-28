import { and, desc, eq, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, portalUsers, platformUsers, tenants } from "@/db/schema";
import type { TenantSubscriptionPlan, TenantSubscriptionStatus } from "@/lib/tenant-subscription";
import {
  diffSubscriptionKeys,
  subscriptionSnapshotFromRow,
} from "@/lib/tenant-subscription-audit";
import { getTenantPlanUsageByTenantId } from "@/services/subscription-usage";
import { requirePlatformUser } from "./platform-users";

function countAll(table: typeof tenants | typeof portalUsers) {
  return db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(table);
}

async function countTenantsWhere(condition: SQL) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(tenants)
    .where(condition);
  return row?.count ?? 0;
}

export async function getPlatformAdminDashboardData() {
  await requirePlatformUser();

  const [tenantCountRow, activeTenantCountRow, portalUserCountRow] = await Promise.all([
    countAll(tenants),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(tenants)
      .where(eq(tenants.isActive, true))
      .then(rows => rows[0]),
    countAll(portalUsers).then(rows => rows[0]),
  ]);

  const recentTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      tenantType: tenants.tenantType,
      isActive: tenants.isActive,
      subscriptionPlan: tenants.subscriptionPlan,
      subscriptionStatus: tenants.subscriptionStatus,
      createdAt: tenants.createdAt,
      userCount:
        sql<number>`(
          select count(*)::int
          from ${portalUsers}
          where ${portalUsers.tenantId} = ${tenants.id}
        )`,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .limit(5);

  const [
    subTrialing,
    subActive,
    subPastDue,
    subCanceled,
    subComped,
    planFree,
    planStarter,
    planGrowth,
    planEnterprise,
  ] = await Promise.all([
    countTenantsWhere(eq(tenants.subscriptionStatus, "trialing")),
    countTenantsWhere(eq(tenants.subscriptionStatus, "active")),
    countTenantsWhere(eq(tenants.subscriptionStatus, "past_due")),
    countTenantsWhere(eq(tenants.subscriptionStatus, "canceled")),
    countTenantsWhere(eq(tenants.subscriptionStatus, "comped")),
    countTenantsWhere(eq(tenants.subscriptionPlan, "free")),
    countTenantsWhere(eq(tenants.subscriptionPlan, "starter")),
    countTenantsWhere(eq(tenants.subscriptionPlan, "growth")),
    countTenantsWhere(eq(tenants.subscriptionPlan, "enterprise")),
  ]);

  return {
    totalTenants: tenantCountRow[0]?.count ?? 0,
    activeTenants: activeTenantCountRow?.count ?? 0,
    totalPortalUsers: portalUserCountRow?.count ?? 0,
    recentTenants,
    subscriptionByStatus: {
      trialing: subTrialing,
      active: subActive,
      past_due: subPastDue,
      canceled: subCanceled,
      comped: subComped,
    },
    subscriptionByPlan: {
      free: planFree,
      starter: planStarter,
      growth: planGrowth,
      enterprise: planEnterprise,
    },
    subscriptionMetrics: {
      note: "Buckets count every tenant once by subscription_status and once by subscription_plan (persisted Stripe-backed fields). MRR/ARR are not computed here.",
    },
  };
}

export async function listPlatformAdminTenants() {
  await requirePlatformUser();

  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      tenantType: tenants.tenantType,
      isActive: tenants.isActive,
      subscriptionPlan: tenants.subscriptionPlan,
      subscriptionStatus: tenants.subscriptionStatus,
      createdAt: tenants.createdAt,
      userCount:
        sql<number>`(
          select count(*)::int
          from ${portalUsers}
          where ${portalUsers.tenantId} = ${tenants.id}
        )`,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));
}

export async function getPlatformAdminTenantDetail(tenantId: string) {
  await requirePlatformUser();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return null;
  }

  const users = await db.query.portalUsers.findMany({
    where: eq(portalUsers.tenantId, tenantId),
    with: {
      authUser: true,
    },
    orderBy: [desc(portalUsers.createdAt)],
  });

  const [totalUsersRow, activeUsersRow, usage] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(portalUsers)
      .where(eq(portalUsers.tenantId, tenantId))
      .then(rows => rows[0]),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(portalUsers)
      .where(
        and(eq(portalUsers.tenantId, tenantId), eq(portalUsers.isActive, true)),
      )
      .then(rows => rows[0]),
    getTenantPlanUsageByTenantId(tenantId),
  ]);

  const totalUsers = totalUsersRow?.count ?? 0;
  const activeUsers = activeUsersRow?.count ?? 0;
  const activity = await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.tenantId, tenantId),
      eq(auditLogs.entityTable, "tenants"),
      eq(auditLogs.entityId, tenantId),
    ),
    with: {
      actorPlatformUser: {
        with: {
          authUser: true,
        },
      },
    },
    orderBy: [desc(auditLogs.createdAt)],
    limit: 25,
  });

  return {
    tenant,
    users,
    stats: {
      totalUsers,
      activeUsers,
      inactiveUsers: Math.max(totalUsers - activeUsers, 0),
    },
    usage,
    activity,
  };
}

export async function listPlatformAdminUsers() {
  await requirePlatformUser();

  return db.query.platformUsers.findMany({
    with: {
      authUser: true,
    },
    orderBy: [desc(platformUsers.createdAt)],
  });
}

export async function setTenantActiveByPlatformAdmin(
  tenantId: string,
  isActive: boolean,
  reason?: string | null,
) {
  const platformUser = await requirePlatformUser();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  if (tenant.isActive === isActive) {
    return tenant;
  }

  const now = new Date();
  const normalizedReason = reason?.trim() ? reason.trim() : null;

  const [updatedTenant] = await db.transaction(async tx => {
    const [updated] = await tx
      .update(tenants)
      .set({
        isActive,
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update tenant");
    }

    await tx.insert(auditLogs).values({
      tenantId: updated.id,
      actorType: "platform_user",
      actorPlatformUserId: platformUser.id,
      action: "update",
      entityTable: "tenants",
      entityId: updated.id,
      entityLabel: updated.name,
      changedFieldsJson: JSON.stringify(["isActive"]),
      beforeJson: JSON.stringify({ isActive: tenant.isActive }),
      afterJson: JSON.stringify({ isActive: updated.isActive }),
      contextJson: JSON.stringify({
        action: updated.isActive ? "activate_tenant" : "deactivate_tenant",
        reason: normalizedReason,
      }),
    });

    return [updated] as const;
  });

  return updatedTenant;
}

export type UpdateTenantSubscriptionByPlatformAdminInput = {
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export async function updateTenantSubscriptionByPlatformAdmin(
  tenantId: string,
  input: UpdateTenantSubscriptionByPlatformAdminInput,
) {
  const platformUser = await requirePlatformUser();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const beforeSnap = subscriptionSnapshotFromRow(tenant);
  const nextStripeCustomer =
    input.stripeCustomerId?.trim() ? input.stripeCustomerId.trim() : null;
  const nextStripeSub =
    input.stripeSubscriptionId?.trim() ? input.stripeSubscriptionId.trim() : null;

  const [updated] = await db.transaction(async tx => {
    const [u] = await tx
      .update(tenants)
      .set({
        subscriptionPlan: input.subscriptionPlan,
        subscriptionStatus: input.subscriptionStatus,
        trialEndsAt: input.trialEndsAt,
        currentPeriodEndsAt: input.currentPeriodEndsAt,
        stripeCustomerId: nextStripeCustomer,
        stripeSubscriptionId: nextStripeSub,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!u) {
      throw new Error("Failed to update tenant");
    }

    const afterSnap = subscriptionSnapshotFromRow(u);
    const changed = diffSubscriptionKeys(beforeSnap, afterSnap);

    if (changed.length > 0) {
      await tx.insert(auditLogs).values({
        tenantId: u.id,
        actorType: "platform_user",
        actorPlatformUserId: platformUser.id,
        action: "update",
        entityTable: "tenants",
        entityId: u.id,
        entityLabel: u.name,
        changedFieldsJson: JSON.stringify(changed),
        beforeJson: JSON.stringify(beforeSnap),
        afterJson: JSON.stringify(afterSnap),
        contextJson: JSON.stringify({
          action: "update_tenant_subscription",
        }),
      });
    }

    return [u] as const;
  });

  return updated;
}
