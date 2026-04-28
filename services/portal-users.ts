import { isAPIError } from "better-auth/api";
import { and, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { portalUsers, userInvitations } from "@/db/schema";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getPlanLimit } from "@/lib/subscription-plan-capabilities";
import { formatSubscriptionPlanLabel } from "@/lib/subscription-display";
import {
  createPaginatedResult,
  getPaginationOffset,
  normalizePaginatedQuery,
  type PaginatedQueryInput,
  type SortDirection,
} from "@/lib/pagination";
import { inviteUser as inviteUserAuth } from "@/services/auth";
import { getCurrentRequestTenant, getCurrentTenant } from "./tenants";

export type PortalUserRole =
  | "owner"
  | "admin"
  | "sales"
  | "warehouse"
  | "accounting";

/** First self-serve signup gets admin; adjust if you add invites later. */
const DEFAULT_SIGNUP_ROLE: PortalUserRole = "admin";

/**
 * Creates ERP `portal_users` row for the signed-in Better Auth user (idempotent).
 * Call after `authClient.signUp.email` succeeds so cookies are present.
 */
export async function createPortalUser(input: {
  tenantId: string;
  authUserId: string;
  fullName: string;
  email: string;
  role?: PortalUserRole;
}) {
  const existing = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.authUserId, input.authUserId),
      eq(portalUsers.tenantId, input.tenantId),
    ),
  });
  if (existing) return existing;

  const [row] = await db
    .insert(portalUsers)
    .values({
      tenantId: input.tenantId,
      authUserId: input.authUserId,
      fullName: input.fullName,
      email: input.email,
      role: input.role ?? DEFAULT_SIGNUP_ROLE,
      isActive: true,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create portal user");
  }
  return row;
}

/**
 * Gets all portal users.
 */
export async function getUsers() {
  const current = await requireAdminPortalUser();

  return await db.query.portalUsers.findMany({
    where: eq(portalUsers.tenantId, current.tenantId),
    with: { authUser: true },
    orderBy: [desc(portalUsers.createdAt)],
  });
}

export type UsersDirectoryListSort =
  | "fullName"
  | "email"
  | "role"
  | "createdAt"
  | "isActive";

export type UsersDirectoryListParams =
  PaginatedQueryInput<UsersDirectoryListSort>;

type UsersDirectoryDbRow = {
  kind: "user" | "invitation";
  id: string;
  fullName: string;
  email: string;
  role: PortalUserRole;
  createdAt: Date;
  isActive: boolean;
  emailVerified: boolean | null;
  inviteExpiresAt: Date | null;
};

export type UsersDirectoryListItem =
  | {
      kind: "user";
      row: {
        id: string;
        fullName: string;
        email: string;
        role: PortalUserRole;
        createdAt: Date;
        isActive: boolean;
        authUser: {
          emailVerified: boolean;
        } | null;
      };
    }
  | {
      kind: "invitation";
      row: {
        id: string;
        fullName: string;
        email: string;
        role: PortalUserRole;
        createdAt: Date;
        /** Present for invitations; `null` when the row is a user. */
        inviteExpiresAt: Date;
        inviteIsExpired: boolean;
      };
    };

function getUsersDirectorySortSql(
  sort: UsersDirectoryListSort,
  direction: SortDirection,
) {
  const dir = direction === "asc" ? sql.raw("asc") : sql.raw("desc");

  switch (sort) {
    case "fullName":
      return sql`full_name ${dir}, created_at desc`;
    case "email":
      return sql`email ${dir}, created_at desc`;
    case "role":
      return sql`role ${dir}, created_at desc`;
    case "isActive":
      return sql`is_active ${dir}, created_at desc`;
    case "createdAt":
    default:
      return sql`created_at ${dir}`;
  }
}

