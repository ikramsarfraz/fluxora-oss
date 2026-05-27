import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { portalUsers, userInvitations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { invitationExpiryAt } from "@/lib/invitation-expiry";
import {
  buildTenantAppUrl,
  getRequestTenantHostContextFromHeaders,
} from "@/lib/tenant-host";
import { getCurrentTenant } from "@/modules/core/tenants/services/tenants";
import {
  getLatestAuthSessionIdForUser,
  sendUserInvitationEmail,
  setAuthSessionTenantId,
} from "@/modules/shared/services/auth";
import {
  createPortalUser,
  requireAdminPortalUser,
  type PortalUserRole,
} from "@/modules/shared/services/portal-users";

export type InvitationPreviewFailureReason =
  | "not_found"
  | "expired"
  | "revoked"
  | "already_accepted"
  | "invalid";

export type InvitationPreviewResult =
  | {
      ok: true;
      fullName: string;
      email: string;
      role: PortalUserRole;
    }
  | { ok: false; reason: InvitationPreviewFailureReason };

export async function getInvitationPreview(
  token: string,
): Promise<InvitationPreviewResult> {
  const [row] = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.token, token))
    .limit(1);

  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (row.status === "revoked") {
    return { ok: false, reason: "revoked" };
  }
  if (row.status === "accepted") {
    return { ok: false, reason: "already_accepted" };
  }
  if (row.status === "expired") {
    return { ok: false, reason: "expired" };
  }
  if (row.status !== "pending") {
    return { ok: false, reason: "invalid" };
  }
  if (row.expiresAt < new Date()) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
  };
}


/**
 * After a successful invitation completion, navigate to `redirectUrl`.
 */
export type AcceptInvitationResult = {
  redirectUrl: string;
  forwardHeaders: Headers;
};

/**
 * Sends an email-only magic sign-in link for the invite recipient.
 */
export async function sendInvitationMagicLink(
  input: { token: string },
  options?: { requestHeaders?: Headers },
): Promise<{ ok: true }> {
  const headerBag = options?.requestHeaders ?? new Headers();
  const invitation = await db.query.userInvitations.findFirst({
    where: eq(userInvitations.token, input.token),
    with: { tenant: true },
  });

  if (!invitation) {
    throw new Error("Invitation not found");
  }
  if (invitation.status === "revoked") {
    throw new Error("This invitation was revoked.");
  }
  if (invitation.status === "accepted") {
    throw new Error("This invitation was already accepted.");
  }
  if (invitation.status !== "pending") {
    throw new Error("This invitation is no longer valid");
  }
  if (invitation.expiresAt < new Date()) {
    throw new Error("This invitation has expired");
  }
  if (!invitation.tenant.isActive) {
    throw new Error("This workspace is not available.");
  }

  const requestCtx = getRequestTenantHostContextFromHeaders(headerBag);
  const invitePageUrl = buildTenantAppUrl({
    slug: invitation.tenant.slug,
    pathname: `/invite/${invitation.token}`,
    searchParams: { from: "ml" },
    context: requestCtx,
  });

  await auth.api.signInMagicLink({
    body: {
      email: invitation.email.trim().toLowerCase(),
      ...(invitation.fullName.trim()
        ? { name: invitation.fullName.trim() }
        : {}),
      callbackURL: invitePageUrl,
      newUserCallbackURL: invitePageUrl,
      errorCallbackURL: buildTenantAppUrl({
        slug: invitation.tenant.slug,
        pathname: "/login",
        searchParams: { inviteError: "magic_link" },
        context: requestCtx,
      }),
    },
    headers: headerBag,
  });

  return { ok: true };
}

/**
 * Finalize membership once the Better Auth session user matches the invitation email.
 */
export async function completeInvitationFromSession(
  input: { token: string },
  options?: { requestHeaders?: Headers },
): Promise<AcceptInvitationResult> {
  const headerBag = options?.requestHeaders ?? new Headers();
  const session = await auth.api.getSession({ headers: headerBag });
  if (!session?.user?.email) {
    throw new Error("Sign in required.");
  }

  const requestCtx = getRequestTenantHostContextFromHeaders(headerBag);

  const invitation = await db.query.userInvitations.findFirst({
    where: eq(userInvitations.token, input.token),
    with: { tenant: true },
  });

  if (!invitation) {
    throw new Error("Invitation not found");
  }
  if (invitation.status === "revoked") {
    throw new Error("This invitation was revoked.");
  }
  if (invitation.status === "accepted") {
    throw new Error("This invitation was already accepted.");
  }
  if (invitation.status !== "pending") {
    throw new Error("This invitation is no longer valid");
  }
  if (invitation.expiresAt < new Date()) {
    throw new Error("This invitation has expired");
  }
  if (!invitation.tenant.isActive) {
    throw new Error("This workspace is not available.");
  }

  const tenantSlug = invitation.tenant.slug;
  const dashboardUrl = buildTenantAppUrl({
    slug: tenantSlug,
    pathname: "/dashboard",
    context: requestCtx,
  });

  const sessEmail = session.user.email.trim().toLowerCase();
  const inviteEmail = invitation.email.trim().toLowerCase();
  if (sessEmail !== inviteEmail) {
    throw new Error("Sign in as the invited email address to continue.");
  }

  const markAccepted = async () => {
    await db
      .update(userInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitation.id));
  };

  const alreadyMember = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.tenantId, invitation.tenantId),
      sql`lower(${portalUsers.email}) = ${inviteEmail}`,
    ),
  });

  if (alreadyMember) {
    if (alreadyMember.authUserId !== session.user.id) {
      throw new Error(
        "This workspace already uses this email with a different login. Contact your administrator.",
      );
    }
    await markAccepted();
    return {
      redirectUrl: dashboardUrl,
      forwardHeaders: new Headers(),
    };
  }

  await createPortalUser({
    tenantId: invitation.tenantId,
    authUserId: session.user.id,
    fullName: invitation.fullName,
    email: invitation.email,
    role: invitation.role,
  });

  const sessionId = await getLatestAuthSessionIdForUser(session.user.id);
  if (sessionId) {
    await setAuthSessionTenantId(sessionId, invitation.tenantId);
  }

  await markAccepted();

  return {
    redirectUrl: dashboardUrl,
    forwardHeaders: new Headers(),
  };
}

