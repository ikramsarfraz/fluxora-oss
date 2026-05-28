import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";

import { and, asc, desc, eq, ilike, lt, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { user as authUsers } from "@/db/auth-schema";
import { platformUserInvitations, platformUsers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { resend, emailFrom } from "@/lib/email";
import { invitationExpiryAt } from "@/lib/invitation-expiry";
import {
  buildPlatformAdminAppUrl,
  buildRootAppUrl,
  getRequestTenantHostContextFromHeaders,
} from "@/lib/tenant-host";
import { recordActionBreadcrumb } from "@/lib/sentry-scope";
import { InvitePlatformUserEmail } from "@/emails/invite-platform-user";
import {
  requirePlatformUser,
  requirePlatformUserInRoles,
  type PlatformUserRole,
} from "@/modules/core/platform-admin/services/platform-users";
import { PLATFORM_USERS_ROLES } from "@/modules/core/platform-admin/platform-users/permissions";

// ---------------------------------------------------------------------------
// Platform-user email invitations.
//
// Mirrors the tenant-user invite flow under modules/core/workspace-settings/
// + modules/shared/services/auth.ts, but bound to the platform-admin host
// (`admin.<root-domain>`) instead of a tenant subdomain. Acceptance writes
// a `platform_users` row and marks the invitation as accepted.
//
// Why a separate flow from `createPlatformUserByAdmin` (which "promotes an
// existing auth user"): that path requires the recipient already has a
// Better Auth account. This invite path is for the common case — handing
// platform access to someone who's never signed in. Better Auth's magic
// link issues the signup + first session as a side effect of clicking the
// invite link.
// ---------------------------------------------------------------------------

const NORMALIZED_PENDING_EXPIRY_WINDOW_DAYS = 7;

export type PlatformUserInvitationStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "revoked";

export type PlatformUserInvitationRow = {
  id: string;
  email: string;
  role: PlatformUserRole;
  status: PlatformUserInvitationStatus;
  invitedByPlatformUserId: string;
  invitedByEmail: string | null;
  invitedByName: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function ensureValidEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@") || normalized.length < 3) {
    throw new Error("Enter a valid email address.");
  }
  return normalized;
}

async function loadInvitationByToken(token: string) {
  const invitation = await db.query.platformUserInvitations.findFirst({
    where: eq(platformUserInvitations.token, token),
  });
  return invitation ?? null;
}

function assertInvitationUsable(invitation: {
  status: PlatformUserInvitationStatus;
  expiresAt: Date;
}) {
  if (invitation.status === "revoked") {
    throw new Error("This invitation was revoked.");
  }
  if (invitation.status === "accepted") {
    throw new Error("This invitation was already accepted.");
  }
  if (invitation.status !== "pending") {
    throw new Error("This invitation is no longer valid.");
  }
  if (invitation.expiresAt < new Date()) {
    throw new Error("This invitation has expired.");
  }
}

/**
 * Sends the platform-admin invite email. The accept link lives on the
 * platform-admin host (admin.<root-domain>); first-time recipients get
 * sent through Better Auth's magic-link sign-in by the accept page so
 * they end up with a Better Auth `user` row + session before the
 * platform_users row is created.
 */
async function sendPlatformInvitationEmail(args: {
  email: string;
  role: PlatformUserRole;
  token: string;
  invitedByName: string | null;
}) {
  const requestHeaders = await headers();
  const context = getRequestTenantHostContextFromHeaders(requestHeaders);
  // Accept page lives on the root host (not the admin host) so an
  // unauthenticated invitee can reach it — the admin host's layout
  // requires a platform_users row, which the invitee hasn't earned yet.
  // The accept flow redirects them to the admin host on success.
  const inviteUrl = buildRootAppUrl({
    pathname: `/platform-invite/${args.token}`,
    context,
  });

  await resend.emails.send({
    from: emailFrom,
    to: args.email,
    subject: "You've been invited to join Pelzer Solutions platform admin",
    react: InvitePlatformUserEmail({
      inviteUrl,
      role: args.role,
      invitedByName: args.invitedByName,
    }),
  });
}

async function actorDisplayName(platformUserId: string): Promise<string | null> {
  const row = await db
    .select({ name: authUsers.name, email: authUsers.email })
    .from(platformUsers)
    .innerJoin(authUsers, eq(authUsers.id, platformUsers.authUserId))
    .where(eq(platformUsers.id, platformUserId))
    .limit(1);
  const r = row[0];
  if (!r) return null;
  return r.name?.trim() || r.email;
}

export async function invitePlatformUserByAdmin(input: {
  email: string;
  role: PlatformUserRole;
}): Promise<{ id: string }> {
  const actor = await requirePlatformUserInRoles(PLATFORM_USERS_ROLES);
  const email = ensureValidEmail(input.email);

  // Guard: already a platform user.
  const existingPlatformUser = await db
    .select({ id: platformUsers.id })
    .from(platformUsers)
    .innerJoin(authUsers, eq(authUsers.id, platformUsers.authUserId))
    .where(sql`lower(${authUsers.email}) = ${email}`)
    .limit(1);
  if (existingPlatformUser.length > 0) {
    throw new Error(
      "That email already has platform access — use the edit row to change their role.",
    );
  }

  // Guard: outstanding pending invitation for that email.
  const existingInvitation = await db.query.platformUserInvitations.findFirst({
    where: and(
      sql`lower(${platformUserInvitations.email}) = ${email}`,
      eq(platformUserInvitations.status, "pending"),
    ),
  });
  if (existingInvitation && existingInvitation.expiresAt > new Date()) {
    throw new Error(
      "There's already a pending invitation for that email. Revoke it first or wait for it to expire.",
    );
  }

  const token = randomUUID();
  const expiresAt = invitationExpiryAt({
    configuredDays: NORMALIZED_PENDING_EXPIRY_WINDOW_DAYS,
  });

  const [row] = await db
    .insert(platformUserInvitations)
    .values({
      email,
      role: input.role,
      token,
      invitedByPlatformUserId: actor.id,
      expiresAt,
    })
    .returning({ id: platformUserInvitations.id });
  if (!row) throw new Error("Failed to create invitation.");

  recordActionBreadcrumb({
    action: "platform_admin.invite_platform_user",
    data: { role: input.role },
  });

  const invitedByName = await actorDisplayName(actor.id);
  await sendPlatformInvitationEmail({
    email,
    role: input.role,
    token,
    invitedByName,
  });

  return { id: row.id };
}

/**
 * Issues a Better Auth magic link for an unauthenticated invite recipient.
 * After they click the magic link, Better Auth signs them in (creating a
 * `user` row if one didn't exist) and bounces back to the accept page.
 */
export async function sendPlatformInvitationMagicLink(
  input: { token: string },
  options?: { requestHeaders?: Headers },
): Promise<{ ok: true }> {
  const headerBag = options?.requestHeaders ?? new Headers();
  const invitation = await loadInvitationByToken(input.token);
  if (!invitation) throw new Error("Invitation not found.");
  assertInvitationUsable(invitation);

  const requestCtx = getRequestTenantHostContextFromHeaders(headerBag);
  const invitePageUrl = buildRootAppUrl({
    pathname: `/platform-invite/${invitation.token}`,
    searchParams: { from: "ml" },
    context: requestCtx,
  });

  await auth.api.signInMagicLink({
    body: {
      email: invitation.email,
      callbackURL: invitePageUrl,
      newUserCallbackURL: invitePageUrl,
      errorCallbackURL: buildRootAppUrl({
        pathname: "/login",
        searchParams: { platformInviteError: "magic_link" },
        context: requestCtx,
      }),
    },
    headers: headerBag,
  });

  return { ok: true };
}

/**
 * Finalize platform-user creation once the Better Auth session matches the
 * invitation email. Returns the URL the caller should redirect to.
 */
export async function completePlatformInvitationFromSession(
  input: { token: string },
  options?: { requestHeaders?: Headers },
): Promise<{ redirectUrl: string }> {
  const headerBag = options?.requestHeaders ?? new Headers();
  const session = await auth.api.getSession({ headers: headerBag });
  if (!session?.user?.email) {
    throw new Error("Sign in required.");
  }

  const invitation = await loadInvitationByToken(input.token);
  if (!invitation) throw new Error("Invitation not found.");
  assertInvitationUsable(invitation);

  const sessEmail = session.user.email.trim().toLowerCase();
  const inviteEmail = invitation.email.trim().toLowerCase();
  if (sessEmail !== inviteEmail) {
    throw new Error("Sign in as the invited email address to continue.");
  }

  const requestCtx = getRequestTenantHostContextFromHeaders(headerBag);
  const dashboardUrl = buildPlatformAdminAppUrl({
    pathname: "/admin",
    context: requestCtx,
  });

  // If a platform_users row already exists for this auth user, just stamp
  // the invitation accepted and let them in. Covers double-clicks on the
  // accept link and re-invites for an existing operator.
  const existing = await db.query.platformUsers.findFirst({
    where: eq(platformUsers.authUserId, session.user.id),
  });
  if (existing) {
    if (!existing.isActive) {
      throw new Error(
        "Your platform account is inactive. Ask another platform admin to reactivate it.",
      );
    }
    await db
      .update(platformUserInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByAuthUserId: session.user.id,
      })
      .where(eq(platformUserInvitations.id, invitation.id));
    return { redirectUrl: dashboardUrl };
  }

  await db.transaction(async tx => {
    await tx.insert(platformUsers).values({
      authUserId: session.user.id,
      role: invitation.role,
      isActive: true,
    });
    await tx
      .update(platformUserInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByAuthUserId: session.user.id,
      })
      .where(eq(platformUserInvitations.id, invitation.id));
  });

  return { redirectUrl: dashboardUrl };
}

