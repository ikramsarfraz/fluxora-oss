import { and, desc, eq, gte, ilike, inArray, lte, or, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import { user as authUsers } from "@/db/auth-schema";
import { auditLogs, portalUsers, platformUsers, tenants } from "@/db/schema";
import type { TenantSubscriptionPlan, TenantSubscriptionStatus } from "@/lib/tenant-subscription";
import {
  diffSubscriptionKeys,
  subscriptionSnapshotFromRow,
} from "@/lib/tenant-subscription-audit";
import { getTenantPlanUsageByTenantId } from "@/modules/core/billing/services/subscription-usage";
import { computePriorWindow } from "@/modules/core/platform-admin/dashboard/utils/compute-prior-window";
import { requirePlatformUser } from "@/modules/core/platform-admin/services/platform-users";

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

export type PlatformAdminDashboardWindow = {
  /** Inclusive lower bound on `created_at` for the "new in window" cards. */
  since: Date;
  /** Inclusive upper bound. Open-ended (now) when null. */
  until?: Date | null;
};

function countCreatedInWindow(
  table: typeof tenants | typeof portalUsers,
  window: PlatformAdminDashboardWindow,
) {
  const createdAt =
    table === tenants ? tenants.createdAt : portalUsers.createdAt;
  const conditions: SQL[] = [gte(createdAt, window.since)];
  if (window.until) conditions.push(lte(createdAt, window.until));
  return db
    .select({ count: sql<number>`count(*)::int` })
    .from(table)
    .where(and(...conditions))
    .then(rows => rows[0]?.count ?? 0);
}

export async function getPlatformAdminDashboardData(
  window?: PlatformAdminDashboardWindow,
) {
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

  // "Window" cards are absent when the caller doesn't pass a window —
  // keeps the contract backward-compatible for any reader that just
  // wants the snapshot. When a window IS supplied, also compute the
  // matching counts in the prior equal-length period so the page can
  // render period-over-period deltas. We bound the prior window's
  // `until` strictly before the current `since` to avoid overlap; the
  // length is current.duration so the comparison is apples-to-apples.
  let windowCounts:
    | {
        newTenants: number;
        newPortalUsers: number;
        priorWindow: { since: Date; until: Date };
        priorNewTenants: number;
        priorNewPortalUsers: number;
      }
    | null = null;
  if (window) {
    const priorWindow = computePriorWindow(window);

    const [newTenants, newPortalUsers, priorNewTenants, priorNewPortalUsers] =
      await Promise.all([
        countCreatedInWindow(tenants, window),
        countCreatedInWindow(portalUsers, window),
        countCreatedInWindow(tenants, priorWindow),
        countCreatedInWindow(portalUsers, priorWindow),
      ]);

    windowCounts = {
      newTenants,
      newPortalUsers,
      priorWindow,
      priorNewTenants,
      priorNewPortalUsers,
    };
  }

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
    window: windowCounts,
  };
}

export type PlatformAdminTenantFilters = {
  search?: string | null;
  isActive?: "active" | "inactive" | null;
  subscriptionPlan?: TenantSubscriptionPlan | null;
  subscriptionStatus?: TenantSubscriptionStatus | null;
};

function buildPlatformAdminTenantWhere(
  filters: PlatformAdminTenantFilters,
): SQL | undefined {
  const conditions: SQL[] = [];

  const search = filters.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const match = or(ilike(tenants.name, like), ilike(tenants.slug, like));
    if (match) conditions.push(match);
  }
  if (filters.isActive === "active") {
    conditions.push(eq(tenants.isActive, true));
  } else if (filters.isActive === "inactive") {
    conditions.push(eq(tenants.isActive, false));
  }
  if (filters.subscriptionPlan) {
    conditions.push(eq(tenants.subscriptionPlan, filters.subscriptionPlan));
  }
  if (filters.subscriptionStatus) {
    conditions.push(eq(tenants.subscriptionStatus, filters.subscriptionStatus));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listPlatformAdminTenants(args?: {
  filters?: PlatformAdminTenantFilters;
  limit?: number;
  offset?: number;
}) {
  await requirePlatformUser();

  const where = buildPlatformAdminTenantWhere(args?.filters ?? {});
  const query = db
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
    .where(where)
    .orderBy(desc(tenants.createdAt));

  if (args?.limit != null) query.limit(args.limit);
  if (args?.offset != null) query.offset(args.offset);

  return query;
}

export async function countPlatformAdminTenants(
  filters: PlatformAdminTenantFilters = {},
): Promise<number> {
  await requirePlatformUser();

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenants)
    .where(buildPlatformAdminTenantWhere(filters));
  return row?.count ?? 0;
}

