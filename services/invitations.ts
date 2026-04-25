import { isAPIError } from "better-auth/api";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { user as authUser } from "@/db/auth-schema";
import { portalUsers, userInvitations } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  buildRootHostHeadersForAuth,
  buildTenantAppUrl,
  getRequestTenantHostContextFromHeaders,
} from "@/lib/tenant-host";
import {
  getLatestAuthSessionIdForUser,
  sendUserInvitationEmail,
  setAuthSessionTenantId,
  signUp,
} from "@/services/auth";
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

const OAUTH_ONLY_INVITE =
  "Use your existing sign-in method or contact your admin.";

type SignInWithReturnHeaders = (input: {
  body: { email: string; password: string; rememberMe: boolean };
  headers: Headers;
  returnHeaders: true;
}) => Promise<unknown>;

function forwardHeadersFromSignInResult(result: unknown): Headers {
  const out = new Headers();
  if (!result || typeof result !== "object" || !("headers" in result)) {
    return out;
  }
  const h = (result as { headers?: Headers }).headers;
  if (!h) {
    return out;
  }
  const list =
    typeof h.getSetCookie === "function" ? h.getSetCookie() : [];
  for (const c of list) {
    out.append("set-cookie", c);
  }
  return out;
}

function throwIfOAuthOrAuthSignInError(e: unknown): never {
  if (!isAPIError(e)) {
    throw e;
  }
  const msg = (e.message ?? "").toLowerCase();
  if (msg.includes("credential") || msg.includes("email and password")) {
    throw new Error(OAUTH_ONLY_INVITE);
  }
  throw new Error(
    e.message || "Sign-in failed. Check your password and try again.",
  );
}

/**
 * After a successful accept, the client should navigate to `redirectUrl`.
 * `forwardHeaders` should be merged on the response so the browser stores the
 * session cookie when sign-in succeeded.
 */
export type AcceptInvitationResult = {
  redirectUrl: string;
  forwardHeaders: Headers;
};

export async function acceptInvitation(
  input: { token: string; password: string },
  options?: { requestHeaders: Headers },
): Promise<AcceptInvitationResult> {
  const requestHeaders = options?.requestHeaders;
  const headerBag = requestHeaders ?? new Headers();
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
  const postInviteLoginUrl = buildTenantAppUrl({
    slug: tenantSlug,
    pathname: "/login",
    context: requestCtx,
    searchParams: {
      email: invitation.email,
      inviteAccepted: "1",
    },
  });

  const markAccepted = async () => {
    await db
      .update(userInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitation.id));
  };

  const signInEmailCollectHeaders = async (h: Headers) => {
    const fn = auth.api.signInEmail as SignInWithReturnHeaders;
    const raw = await fn({
      body: {
        email: invitation.email,
        password: input.password,
        rememberMe: true,
      },
      headers: h,
      returnHeaders: true,
    });
    return forwardHeadersFromSignInResult(raw);
  };

  const alreadyMember = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.tenantId, invitation.tenantId),
      sql`lower(${portalUsers.email}) = ${invitation.email.toLowerCase()}`,
    ),
  });
  if (alreadyMember) {
    await markAccepted();
    try {
      const fh = await signInEmailCollectHeaders(headerBag);
      return { redirectUrl: dashboardUrl, forwardHeaders: fh };
    } catch {
      return { redirectUrl: postInviteLoginUrl, forwardHeaders: new Headers() };
    }
  }

  const signUpRes = await signUp({
    name: invitation.fullName,
    email: invitation.email,
    password: input.password,
  });
  if (!signUpRes?.user?.id) {
    throw new Error("Sign up did not return a user id.");
  }

  const dbUser = await db.query.user.findFirst({
    where: sql`lower(${authUser.email}) = ${invitation.email.toLowerCase()}`,
  });
  if (!dbUser) {
    throw new Error("Could not load your account after sign up.");
  }

  const isObfuscatedExistingAccount = dbUser.id !== signUpRes.user.id;
  if (isObfuscatedExistingAccount) {
    const rootH = buildRootHostHeadersForAuth(headerBag);
    let forward: Headers;
    try {
      forward = await signInEmailCollectHeaders(rootH);
    } catch (e) {
      throwIfOAuthOrAuthSignInError(e);
    }
    await createPortalUser({
      tenantId: invitation.tenantId,
      authUserId: dbUser.id,
      fullName: invitation.fullName,
      email: invitation.email,
      role: invitation.role,
    });
    const sessionId = await getLatestAuthSessionIdForUser(dbUser.id);
    if (sessionId) {
      await setAuthSessionTenantId(sessionId, invitation.tenantId);
    }
    await markAccepted();
    return { redirectUrl: dashboardUrl, forwardHeaders: forward };
  }

  await createPortalUser({
    tenantId: invitation.tenantId,
    authUserId: dbUser.id,
    fullName: invitation.fullName,
    email: invitation.email,
    role: invitation.role,
  });
  await markAccepted();

  try {
    const fh = await signInEmailCollectHeaders(headerBag);
    return { redirectUrl: dashboardUrl, forwardHeaders: fh };
  } catch (e) {
    if (!isAPIError(e)) {
      throw e;
    }
    const m = (e.message ?? "").toLowerCase();
    if (
      m.includes("verif") ||
      m.includes("forbidden")
    ) {
      return { redirectUrl: postInviteLoginUrl, forwardHeaders: new Headers() };
    }
    throw e;
  }
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