export type ListPlatformInvitationsFilters = {
  status?: PlatformUserInvitationStatus | "all" | null;
  search?: string | null;
};

function buildListWhere(filters: ListPlatformInvitationsFilters): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(platformUserInvitations.status, filters.status));
  }
  const search = filters.search?.trim().toLowerCase();
  if (search) {
    const like = `%${search}%`;
    const match = or(ilike(platformUserInvitations.email, like));
    if (match) conditions.push(match);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listPlatformUserInvitations(
  filters: ListPlatformInvitationsFilters = {},
): Promise<PlatformUserInvitationRow[]> {
  await requirePlatformUserInRoles(PLATFORM_USERS_ROLES);

  const where = buildListWhere(filters);
  // Pending first (asc by expiresAt so soonest-to-expire is up top),
  // then everything else newest-first.
  const rows = await db
    .select({
      id: platformUserInvitations.id,
      email: platformUserInvitations.email,
      role: platformUserInvitations.role,
      status: platformUserInvitations.status,
      invitedByPlatformUserId:
        platformUserInvitations.invitedByPlatformUserId,
      invitedByEmail: authUsers.email,
      invitedByName: authUsers.name,
      expiresAt: platformUserInvitations.expiresAt,
      acceptedAt: platformUserInvitations.acceptedAt,
      createdAt: platformUserInvitations.createdAt,
    })
    .from(platformUserInvitations)
    .leftJoin(
      platformUsers,
      eq(platformUsers.id, platformUserInvitations.invitedByPlatformUserId),
    )
    .leftJoin(authUsers, eq(authUsers.id, platformUsers.authUserId))
    .where(where)
    .orderBy(
      sql`case when ${platformUserInvitations.status} = 'pending' then 0 else 1 end asc`,
      asc(platformUserInvitations.expiresAt),
      desc(platformUserInvitations.createdAt),
    );

  return rows.map(r => ({
    id: r.id,
    email: r.email,
    role: r.role as PlatformUserRole,
    status: r.status as PlatformUserInvitationStatus,
    invitedByPlatformUserId: r.invitedByPlatformUserId,
    invitedByEmail: r.invitedByEmail,
    invitedByName: r.invitedByName,
    expiresAt: r.expiresAt,
    acceptedAt: r.acceptedAt,
    createdAt: r.createdAt,
  }));
}

export async function revokePlatformUserInvitationByAdmin(input: {
  id: string;
}): Promise<{ ok: true }> {
  await requirePlatformUserInRoles(PLATFORM_USERS_ROLES);

  const invitation = await db.query.platformUserInvitations.findFirst({
    where: eq(platformUserInvitations.id, input.id),
  });
  if (!invitation) throw new Error("Invitation not found.");
  if (invitation.status === "accepted") {
    throw new Error(
      "This invitation has been accepted — deactivate the platform user instead.",
    );
  }
  if (invitation.status === "revoked") {
    return { ok: true };
  }

  await db
    .update(platformUserInvitations)
    .set({ status: "revoked" })
    .where(eq(platformUserInvitations.id, input.id));

  recordActionBreadcrumb({
    action: "platform_admin.revoke_platform_invitation",
    data: { id: input.id },
  });

  return { ok: true };
}

export async function resendPlatformUserInvitationByAdmin(input: {
  id: string;
}): Promise<{ ok: true }> {
  const actor = await requirePlatformUserInRoles(PLATFORM_USERS_ROLES);

  const invitation = await db.query.platformUserInvitations.findFirst({
    where: eq(platformUserInvitations.id, input.id),
  });
  if (!invitation) throw new Error("Invitation not found.");
  if (invitation.status !== "pending") {
    throw new Error(
      "Only pending invitations can be resent. Create a new one for accepted, revoked, or expired invites.",
    );
  }

  // Refresh the token + expiresAt so any previously-leaked link stops
  // working when the new email lands.
  const token = randomUUID();
  const expiresAt = invitationExpiryAt({
    configuredDays: NORMALIZED_PENDING_EXPIRY_WINDOW_DAYS,
  });
  await db
    .update(platformUserInvitations)
    .set({ token, expiresAt })
    .where(eq(platformUserInvitations.id, invitation.id));

  recordActionBreadcrumb({
    action: "platform_admin.resend_platform_invitation",
    data: { id: invitation.id },
  });

  const invitedByName = await actorDisplayName(actor.id);
  await sendPlatformInvitationEmail({
    email: invitation.email,
    role: invitation.role as PlatformUserRole,
    token,
    invitedByName,
  });

  return { ok: true };
}

/**
 * Cron-friendly cleanup. Marks pending invitations whose `expires_at` has
 * passed as `expired`. Safe to call from anywhere — we still gate behind a
 * platform user so it can't be triggered from the public surface.
 */
export async function expireOldPlatformInvitations(): Promise<{
  expiredCount: number;
}> {
  await requirePlatformUser();
  const now = new Date();
  const result = await db
    .update(platformUserInvitations)
    .set({ status: "expired" })
    .where(
      and(
        eq(platformUserInvitations.status, "pending"),
        lt(platformUserInvitations.expiresAt, now),
      ),
    )
    .returning({ id: platformUserInvitations.id });
  return { expiredCount: result.length };
}

export async function getPlatformInvitationPreviewByToken(
  token: string,
): Promise<{
  email: string;
  role: PlatformUserRole;
  status: PlatformUserInvitationStatus;
  expiresAt: Date;
} | null> {
  // No platform-user gate — this is called from the public accept route
  // so the recipient can see what they're about to claim before signing
  // in. Returns only display-safe fields.
  const invitation = await loadInvitationByToken(token);
  if (!invitation) return null;
  return {
    email: invitation.email,
    role: invitation.role as PlatformUserRole,
    status: invitation.status as PlatformUserInvitationStatus,
    expiresAt: invitation.expiresAt,
  };
}