export type PlatformAdminSubscriptionRow = {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus: TenantSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  isActive: boolean;
  createdAt: Date;
};

/**
 * Inline-edit grid on /admin/subscriptions wants every column the
 * TenantSubscriptionForm reads. `listPlatformAdminTenants` omits the
 * datetime + Stripe id columns for compactness, so this is a parallel
 * reader that returns the full subscription footprint. Filters reuse
 * the same plan + status shape.
 */
export async function listPlatformAdminSubscriptions(args?: {
  filters?: Pick<
    PlatformAdminTenantFilters,
    "search" | "subscriptionPlan" | "subscriptionStatus"
  >;
  limit?: number;
  offset?: number;
}): Promise<PlatformAdminSubscriptionRow[]> {
  await requirePlatformUser();

  const where = buildPlatformAdminTenantWhere(args?.filters ?? {});
  const query = db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      subscriptionPlan: tenants.subscriptionPlan,
      subscriptionStatus: tenants.subscriptionStatus,
      trialEndsAt: tenants.trialEndsAt,
      currentPeriodEndsAt: tenants.currentPeriodEndsAt,
      stripeCustomerId: tenants.stripeCustomerId,
      stripeSubscriptionId: tenants.stripeSubscriptionId,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(where)
    .orderBy(desc(tenants.createdAt));

  if (args?.limit != null) query.limit(args.limit);
  if (args?.offset != null) query.offset(args.offset);

  return query;
}

export async function countPlatformAdminSubscriptions(
  filters: Pick<
    PlatformAdminTenantFilters,
    "search" | "subscriptionPlan" | "subscriptionStatus"
  > = {},
): Promise<number> {
  await requirePlatformUser();

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenants)
    .where(buildPlatformAdminTenantWhere(filters));
  return row?.count ?? 0;
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

  return {
    tenant,
    users,
    stats: {
      totalUsers,
      activeUsers,
      inactiveUsers: Math.max(totalUsers - activeUsers, 0),
    },
    usage,
  };
}

function tenantActivityWhere(tenantId: string): SQL {
  return and(
    eq(auditLogs.tenantId, tenantId),
    eq(auditLogs.entityTable, "tenants"),
    eq(auditLogs.entityId, tenantId),
  )!;
}

export async function listPlatformAdminTenantActivity(args: {
  tenantId: string;
  limit: number;
  offset: number;
}) {
  await requirePlatformUser();

  return db.query.auditLogs.findMany({
    where: tenantActivityWhere(args.tenantId),
    with: {
      actorPlatformUser: {
        with: { authUser: true },
      },
    },
    orderBy: [desc(auditLogs.createdAt)],
    limit: args.limit,
    offset: args.offset,
  });
}

export async function countPlatformAdminTenantActivity(
  tenantId: string,
): Promise<number> {
  await requirePlatformUser();

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(tenantActivityWhere(tenantId));
  return row?.count ?? 0;
}

export type PlatformAdminUserRole = "platform_admin" | "support" | "qa";

export type PlatformAdminUserFilters = {
  search?: string | null;
  role?: PlatformAdminUserRole | null;
  isActive?: "active" | "inactive" | null;
};

