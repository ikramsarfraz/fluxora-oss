import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, portalUsers, platformUsers, tenants } from "@/db/schema";
import { requirePlatformUser } from "./platform-users";

function countAll(table: typeof tenants | typeof portalUsers) {
  return db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(table);
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

  return {
    totalTenants: tenantCountRow[0]?.count ?? 0,
    activeTenants: activeTenantCountRow?.count ?? 0,
    totalPortalUsers: portalUserCountRow?.count ?? 0,
    recentTenants,
    subscriptionMetrics: {
      mrr: "TBD",
      arr: "TBD",
      churn: "TBD",
      note: "Billing integration is not wired yet.",
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

  const [totalUsersRow, activeUsersRow] = await Promise.all([
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
    limit: 10,
  });

  return {
    tenant,
    users,
    stats: {
      totalUsers,
      activeUsers,
      inactiveUsers: Math.max(totalUsers - activeUsers, 0),
    },
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
