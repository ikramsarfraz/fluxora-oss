import { isAPIError } from "better-auth/api";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { user as authUser } from "@/db/auth-schema";
import { portalUsers, userInvitations } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  buildTenantAppUrl,
  getRequestTenantHostContextFromHeaders,
} from "@/lib/tenant-host";
import { sendUserInvitationEmail, signUp } from "@/services/auth";
import {
  createPortalUser,
  requireAdminPortalUser,
  type PortalUserRole,
} from "@/services/portal-users";

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

export async function acceptInvitation(
  input: { token: string; password: string },
  options?: { requestHeaders: Headers },
) {
  const requestHeaders = options?.requestHeaders;
  const [invitation] = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.token, input.token))
    .limit(1);

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

  const alreadyMember = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.tenantId, invitation.tenantId),
      sql`lower(${portalUsers.email}) = ${invitation.email.toLowerCase()}`,
    ),
  });
  if (alreadyMember) {
    await db
      .update(userInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitation.id));
    return { success: true as const };
  }

  let authUserId: string | null = null;
  const headerBag = requestHeaders ?? new Headers();

  try {
    try {
      const signup = await signUp({
        name: invitation.fullName,
        email: invitation.email,
        password: input.password,
      });
      authUserId = signup?.user?.id ?? null;
    } catch (e) {
      if (!isAPIError(e)) {
        throw e;
      }

      const [existingAuthUser] = await db
        .select()
        .from(authUser)
        .where(
          sql`lower(${authUser.email}) = ${invitation.email.toLowerCase()}`,
        )
        .limit(1);

      if (!existingAuthUser) {
        throw new Error(e.message || "Could not create account.");
      }

      try {
        await auth.api.signInEmail({
          body: {
            email: invitation.email,
            password: input.password,
            rememberMe: true,
          },
          headers: headerBag,
        });
      } catch (signInErr) {
        if (!isAPIError(signInErr)) {
          throw signInErr;
        }
        const msg = signInErr.message?.toLowerCase() ?? "";
        if (
          msg.includes("credential") ||
          msg.includes("email and password")
        ) {
          throw new Error(
            "This account may use Google (or another provider) to sign in. Open sign-in and use that method, or set a password for email sign-in first.",
          );
        }
        throw new Error(
          signInErr.message ||
            "Incorrect password. Use the password for this email, or reset it from the sign-in page.",
        );
      }
      authUserId = existingAuthUser.id;
    }

    if (!authUserId) {
      throw new Error("Sign up did not return a user id.");
    }

    await createPortalUser({
      tenantId: invitation.tenantId,
      authUserId,
      fullName: invitation.fullName,
      email: invitation.email,
      role: invitation.role,
    });
  } catch (e) {
    if (isAPIError(e)) {
      throw new Error(e.message || "Could not create account.");
    }
    throw e;
  }

  await db
    .update(userInvitations)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
    })
    .where(eq(userInvitations.id, invitation.id));

  return { success: true as const };
}

/**
 * If the request host is not the invite&apos;s tenant (e.g. root or wrong
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
  const expiresAt = addDays(new Date(), 7);

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

/** All pending row invitations (admin-only), including past `expiresAt`. */
export async function listPendingInvitationsForAdmin() {
  await requireAdminPortalUser();
  return await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.status, "pending"))
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