function buildPlatformAdminUserWhere(
  filters: PlatformAdminUserFilters,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.role) {
    conditions.push(eq(platformUsers.role, filters.role));
  }
  if (filters.isActive === "active") {
    conditions.push(eq(platformUsers.isActive, true));
  } else if (filters.isActive === "inactive") {
    conditions.push(eq(platformUsers.isActive, false));
  }

  const search = filters.search?.trim();
  if (search) {
    const like = `%${search}%`;
    const match = or(ilike(authUsers.name, like), ilike(authUsers.email, like));
    if (match) conditions.push(match);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listPlatformAdminUsers(args?: {
  filters?: PlatformAdminUserFilters;
  limit?: number;
  offset?: number;
}) {
  await requirePlatformUser();

  const where = buildPlatformAdminUserWhere(args?.filters ?? {});
  const query = db
    .select({
      id: platformUsers.id,
      role: platformUsers.role,
      isActive: platformUsers.isActive,
      createdAt: platformUsers.createdAt,
      authUser: {
        id: authUsers.id,
        name: authUsers.name,
        email: authUsers.email,
      },
    })
    .from(platformUsers)
    .innerJoin(authUsers, eq(authUsers.id, platformUsers.authUserId))
    .where(where)
    .orderBy(desc(platformUsers.createdAt));

  if (args?.limit != null) query.limit(args.limit);
  if (args?.offset != null) query.offset(args.offset);

  return query;
}

export async function countPlatformAdminUsers(
  filters: PlatformAdminUserFilters = {},
): Promise<number> {
  await requirePlatformUser();

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformUsers)
    .innerJoin(authUsers, eq(authUsers.id, platformUsers.authUserId))
    .where(buildPlatformAdminUserWhere(filters));
  return row?.count ?? 0;
}

const PLATFORM_USER_ROLE_VALUES: readonly PlatformAdminUserRole[] = [
  "platform_admin",
  "support",
  "qa",
];

function isPlatformUserRole(value: unknown): value is PlatformAdminUserRole {
  return (
    typeof value === "string" &&
    (PLATFORM_USER_ROLE_VALUES as readonly string[]).includes(value)
  );
}

async function requirePlatformAdminActor() {
  const actor = await requirePlatformUser();
  if (actor.role !== "platform_admin") {
    throw new Error(
      "Only platform admins can manage platform users.",
    );
  }
  return actor;
}

export type UpdatePlatformUserInput = {
  id: string;
  role: PlatformAdminUserRole;
  isActive: boolean;
};