/** @deprecated Use `completeInvitationFromSession`. */
export async function acceptInvitation(
  input: { token: string; password?: string },
  options?: { requestHeaders?: Headers },
): Promise<AcceptInvitationResult> {
  void input.password;
  return completeInvitationFromSession(
    { token: input.token },
    { requestHeaders: options?.requestHeaders },
  );
}

/**
 * If the request host is not the invite's tenant (e.g. root or wrong
 * tenant subdomain), returns the URL to redirect to. Otherwise `null`.
 */
export async function getInviteCanonicalRedirectUrl(
  token: string,
  requestHeaders: Headers,
): Promise<string | null> {
  const context = getRequestTenantHostContextFromHeaders(requestHeaders);
  const invitation = await db.query.userInvitations.findFirst({
    where: eq(userInvitations.token, token),
    with: { tenant: true },
  });
  if (!invitation?.tenant.isActive) {
    return null;
  }
  const expectedSlug = invitation.tenant.slug;
  if (context.isPlatformAdminHost) {
    return buildTenantAppUrl({
      slug: expectedSlug,
      pathname: `/invite/${token}`,
      context,
    });
  }
  if (context.isRootHost) {
    return buildTenantAppUrl({
      slug: expectedSlug,
      pathname: `/invite/${token}`,
      context,
    });
  }
  if (context.tenantSlug && context.tenantSlug !== expectedSlug) {
    return buildTenantAppUrl({
      slug: expectedSlug,
      pathname: `/invite/${token}`,
      context,
    });
  }
  return null;
}

export async function resendUserInvitationByAdmin(input: {
  invitationId: string;
}): Promise<{ success: true }> {
  const current = await requireAdminPortalUser();
  const [row] = await db
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.id, input.invitationId),
        eq(userInvitations.tenantId, current.tenantId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error("Invitation not found.");
  }
  if (row.status !== "pending") {
    throw new Error("Only pending invitations can be resent.");
  }

  const newToken = randomUUID();
  // Per-tenant configurable window (#236). Resends inherit the tenant's
  // current config so a tightened cap takes effect immediately on the
  // next resend, not only on new invites.
  const tenant = await getCurrentTenant();
  const expiresAt = invitationExpiryAt({
    configuredDays: tenant.invitationExpiryDays,
  });

  await db
    .update(userInvitations)
    .set({
      token: newToken,
      expiresAt,
      status: "pending",
    })
    .where(eq(userInvitations.id, row.id));

  await sendUserInvitationEmail({
    email: row.email,
    fullName: row.fullName,
    token: newToken,
    role: row.role,
    invitedByUserId: row.invitedByUserId,
  });

  return { success: true };
}

export async function revokeUserInvitationByAdmin(input: {
  invitationId: string;
}): Promise<{ success: true }> {
  const current = await requireAdminPortalUser();
  const [row] = await db
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.id, input.invitationId),
        eq(userInvitations.tenantId, current.tenantId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error("Invitation not found.");
  }
  if (row.status !== "pending") {
    throw new Error("Only pending invitations can be revoked.");
  }

  await db
    .update(userInvitations)
    .set({ status: "revoked" })
    .where(eq(userInvitations.id, row.id));

  return { success: true };
}

/** All pending row invitations (admin-only), scoped to the current tenant. */
export async function listPendingInvitationsForAdmin() {
  const current = await requireAdminPortalUser();
  return await db
    .select()
    .from(userInvitations)
    .where(and(eq(userInvitations.tenantId, current.tenantId), eq(userInvitations.status, "pending")))
    .orderBy(desc(userInvitations.createdAt));
}

export type PendingInvitationListItem = Awaited<
  ReturnType<typeof listPendingInvitationsForAdmin>
>[number];

export async function getTenantHostInvitationRedirect(input: {
  tenantSlug: string;
  token: string;
}) {
  const invitation = await db.query.userInvitations.findFirst({
    where: eq(userInvitations.token, input.token),
    with: {
      tenant: true,
    },
  });

  if (!invitation) {
    return { ok: false as const, reason: "not_found" as const };
  }

  if (invitation.tenant.slug !== input.tenantSlug) {
    return { ok: false as const, reason: "tenant_mismatch" as const };
  }

  if (!invitation.tenant.isActive) {
    return { ok: false as const, reason: "tenant_inactive" as const };
  }

  if (invitation.status === "revoked") {
    return { ok: false as const, reason: "revoked" as const };
  }
  if (invitation.status === "accepted") {
    return { ok: false as const, reason: "used" as const };
  }
  if (invitation.status !== "pending") {
    return { ok: false as const, reason: "used" as const };
  }

  if (invitation.expiresAt < new Date()) {
    return { ok: false as const, reason: "expired" as const };
  }

  return { ok: true as const, token: invitation.token };
}