export async function getUsersDirectoryPage(input?: UsersDirectoryListParams) {
  const current = await requireAdminPortalUser();
  const query = normalizePaginatedQuery(input, {
    defaultSort: "createdAt",
    defaultDirection: "desc",
    defaultFilters: {},
  });
  const hasSearch = query.search.length > 0;
  const pattern = `%${query.search.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
  const searchUserClause = hasSearch
    ? sql`
        and (
          lower(pu.full_name) like ${pattern} escape '\\'
          or lower(pu.email) like ${pattern} escape '\\'
          or lower(pu.role::text) like ${pattern} escape '\\'
        )
      `
    : sql``;
  const searchInvitationClause = hasSearch
    ? sql`
        and (
          lower(ui.full_name) like ${pattern} escape '\\'
          or lower(ui.email) like ${pattern} escape '\\'
          or lower(ui.role::text) like ${pattern} escape '\\'
        )
      `
    : sql``;
  const directoryCte = sql`
    with directory as (
      select
        'user'::text as kind,
        pu.id,
        pu.full_name,
        pu.email,
        pu.role::text as role,
        pu.created_at,
        pu.is_active,
        au.email_verified,
        null::timestamptz as invite_expires_at
      from portal_users pu
      left join "user" au on au.id = pu.auth_user_id
      where pu.tenant_id = ${current.tenantId}
      ${searchUserClause}

      union all

      select
        'invitation'::text as kind,
        ui.id,
        ui.full_name,
        ui.email,
        ui.role::text as role,
        ui.created_at,
        true as is_active,
        null::boolean as email_verified,
        ui.expires_at
      from user_invitations ui
      where ui.tenant_id = ${current.tenantId}
        and ui.status = 'pending'
      ${searchInvitationClause}
    )
  `;

  const totalResult = await db.execute<{ count: number }>(sql`
    ${directoryCte}
    select count(*)::int as count
    from directory
  `);
  const total = totalResult.rows[0]?.count ?? 0;

  const rowsResult = await db.execute<UsersDirectoryDbRow>(sql`
    ${directoryCte}
    select
      kind,
      id,
      full_name as "fullName",
      email,
      role,
      created_at as "createdAt",
      is_active as "isActive",
      email_verified as "emailVerified",
      invite_expires_at as "inviteExpiresAt"
    from directory
    order by ${getUsersDirectorySortSql(query.sort, query.direction)}
    limit ${query.pageSize}
    offset ${getPaginationOffset(query.page, query.pageSize)}
  `);

  const data = rowsResult.rows.map(row => {
    if (row.kind === "user") {
      return {
        kind: "user" as const,
        row: {
          id: row.id,
          fullName: row.fullName,
          email: row.email,
          role: row.role,
          createdAt: row.createdAt,
          isActive: row.isActive,
          authUser:
            row.emailVerified == null
              ? null
              : { emailVerified: row.emailVerified },
        },
      };
    }
    const ex = row.inviteExpiresAt;
    if (!ex) {
      throw new Error("Invitation row missing invite expiry.");
    }
    return {
      kind: "invitation" as const,
      row: {
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        role: row.role,
        createdAt: row.createdAt,
        inviteExpiresAt: ex,
        inviteIsExpired: ex < new Date(),
      },
    };
  });

  return createPaginatedResult({
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
  });
}

/** Row from `getUsers()` (includes Better Auth `authUser` for email verification). */
export type PortalUserListItem = Awaited<ReturnType<typeof getUsers>>[number];

/**
 * Gets a portal user by id.
 */
export async function getUserById(id: string) {
  const current = await requireAdminPortalUser();
  const user = await db.query.portalUsers.findFirst({
    where: and(eq(portalUsers.id, id), eq(portalUsers.tenantId, current.tenantId)),
    with: {
      authUser: true,
    },
  });
  return user;
}

/** Row shape returned by `createPortalUser()` (for client `import type` only). */
export type PortalUserRecord = Awaited<ReturnType<typeof createPortalUser>>;

/** Single user with Better Auth row (from `getUserById`). */
export type PortalUserDetail = NonNullable<
  Awaited<ReturnType<typeof getUserById>>
>;

/**
 * Gets a portal user by auth user id.
 */
export async function getUserByAuthUserId(authUserId: string, tenantId?: string) {
  const resolvedTenantId =
    tenantId ?? (await getCurrentRequestTenant()).tenant?.id ?? null;

  const user = await db.query.portalUsers.findFirst({
    where: resolvedTenantId
      ? and(
          eq(portalUsers.authUserId, authUserId),
          eq(portalUsers.tenantId, resolvedTenantId),
        )
      : eq(portalUsers.authUserId, authUserId),
    with: {
      authUser: true,
    },
  });
  return user;
}

/**
 * Returns the portal user for the current session. Throws if unauthenticated
 * or if the auth user has no matching `portal_users` row.
 */
export async function getCurrentPortalUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const tenant = await getCurrentTenant();
  const portalUser = await getUserByAuthUserId(session.user.id, tenant.id);
  if (!portalUser) {
    throw new Error("Portal user not found");
  }
  return portalUser;
}

/**
 * Current session user must be an admin (`portal_users.role === "admin" || portal_users.role === "owner"`).
 */
export async function requireAdminPortalUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const tenant = await getCurrentTenant();
  const current = await getUserByAuthUserId(session.user.id, tenant.id);
  if (!current || (current.role !== "admin" && current.role !== "owner")) {
    throw new Error("Forbidden");
  }
  return current;
}

/**
 * Sets `portal_users.is_active`. Admins cannot deactivate themselves.
 */
export async function setPortalUserActiveByAdmin(
  targetUserId: string,
  isActive: boolean,
): Promise<PortalUserDetail> {
  const current = await requireAdminPortalUser();
  if (current.id === targetUserId && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  const target = await getUserById(targetUserId);
  if (!target) {
    throw new Error("User not found");
  }

  await db
    .update(portalUsers)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(portalUsers.id, targetUserId));

  const updated = await getUserById(targetUserId);
  if (!updated) {
    throw new Error("Failed to load user after update");
  }
  return updated;
}

/**
 * Sets `portal_users.role` for a target user. Non-owner admins cannot assign
 * or revoke the `owner` role, and admins cannot change their own role.
 */
export async function setPortalUserRoleByAdmin(
  targetUserId: string,
  role: PortalUserRole,
): Promise<PortalUserDetail> {
  const current = await requireAdminPortalUser();

  if (current.id === targetUserId) {
    throw new Error("You cannot change your own role.");
  }

  const target = await getUserById(targetUserId);
  if (!target) {
    throw new Error("User not found");
  }

  if (current.role !== "owner") {
    if (role === "owner") {
      throw new Error("Only an owner can grant the owner role.");
    }
    if (target.role === "owner") {
      throw new Error("Only an owner can change an owner's role.");
    }
  }

  await db
    .update(portalUsers)
    .set({
      role,
      updatedAt: new Date(),
    })
    .where(eq(portalUsers.id, targetUserId));

  const updated = await getUserById(targetUserId);
  if (!updated) {
    throw new Error("Failed to load user after update");
  }
  return updated;
}

/**
 * Sends Better Auth password-reset email to the user&apos;s sign-in address.
 */
export async function sendPasswordResetForUserByAdmin(
  targetUserId: string,
): Promise<{ success: true }> {
  await requireAdminPortalUser();

  const target = await getUserById(targetUserId);
  if (!target) {
    throw new Error("User not found");
  }

  const email = target.authUser?.email ?? target.email;

  try {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: "/reset-password",
      },
    });
  } catch (e) {
    if (isAPIError(e)) {
      throw new Error(e.message || "Failed to send password reset email.");
    }
    throw e;
  }

  return { success: true };
}

/**
 * Admin-only: send an invitation email. Rejects active members in this tenant,
 * duplicate pending invites for the same email, and allows existing global
 * auth users who are not yet on this tenant (they verify on accept).
 */
export async function inviteUserByAdmin(input: {
  email: string;
  fullName: string;
  role?: Exclude<PortalUserRole, "owner">;
}): Promise<{ success: true }> {
  const [current, tenant] = await Promise.all([
    requireAdminPortalUser(),
    getCurrentTenant(),
  ]);

  const emailTrim = input.email.trim();
  const fullNameTrim = input.fullName.trim();
  if (!emailTrim || !fullNameTrim) {
    throw new Error("Email and full name are required.");
  }
  const normalizedEmail = emailTrim.toLowerCase();

  const [existingPortal] = await db
    .select({ id: portalUsers.id })
    .from(portalUsers)
    .where(
      and(
        eq(portalUsers.tenantId, current.tenantId),
        sql`lower(${portalUsers.email}) = ${normalizedEmail}`,
      ),
    )
    .limit(1);
  if (existingPortal) {
    throw new Error(
      "This email already belongs to a team member in this workspace.",
    );
  }

  const pendingInvite = await db.query.userInvitations.findFirst({
    where: and(
      eq(userInvitations.tenantId, current.tenantId),
      eq(userInvitations.status, "pending"),
      sql`lower(${userInvitations.email}) = ${normalizedEmail}`,
    ),
  });
  if (pendingInvite) {
    throw new Error(
      "An invitation is already pending for this email. Resend or revoke it from the Users list.",
    );
  }

  const [activePortalUsers, pendingInvitations] = await Promise.all([
    db
      .select({ c: count() })
      .from(portalUsers)
      .where(
        and(
          eq(portalUsers.tenantId, current.tenantId),
          eq(portalUsers.isActive, true),
        ),
      )
      .then(rows => rows[0]?.c ?? 0),
    db
      .select({ c: count() })
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.tenantId, current.tenantId),
          eq(userInvitations.status, "pending"),
        ),
      )
      .then(rows => rows[0]?.c ?? 0),
  ]);

  const maxPortalUsers = getPlanLimit(tenant, "maxPortalUsers");
  const projectedSeats = activePortalUsers + pendingInvitations + 1;
  if (projectedSeats > maxPortalUsers) {
    throw new Error(
      `Your current plan (${formatSubscriptionPlanLabel(
        tenant.subscriptionPlan,
      )}) allows up to ${maxPortalUsers} portal users, including pending invites. Upgrade your plan to invite another user.`,
    );
  }

  await inviteUserAuth({
    email: emailTrim,
    fullName: fullNameTrim,
    role: input.role ?? "sales",
    invitedByUserId: current.id,
  });

  return { success: true };
}