export async function updatePlatformUserByAdmin(input: UpdatePlatformUserInput) {
  const actor = await requirePlatformAdminActor();

  if (!isPlatformUserRole(input.role)) {
    throw new Error("Invalid role.");
  }

  const existing = await db.query.platformUsers.findFirst({
    where: eq(platformUsers.id, input.id),
    with: { authUser: true },
  });
  if (!existing) {
    throw new Error("Platform user not found.");
  }

  // Guard rails: a platform admin can't lock themselves out by
  // demoting their own role or deactivating their own account. If they
  // need to, another platform admin should make the change.
  if (existing.id === actor.id) {
    if (existing.role === "platform_admin" && input.role !== "platform_admin") {
      throw new Error("You cannot demote your own platform_admin role.");
    }
    if (existing.isActive && !input.isActive) {
      throw new Error("You cannot deactivate your own account.");
    }
  }

  const beforeSnap = { role: existing.role, isActive: existing.isActive };
  const afterSnap = { role: input.role, isActive: input.isActive };
  const changed = (
    Object.keys(afterSnap) as Array<keyof typeof afterSnap>
  ).filter(k => beforeSnap[k] !== afterSnap[k]);

  if (changed.length === 0) {
    return existing;
  }

  const [updated] = await db.transaction(async tx => {
    const [u] = await tx
      .update(platformUsers)
      .set({
        role: input.role,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(platformUsers.id, input.id))
      .returning();

    if (!u) throw new Error("Failed to update platform user.");

    await tx.insert(auditLogs).values({
      tenantId: null,
      actorType: "platform_user",
      actorPlatformUserId: actor.id,
      action: "update",
      entityTable: "platform_users",
      entityId: u.id,
      entityLabel: existing.authUser.email,
      changedFieldsJson: JSON.stringify(changed),
      beforeJson: JSON.stringify(beforeSnap),
      afterJson: JSON.stringify(afterSnap),
      contextJson: JSON.stringify({ action: "update_platform_user" }),
    });

    return [u] as const;
  });

  return updated;
}

export type CreatePlatformUserInput = {
  email: string;
  role: PlatformAdminUserRole;
};

export async function createPlatformUserByAdmin(input: CreatePlatformUserInput) {
  const actor = await requirePlatformAdminActor();

  if (!isPlatformUserRole(input.role)) {
    throw new Error("Invalid role.");
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const candidate = await db.query.user.findFirst({
    where: eq(authUsers.email, email),
  });
  if (!candidate) {
    throw new Error(
      "No account found for that email. The person must sign up first, then you can grant them platform access.",
    );
  }

  const existing = await db.query.platformUsers.findFirst({
    where: eq(platformUsers.authUserId, candidate.id),
  });
  if (existing) {
    throw new Error(
      "That account is already a platform user. Use the row to edit their role or status.",
    );
  }

  const [created] = await db.transaction(async tx => {
    const [row] = await tx
      .insert(platformUsers)
      .values({
        authUserId: candidate.id,
        role: input.role,
        isActive: true,
      })
      .returning();

    if (!row) throw new Error("Failed to create platform user.");

    await tx.insert(auditLogs).values({
      tenantId: null,
      actorType: "platform_user",
      actorPlatformUserId: actor.id,
      action: "insert",
      entityTable: "platform_users",
      entityId: row.id,
      entityLabel: candidate.email,
      changedFieldsJson: JSON.stringify(["role", "isActive"]),
      beforeJson: null,
      afterJson: JSON.stringify({ role: row.role, isActive: row.isActive }),
      contextJson: JSON.stringify({
        action: "create_platform_user",
        authUserId: candidate.id,
      }),
    });

    return [row] as const;
  });

  return created;
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

export type BulkSetTenantsActiveResult = {
  updatedCount: number;
  skippedCount: number;
};

/**
 * Multi-tenant variant of `setTenantActiveByPlatformAdmin`. Runs all
 * matching rows + their audit entries inside one transaction so the
 * caller sees a consistent before/after, and skips tenants whose state
 * already matches the requested value so a re-submit isn't destructive.
 *
 * `reason` is shared across every audit row — that's the right model
 * for "I deactivated these 12 tenants because the demo is over." If a
 * tenant needs a unique reason, use the single-row helper instead.
 *
 * Caller-side role gating happens via the server action — this function
 * still defers to `requirePlatformUser` so direct service-level callers
 * don't bypass auth entirely.
 */
export async function bulkSetTenantsActiveByPlatformAdmin(args: {
  tenantIds: string[];
  isActive: boolean;
  reason?: string | null;
}): Promise<BulkSetTenantsActiveResult> {
  const platformUser = await requirePlatformUser();

  // Deduplicate ids so duplicate selections don't double-audit and
  // short-circuit on empty input rather than running an `inArray ()`
  // which Postgres treats as always-false.
  const uniqueIds = Array.from(new Set(args.tenantIds));
  if (uniqueIds.length === 0) {
    return { updatedCount: 0, skippedCount: 0 };
  }

  const existing = await db.query.tenants.findMany({
    where: inArray(tenants.id, uniqueIds),
  });

  const toUpdate = existing.filter(t => t.isActive !== args.isActive);
  if (toUpdate.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: existing.length,
    };
  }

  const now = new Date();
  const normalizedReason = args.reason?.trim() ? args.reason.trim() : null;

  await db.transaction(async tx => {
    await tx
      .update(tenants)
      .set({
        isActive: args.isActive,
        updatedAt: now,
      })
      .where(
        inArray(
          tenants.id,
          toUpdate.map(t => t.id),
        ),
      );

    await tx.insert(auditLogs).values(
      toUpdate.map(t => ({
        tenantId: t.id,
        actorType: "platform_user" as const,
        actorPlatformUserId: platformUser.id,
        action: "update" as const,
        entityTable: "tenants",
        entityId: t.id,
        entityLabel: t.name,
        changedFieldsJson: JSON.stringify(["isActive"]),
        beforeJson: JSON.stringify({ isActive: t.isActive }),
        afterJson: JSON.stringify({ isActive: args.isActive }),
        contextJson: JSON.stringify({
          action: args.isActive ? "activate_tenant" : "deactivate_tenant",
          reason: normalizedReason,
          batchSize: toUpdate.length,
        }),
      })),
    );
  });

  return {
    updatedCount: toUpdate.length,
    skippedCount: existing.length - toUpdate.length,
  };
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
