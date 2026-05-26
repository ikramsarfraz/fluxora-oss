import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { and, desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { session as authSession, user as authUser } from "@/db/auth-schema";
import { platformUsers, portalUsers, tenants, userInvitations } from "@/db/schema";
import { resend, emailFrom } from "@/lib/email";
import {
  createEmailDestinationSelectToken,
  parseEmailDestinationSelectToken,
} from "@/lib/email-destination-select-flow";
import {
  composeFullName,
} from "@/lib/user-display-name";
import {
  createGoogleAuthFlowToken,
  isGoogleAuthEnabled,
  normalizeGoogleReturnTo,
  parseGoogleAuthFlowToken,
  type GoogleAuthMode,
  type GoogleAuthSignupType,
} from "@/lib/google-auth-flow";
import {
  ensureMemberTenantLoginUrl,
  ensurePlatformAdminMemberLoginUrl,
} from "@/lib/discover-login-urls";
import {
  mapLoginDiscoveryToTenantChooserDestinations,
  type TenantChooserDestination,
} from "@/lib/tenant-chooser-destinations";
import { InviteUserEmail } from "@/emails/invite-user";
import {
  buildRootAppUrl,
  buildPlatformAdminAppUrl,
  buildTenantAppUrl,
  getRequestTenantHostContextFromHeaders,
  type RequestTenantHostContext,
  isPlatformAdminHostname,
  isReservedTenantSlug,
  slugifyTenantName,
} from "@/lib/tenant-host";
import { getCurrentTenant, getTenantBySlug } from "@/modules/core/tenants/services/tenants";
import { createPortalUser, type PortalUserRole } from "@/modules/shared/services/portal-users";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Root sign-in passes `callbackUrl=/` for the marketing home. For tenant
 * sign-in links, that must resolve to the ERP entry (`/dashboard`), not `/`
 * (which on the tenant host is still special-cased for unauthenticated users).
 */
function callbackUrlForTenantLogin(requested: string | null | undefined) {
  const v = (requested ?? "/").trim() || "/";
  if (v === "/") {
    return "/dashboard";
  }
  return v;
}

function buildTenantReturnUrl(args: {
  slug: string;
  returnTo: string;
  context: Parameters<typeof buildTenantAppUrl>[0]["context"];
}) {
  const parsed = new URL(
    normalizeGoogleReturnTo(args.returnTo),
    "http://tenant.local",
  );
  if (parsed.pathname === "/" && parsed.search === "") {
    parsed.pathname = "/dashboard";
  }

  return buildTenantAppUrl({
    slug: args.slug,
    pathname: parsed.pathname,
    searchParams: parsed.searchParams,
    context: args.context,
  });
}

function getGoogleFlowRequestContext(args: {
  flow: ReturnType<typeof parseGoogleAuthFlowToken>;
  fallbackContext: RequestTenantHostContext;
}): RequestTenantHostContext {
  if (
    !args.flow.requestHost ||
    !args.flow.requestHostname ||
    !args.flow.requestProtocol ||
    !args.flow.requestRootDomain
  ) {
    return args.fallbackContext;
  }

  const isPlatformAdminHost = isPlatformAdminHostname(
    args.flow.requestHostname,
    args.flow.requestRootDomain,
  );
  return {
    host: args.flow.requestHost,
    hostname: args.flow.requestHostname,
    port: args.flow.requestPort ?? null,
    protocol: args.flow.requestProtocol,
    rootDomain: args.flow.requestRootDomain,
    hostType: isPlatformAdminHost
      ? "platform-admin"
      : args.flow.tenantSlug
        ? "tenant"
        : "root",
    tenantSlug: args.flow.tenantSlug ?? null,
    isRootHost: !args.flow.tenantSlug && !isPlatformAdminHost,
    isTenantHost: Boolean(args.flow.tenantSlug),
    isPlatformAdminHost,
  };
}

type GoogleStartPayload = {
  callbackURL: string;
  newUserCallbackURL: string;
  errorCallbackURL: string;
  requestSignUp: boolean;
  additionalData: Record<string, string>;
};

async function ensureTenantSlugAvailable(slug: string) {
  if (!slug.trim()) {
    throw new Error("Please choose a workspace URL.");
  }

  if (isReservedTenantSlug(slug)) {
    throw new Error("That workspace URL is reserved. Please choose another.");
  }

  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });

  if (existing) {
    throw new Error("That workspace URL is already taken.");
  }
}

async function createUniquePersonalTenantSlug(baseInput: string) {
  const baseSlug = slugifyTenantName(baseInput);
  let candidate = baseSlug;
  let suffix = 2;

  // Keep this simple and deterministic for v1.
  for (;;) {
    if (isReservedTenantSlug(candidate)) {
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
      continue;
    }

    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.slug, candidate),
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function listActiveTenantMembershipsForAuthUser(authUserId: string) {
  return db.query.portalUsers.findMany({
    where: and(
      eq(portalUsers.authUserId, authUserId),
      eq(portalUsers.isActive, true),
    ),
    with: {
      tenant: true,
    },
  });
}

async function setTenantOnSession(sessionId: string, tenantId: string | null) {
  await db
    .update(authSession)
    .set({
      tenantId,
      updatedAt: new Date(),
    })
    .where(eq(authSession.id, sessionId));
}

/** Exposed for invite acceptance after root sign-in (before session had tenant). */
export async function setAuthSessionTenantId(
  sessionId: string,
  tenantId: string,
): Promise<void> {
  await setTenantOnSession(sessionId, tenantId);
}

export async function getLatestAuthSessionIdForUser(
  authUserId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: authSession.id })
    .from(authSession)
    .where(eq(authSession.userId, authUserId))
    .orderBy(desc(authSession.createdAt))
    .limit(1);
  return row?.id ?? null;
}

async function getActivePlatformUserForAuthUser(authUserId: string) {
  return (
    (await db.query.platformUsers.findFirst({
      where: and(
        eq(platformUsers.authUserId, authUserId),
        eq(platformUsers.isActive, true),
      ),
    })) ?? null
  );
}

function buildAuthenticatedSelectDestinationUrl(args: {
  returnTo?: string | null;
  tenantSlug?: string;
  destination?: "platform_admin";
  context: RequestTenantHostContext;
}) {
  return buildRootAppUrl({
    pathname: "/select-destination",
    searchParams: {
      ...(args.returnTo ? { returnTo: normalizeGoogleReturnTo(args.returnTo) } : {}),
      ...(args.tenantSlug ? { tenant: args.tenantSlug } : {}),
      ...(args.destination ? { destination: args.destination } : {}),
    },
    context: args.context,
  });
}

async function createBusinessTenantForAuthUser(input: {
  authUserId: string;
  fullName: string;
  email: string;
  tenantName: string;
  tenantSlug: string;
}) {
  const tenantName = input.tenantName.trim();
  const tenantSlug = slugifyTenantName(input.tenantSlug);

  if (!tenantName) {
    throw new Error("Please enter a tenant name.");
  }

  await ensureTenantSlugAvailable(tenantSlug);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: tenantName,
      slug: tenantSlug,
      tenantType: "business",
      isActive: true,
    })
    .returning();

  if (!tenant) {
    throw new Error("Failed to create tenant.");
  }

  try {
    await createPortalUser({
      tenantId: tenant.id,
      authUserId: input.authUserId,
      fullName: input.fullName,
      email: normalizeEmail(input.email),
      role: "owner",
    });

    return tenant;
  } catch (error) {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
    throw error;
  }
}

async function createSoloTenantForAuthUser(input: {
  authUserId: string;
  fullName: string;
  email: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const tenantName = `${input.fullName.trim() || normalizedEmail}'s Workspace`;
  const tenantSlug = await createUniquePersonalTenantSlug(
    input.fullName.trim() || normalizedEmail.split("@")[0] || "tenant",
  );

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: tenantName,
      slug: tenantSlug,
      tenantType: "solo",
      isActive: true,
    })
    .returning();

  if (!tenant) {
    throw new Error("Failed to create your tenant.");
  }

  try {
    await createPortalUser({
      tenantId: tenant.id,
      authUserId: input.authUserId,
      fullName: input.fullName,
      email: normalizedEmail,
      role: "owner",
    });

    return tenant;
  } catch (error) {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
    throw error;
  }
}

/**
 * Sends a magic sign-in link (creates the user on first use when sign-up is allowed).
 */
export async function sendSignInMagicLink(input: {
  email: string;
  name?: string;
  callbackURL: string;
  newUserCallbackURL?: string;
  errorCallbackURL?: string;
  requestHeaders?: Headers;
}) {
  const h = input.requestHeaders ?? (await headers());
  await auth.api.signInMagicLink({
    body: {
      email: normalizeEmail(input.email),
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      callbackURL: input.callbackURL,
      newUserCallbackURL: input.newUserCallbackURL,
      errorCallbackURL: input.errorCallbackURL,
    },
    headers: h,
  });
}

/**
 * Sends a magic sign-in link (creates the user on first use when sign-up is allowed).
 * Profile and workspace are collected on `/onboarding` after the user verifies their email.
 */
export async function sendRootSignupMagicLink(input: { email: string }) {
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const normalizedEmail = normalizeEmail(input.email);
  const onboardingUrl = buildRootAppUrl({
    pathname: "/onboarding",
    context: requestContext,
  });

  await sendSignInMagicLink({
    email: normalizedEmail,
    callbackURL: onboardingUrl,
    newUserCallbackURL: onboardingUrl,
    errorCallbackURL: buildRootAppUrl({
      pathname: "/signup",
      searchParams: { error: "magic_link" },
      context: requestContext,
    }),
  });

  return { email: normalizedEmail };
}

/** @deprecated Alias for `sendRootSignupMagicLink`. */
export const signUpAccountOnly = sendRootSignupMagicLink;

/** Sends a magic link to sign in to a tenant subdomain (admin “reset password”). */
export async function sendTenantUserMagicLink(input: {
  email: string;
  tenantSlug: string;
  displayNameHint?: string;
}) {
  const requestHeaders = await headers();
  const ctx = getRequestTenantHostContextFromHeaders(requestHeaders);
  const callbackURL = buildTenantAppUrl({
    slug: input.tenantSlug,
    pathname: "/dashboard",
    context: ctx,
  });
  await sendSignInMagicLink({
    email: input.email,
    ...(input.displayNameHint?.trim()
      ? { name: input.displayNameHint.trim() }
      : {}),
    callbackURL,
    newUserCallbackURL: callbackURL,
    errorCallbackURL: buildTenantAppUrl({
      slug: input.tenantSlug,
      pathname: "/login",
      searchParams: { error: "magic_link" },
      context: ctx,
    }),
    requestHeaders,
  });
}

/** Magic-link “forgot password” / sign-in for the current hostname (root, tenant, or platform admin). */
export async function sendMagicLinkForCurrentLoginContext(input: {
  email: string;
}) {
  const requestHeaders = await headers();
  const ctx = getRequestTenantHostContextFromHeaders(requestHeaders);
  const normalizedEmail = normalizeEmail(input.email);

  if (ctx.isPlatformAdminHost) {
    const dash = buildPlatformAdminAppUrl({ pathname: "/admin", context: ctx });
    await sendSignInMagicLink({
      email: normalizedEmail,
      callbackURL: dash,
      newUserCallbackURL: dash,
      errorCallbackURL: buildPlatformAdminAppUrl({
        pathname: "/login",
        searchParams: { error: "magic_link" },
        context: ctx,
      }),
      requestHeaders,
    });
    return;
  }

  if (ctx.isTenantHost && ctx.tenantSlug) {
    await sendTenantUserMagicLink({ email: normalizedEmail, tenantSlug: ctx.tenantSlug });
    return;
  }

  await sendSignInMagicLink({
    email: normalizedEmail,
    callbackURL: buildAuthenticatedSelectDestinationUrl({ context: ctx }),
    newUserCallbackURL: buildRootAppUrl({
      pathname: "/onboarding",
      context: ctx,
    }),
    errorCallbackURL: buildRootAppUrl({
      pathname: "/login",
      searchParams: { error: "magic_link" },
      context: ctx,
    }),
    requestHeaders,
  });
}

type TenantDiscoveryResult = {
  type: "tenant";
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: PortalUserRole;
  loginUrl: string;
};

type PlatformAdminDiscoveryResult = {
  type: "platform_admin";
  name: "Platform Admin";
  role: string;
  loginUrl: string;
};

export type LoginDestinationDiscoveryItem =
  | TenantDiscoveryResult
  | PlatformAdminDiscoveryResult;

export type AccessibleDestination =
  | {
      type: "tenant";
      id: string;
      name: string;
      slug: string;
      role: PortalUserRole;
      targetUrl: string;
    }
  | {
      type: "platform_admin";
      id: string;
      name: "Platform Admin";
      slug: "admin";
      role: string;
      targetUrl: string;
    };

export type GoogleAuthStartInput = {
  mode: GoogleAuthMode;
  returnTo?: string | null;
  tenantSlug?: string | null;
  tenantName?: string | null;
  signupType?: GoogleAuthSignupType | null;
};

export function getGoogleAuthAvailability() {
  return isGoogleAuthEnabled();
}

export async function prepareGoogleAuthStart(
  input: GoogleAuthStartInput,
): Promise<GoogleStartPayload> {
  if (!isGoogleAuthEnabled()) {
    throw new Error("Google authentication is not configured.");
  }

  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const flowToken = createGoogleAuthFlowToken({
    mode: input.mode,
    returnTo: normalizeGoogleReturnTo(input.returnTo),
    tenantSlug: input.tenantSlug ? slugifyTenantName(input.tenantSlug) : null,
    tenantName: input.tenantName?.trim() || null,
    signupType: input.signupType ?? null,
    requestHost: requestContext.host,
    requestHostname: requestContext.hostname,
    requestPort: requestContext.port,
    requestProtocol: requestContext.protocol,
    requestRootDomain: requestContext.rootDomain,
  });

  const callbackURL = buildRootAppUrl({
    pathname: "/google/complete",
    searchParams: { flow: flowToken },
    context: requestContext,
  });

  const errorTarget =
    input.mode === "signup"
      ? buildRootAppUrl({
          pathname: "/signup",
          searchParams: { oauthError: "google" },
          context: requestContext,
        })
      : input.tenantSlug
        ? buildTenantAppUrl({
            slug: input.tenantSlug,
            pathname: "/login",
            searchParams: { error: "google" },
            context: requestContext,
          })
        : buildRootAppUrl({
            pathname: "/login",
            searchParams: { oauthError: "google" },
            context: requestContext,
          });

  return {
    callbackURL,
    newUserCallbackURL: callbackURL,
    errorCallbackURL: errorTarget,
    requestSignUp: input.mode === "signup",
    additionalData: {
      tenantAuthFlow: flowToken,
    },
  };
}

export async function discoverTenantsForEmail(input: {
  email: string;
  callbackUrl?: string | null;
}): Promise<LoginDestinationDiscoveryItem[]> {
  const requestHeaders = await headers();
  const requestContext = getRequestTenantHostContextFromHeaders(requestHeaders);
  const normalizedEmail = normalizeEmail(input.email);

  const [authRecord] = await db
    .select()
    .from(authUser)
    .where(sql`lower(${authUser.email}) = ${normalizedEmail}`)
    .limit(1);

  if (!authRecord) {
    return [];
  }

  const memberships = await db.query.portalUsers.findMany({
    where: and(
      eq(portalUsers.authUserId, authRecord.id),
      eq(portalUsers.isActive, true),
    ),
    with: {
      tenant: true,
    },
  });

  const tenantDestinations = memberships
    .filter(membership => membership.tenant?.isActive)
    .map(membership => {
      const cb = callbackUrlForTenantLogin(input.callbackUrl);
      const loginUrl = ensureMemberTenantLoginUrl({
        loginUrl: buildTenantAppUrl({
          slug: membership.tenant.slug,
          pathname: "/login",
          searchParams: {
            email: normalizedEmail,
            callbackUrl: cb,
          },
          context: requestContext,
        }),
        tenantSlug: membership.tenant.slug,
        email: normalizedEmail,
        callbackUrl: cb,
        context: requestContext,
      });
      return {
        type: "tenant" as const,
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        tenantSlug: membership.tenant.slug,
        role: membership.role,
        loginUrl,
      };
    })
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName));

  const platformUser = await db.query.platformUsers.findFirst({
    where: and(
      eq(platformUsers.authUserId, authRecord.id),
      eq(platformUsers.isActive, true),
    ),
  });

  const platformDestination: PlatformAdminDiscoveryResult[] = platformUser
    ? [
        {
          type: "platform_admin",
          name: "Platform Admin",
          role: platformUser.role,
          loginUrl: ensurePlatformAdminMemberLoginUrl({
            loginUrl: buildPlatformAdminAppUrl({
              pathname: "/login",
              searchParams: {
                email: normalizedEmail,
                callbackUrl: "/admin",
              },
              context: requestContext,
            }),
            email: normalizedEmail,
            context: requestContext,
          }),
        },
      ]
    : [];

  return [...tenantDestinations, ...platformDestination];
}

export type StartEmailDestinationSelectionResult =
  | { ok: true; kind: "single"; loginUrl: string }
  | { ok: true; kind: "choose"; selectUrl: string }
  | { ok: false; reason: "no_destinations" };

/**
 * After user enters email on the root sign-in page: discover destinations and
 * either send them to the only login URL, or to /select-destination?emailSelect=…
 * when multiple (same full-page chooser as Google).
 */
export async function startEmailDestinationSelection(input: {
  email: string;
  callbackUrl?: string | null;
}): Promise<StartEmailDestinationSelectionResult> {
  const discovered = await discoverTenantsForEmail(input);
  if (discovered.length === 0) {
    return { ok: false, reason: "no_destinations" };
  }
  if (discovered.length === 1) {
    const only = discovered[0];
    const handoffContext = getRequestTenantHostContextFromHeaders(await headers());
    const handoffToken = createEmailDestinationSelectToken({
      email: input.email,
      callbackUrl: input.callbackUrl?.trim() || null,
    });
    if (only.type === "tenant") {
      return {
        ok: true,
        kind: "single",
        loginUrl: buildRootAppUrl({
          pathname: "/select-destination",
          searchParams: {
            emailSelect: handoffToken,
            tenant: only.tenantSlug,
          },
          context: handoffContext,
        }),
      };
    }
    return {
      ok: true,
      kind: "single",
      loginUrl: buildRootAppUrl({
        pathname: "/select-destination",
        searchParams: {
          emailSelect: handoffToken,
          destination: "platform_admin",
        },
        context: handoffContext,
      }),
    };
  }

  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const token = createEmailDestinationSelectToken({
    email: input.email,
    callbackUrl: input.callbackUrl?.trim() || null,
  });
  const selectUrl = buildRootAppUrl({
    pathname: "/select-destination",
    searchParams: { emailSelect: token },
    context: requestContext,
  });

  return { ok: true, kind: "choose", selectUrl };
}

/**
 * Resolves the email multi-destination chooser. Re-discovers from DB so
 * continue URLs stay trustworthy.
 */
export async function loadEmailDestinationSelectView(
  emailSelectToken: string,
): Promise<
  { view: "redirect"; url: string } | { view: "choose"; destinations: TenantChooserDestination[] }
> {
  const { email, callbackUrl } = parseEmailDestinationSelectToken(
    emailSelectToken,
  );
  const list = await discoverTenantsForEmail({ email, callbackUrl });
  if (list.length === 0) {
    throw new Error("EMAIL_SELECT_EMPTY");
  }
  const ctx = getRequestTenantHostContextFromHeaders(await headers());
  if (list.length === 1) {
    const only = list[0];
    if (only.type === "tenant") {
      return {
        view: "redirect",
        url: buildRootAppUrl({
          pathname: "/select-destination",
          searchParams: {
            emailSelect: emailSelectToken,
            tenant: only.tenantSlug,
          },
          context: ctx,
        }),
      };
    }
    return {
      view: "redirect",
      url: buildRootAppUrl({
        pathname: "/select-destination",
        searchParams: {
          emailSelect: emailSelectToken,
          destination: "platform_admin",
        },
        context: ctx,
      }),
    };
  }
  return {
    view: "choose",
    destinations: mapLoginDiscoveryToTenantChooserDestinations(
      list,
      ctx,
      emailSelectToken,
    ),
  };
}

/**
 * Finishes the email-destination flow when a tenant is selected (mirrors
 * `completeGoogleTenantSelection`). If there is a matching logged-in user,
 * sets `tenantId` on the session and returns the tenant dashboard URL. If not,
 * returns that tenant’s sign-in page.
 */
export async function completeEmailSelectTenantHandoff(input: {
  emailSelectToken: string;
  tenantSlug: string;
}): Promise<string> {
  const { email, callbackUrl } = parseEmailDestinationSelectToken(
    input.emailSelectToken,
  );
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const session = await auth.api.getSession({ headers: await headers() });
  const cb = callbackUrlForTenantLogin(callbackUrl);
  const tenant = await getTenantBySlug(input.tenantSlug);
  if (!tenant) {
    throw new Error("Tenant not found.");
  }

  const loginFallback = () =>
    ensureMemberTenantLoginUrl({
      loginUrl: buildTenantAppUrl({
        slug: tenant.slug,
        pathname: "/login",
        searchParams: { email, callbackUrl: cb },
        context: requestContext,
      }),
      tenantSlug: tenant.slug,
      email,
      callbackUrl: cb,
      context: requestContext,
    });

  if (!session?.user?.id) {
    return loginFallback();
  }
  if (normalizeEmail(session.user.email ?? "") !== email) {
    return loginFallback();
  }
  const membership = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.authUserId, session.user.id),
      eq(portalUsers.tenantId, tenant.id),
      eq(portalUsers.isActive, true),
    ),
  });
  if (!membership) {
    return loginFallback();
  }
  await setTenantOnSession(session.session.id, tenant.id);
  return buildTenantReturnUrl({
    slug: tenant.slug,
    context: requestContext,
    returnTo: normalizeGoogleReturnTo(cb),
  });
}

/**
 * Finishes the email-destination flow for platform admin (see
 * `completeGooglePlatformAdminSelection`). With a valid session, returns
 * `/admin` on the platform host; otherwise the platform login URL.
 */
export async function completeEmailSelectPlatformHandoff(input: {
  emailSelectToken: string;
}): Promise<string> {
  const { email } = parseEmailDestinationSelectToken(input.emailSelectToken);
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const session = await auth.api.getSession({ headers: await headers() });

  const loginFallback = () =>
    ensurePlatformAdminMemberLoginUrl({
      loginUrl: buildPlatformAdminAppUrl({
        pathname: "/login",
        searchParams: { email, callbackUrl: "/admin" },
        context: requestContext,
      }),
      email,
      context: requestContext,
    });

  if (!session?.user?.id) {
    return loginFallback();
  }
  if (normalizeEmail(session.user.email ?? "") !== email) {
    return loginFallback();
  }
  const platformUser = await getActivePlatformUserForAuthUser(session.user.id);
  if (!platformUser) {
    return loginFallback();
  }
  return buildPlatformAdminAppUrl({
    pathname: "/admin",
    context: requestContext,
  });
}

export async function getAccessibleDestinationsForAuthUser(
  authUserId: string,
): Promise<AccessibleDestination[]> {
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const memberships = await listActiveTenantMembershipsForAuthUser(authUserId);
  const tenantDestinations: AccessibleDestination[] = memberships
    .filter(membership => membership.tenant?.isActive)
    .map(membership => ({
      type: "tenant" as const,
      id: membership.tenantId,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      role: membership.role,
      targetUrl: buildTenantAppUrl({
        slug: membership.tenant.slug,
        pathname: "/dashboard",
        context: requestContext,
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const platformUser = await db.query.platformUsers.findFirst({
    where: and(
      eq(platformUsers.authUserId, authUserId),
      eq(platformUsers.isActive, true),
    ),
  });

  if (!platformUser) {
    return tenantDestinations;
  }

  return [
    ...tenantDestinations,
    {
      type: "platform_admin",
      id: platformUser.id,
      name: "Platform Admin",
      slug: "admin",
      role: platformUser.role,
      targetUrl: buildPlatformAdminAppUrl({
        pathname: "/admin",
        context: requestContext,
      }),
    },
  ];
}

export async function loadAuthenticatedDestinationSelectView(input: {
  authUserId: string;
  sessionId: string;
  returnTo?: string | null;
}): Promise<
  { view: "redirect"; url: string } | { view: "choose"; destinations: TenantChooserDestination[] }
> {
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const memberships = await listActiveTenantMembershipsForAuthUser(input.authUserId);
  const activeMemberships = memberships.filter(membership => membership.tenant?.isActive);
  const platformUser = await getActivePlatformUserForAuthUser(input.authUserId);
  const normalizedReturnTo = normalizeGoogleReturnTo(input.returnTo);
  const destinationCount = activeMemberships.length + (platformUser ? 1 : 0);

  if (destinationCount === 0) {
    return {
      view: "redirect",
      url: buildRootAppUrl({
        pathname: "/onboarding",
        context: requestContext,
      }),
    };
  }

  if (destinationCount === 1 && activeMemberships.length === 1) {
    const membership = activeMemberships[0];
    await setTenantOnSession(input.sessionId, membership.tenantId);
    return {
      view: "redirect",
      url: buildTenantReturnUrl({
        slug: membership.tenant.slug,
        context: requestContext,
        returnTo: normalizedReturnTo,
      }),
    };
  }

  if (destinationCount === 1 && platformUser) {
    await setTenantOnSession(input.sessionId, null);
    return {
      view: "redirect",
      url: buildPlatformAdminAppUrl({
        pathname: "/admin",
        context: requestContext,
      }),
    };
  }

  return {
    view: "choose",
    destinations: [
      ...activeMemberships
        .map(membership => ({
          type: "tenant" as const,
          tenantId: membership.tenantId,
          tenantName: membership.tenant.name,
          tenantSlug: membership.tenant.slug,
          role: membership.role,
          continueUrl: buildAuthenticatedSelectDestinationUrl({
            returnTo: normalizedReturnTo,
            tenantSlug: membership.tenant.slug,
            context: requestContext,
          }),
        }))
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName)),
      ...(platformUser
        ? [
            {
              type: "platform_admin" as const,
              id: platformUser.id,
              name: "Platform Admin" as const,
              role: platformUser.role,
              continueUrl: buildAuthenticatedSelectDestinationUrl({
                returnTo: normalizedReturnTo,
                destination: "platform_admin",
                context: requestContext,
              }),
            },
          ]
        : []),
    ],
  };
}

export async function completeAuthenticatedTenantSelection(input: {
  authUserId: string;
  sessionId: string;
  tenantSlug: string;
  returnTo?: string | null;
}): Promise<string> {
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const tenant = await getTenantBySlug(input.tenantSlug);

  if (!tenant) {
    throw new Error("Tenant not found.");
  }

  const membership = await db.query.portalUsers.findFirst({
    where: and(
      eq(portalUsers.authUserId, input.authUserId),
      eq(portalUsers.tenantId, tenant.id),
      eq(portalUsers.isActive, true),
    ),
  });

  if (!membership) {
    throw new Error("Your account does not belong to that tenant.");
  }

  await setTenantOnSession(input.sessionId, tenant.id);

  return buildTenantReturnUrl({
    slug: tenant.slug,
    context: requestContext,
    returnTo: normalizeGoogleReturnTo(input.returnTo),
  });
}

export async function completeAuthenticatedPlatformAdminSelection(input: {
  authUserId: string;
  sessionId: string;
}): Promise<string> {
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const platformUser = await getActivePlatformUserForAuthUser(input.authUserId);

  if (!platformUser) {
    throw new Error("Your account does not have platform admin access.");
  }

  await setTenantOnSession(input.sessionId, null);

  return buildPlatformAdminAppUrl({
    pathname: "/admin",
    context: requestContext,
  });
}

export async function resolveExistingSessionLoginDestination(input: {
  callbackUrl?: string | null;
}): Promise<string | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user?.id) {
    return null;
  }

  const requestContext = getRequestTenantHostContextFromHeaders(requestHeaders);
  const normalizedCallback = normalizeGoogleReturnTo(input.callbackUrl);

  if (requestContext.isPlatformAdminHost) {
    const platformUser = await getActivePlatformUserForAuthUser(session.user.id);
    if (platformUser) {
      await setTenantOnSession(session.session.id, null);
      return buildPlatformAdminAppUrl({
        pathname: normalizedCallback === "/" ? "/admin" : normalizedCallback,
        context: requestContext,
      });
    }
  }

  if (requestContext.tenantSlug) {
    const tenant = await getTenantBySlug(requestContext.tenantSlug);
    if (tenant) {
      const membership = await db.query.portalUsers.findFirst({
        where: and(
          eq(portalUsers.authUserId, session.user.id),
          eq(portalUsers.tenantId, tenant.id),
          eq(portalUsers.isActive, true),
        ),
      });

      if (membership) {
        await setTenantOnSession(session.session.id, tenant.id);
        return buildTenantReturnUrl({
          slug: tenant.slug,
          context: requestContext,
          returnTo: callbackUrlForTenantLogin(input.callbackUrl),
        });
      }
    }
  }

  return buildAuthenticatedSelectDestinationUrl({
    returnTo: normalizedCallback,
    context: requestContext,
  });
}

export async function getGoogleTenantChooserData(input: {
  flowToken: string;
  authUserId: string;
}) {
  const flow = parseGoogleAuthFlowToken(input.flowToken);
  const requestContext = getGoogleFlowRequestContext({
    flow,
    fallbackContext: getRequestTenantHostContextFromHeaders(await headers()),
  });
  const memberships = await listActiveTenantMembershipsForAuthUser(input.authUserId);
  const platformUser = await getActivePlatformUserForAuthUser(input.authUserId);

  return {
    flow,
    destinations: [
      ...memberships
      .filter(membership => membership.tenant?.isActive)
      .map(membership => ({
        type: "tenant" as const,
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        tenantSlug: membership.tenant.slug,
        role: membership.role,
        continueUrl: buildRootAppUrl({
          pathname: "/select-destination",
          searchParams: {
            flow: input.flowToken,
            tenant: membership.tenant.slug,
          },
          context: requestContext,
        }),
      })),
      ...(platformUser
        ? [
            {
              type: "platform_admin" as const,
              id: platformUser.id,
              name: "Platform Admin",
              role: platformUser.role,
              continueUrl: buildRootAppUrl({
                pathname: "/select-destination",
                searchParams: {
                  flow: input.flowToken,
                  destination: "platform_admin",
                },
                context: requestContext,
              }),
            },
          ]
        : []),
    ].sort((a, b) => {
      const nameA = a.type === "tenant" ? a.tenantName : a.name;
      const nameB = b.type === "tenant" ? b.tenantName : b.name;
      return nameA.localeCompare(nameB);
    }),
  };
}

export async function finalizeGoogleAuthFlow(input: {
  flowToken: string;
  authUserId: string;
  sessionId: string;
}) {
  const flow = parseGoogleAuthFlowToken(input.flowToken);
  const requestContext = getGoogleFlowRequestContext({
    flow,
    fallbackContext: getRequestTenantHostContextFromHeaders(await headers()),
  });

  const [authUserRecord] = await db
    .select()
    .from(authUser)
    .where(eq(authUser.id, input.authUserId))
    .limit(1);

  if (!authUserRecord) {
    throw new Error("Authenticated user not found.");
  }

  const buildRootLoginUrl = (error?: string) =>
    buildRootAppUrl({
      pathname: "/login",
      searchParams: error ? { error } : undefined,
      context: requestContext,
    });

  if (flow.mode === "signup") {
    await setTenantOnSession(input.sessionId, null);

    return {
      type: "redirect" as const,
      url: buildRootAppUrl({
        pathname: "/onboarding",
        context: requestContext,
      }),
    };
  }

  if (flow.tenantSlug) {
    try {
      const url = await completeAuthenticatedTenantSelection({
        authUserId: input.authUserId,
        sessionId: input.sessionId,
        tenantSlug: flow.tenantSlug,
        returnTo: flow.returnTo,
      });
      return {
        type: "redirect" as const,
        url,
      };
    } catch {
      return {
        type: "redirect" as const,
        url: buildRootLoginUrl("tenant_membership_required"),
      };
    }
  }

  if (requestContext.isPlatformAdminHost) {
    try {
      const url = await completeAuthenticatedPlatformAdminSelection({
        authUserId: input.authUserId,
        sessionId: input.sessionId,
      });
      return {
        type: "redirect" as const,
        url,
      };
    } catch {
      return {
        type: "redirect" as const,
        url: buildPlatformAdminAppUrl({
          pathname: "/login",
          searchParams: { error: "platform_access_required" },
          context: requestContext,
        }),
      };
    }
  }

  const sessionSelection = await loadAuthenticatedDestinationSelectView({
    authUserId: input.authUserId,
    sessionId: input.sessionId,
    returnTo: flow.returnTo,
  });

  return {
    type: "redirect" as const,
    url:
      sessionSelection.view === "redirect"
        ? sessionSelection.url
        : buildAuthenticatedSelectDestinationUrl({
            returnTo: flow.returnTo,
            context: requestContext,
          }),
  };
}

export async function completeGoogleTenantSelection(input: {
  flowToken: string;
  tenantSlug: string;
  authUserId: string;
  sessionId: string;
}) {
  const flow = parseGoogleAuthFlowToken(input.flowToken);
  return completeAuthenticatedTenantSelection({
    authUserId: input.authUserId,
    sessionId: input.sessionId,
    tenantSlug: input.tenantSlug,
    returnTo: flow.returnTo,
  });
}

export async function completeGooglePlatformAdminSelection(input: {
  flowToken: string;
  authUserId: string;
  sessionId: string;
}) {
  parseGoogleAuthFlowToken(input.flowToken);
  return completeAuthenticatedPlatformAdminSelection({
    authUserId: input.authUserId,
    sessionId: input.sessionId,
  });
}

export async function completeUserOnboarding(input: {
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}) {
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });

  if (!session?.user?.id || !session.session?.id) {
    throw new Error("You must sign in before creating a workspace.");
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const ownerFullName = composeFullName(firstName, lastName);

  if (!ownerFullName) {
    throw new Error("Please enter your first and last name.");
  }

  const tenantSlug = slugifyTenantName(input.tenantSlug);
  const tenantName = input.tenantName.trim();

  if (!tenantName) {
    throw new Error("Please enter a workspace name.");
  }

  if (!input.tenantSlug.trim()) {
    throw new Error("Please choose a workspace URL.");
  }

  if (!requestContext.isRootHost) {
    throw new Error(
      "Workspace setup must be completed on your main application URL (not from a tenant subdomain).",
    );
  }

  const destinations = await getAccessibleDestinationsForAuthUser(session.user.id);
  if (destinations.length > 0) {
    throw new Error(
      destinations.some(d => d.type === "tenant")
        ? "Your account is already linked to a workspace."
        : "Your account already has platform admin access.",
    );
  }

  await ensureTenantSlugAvailable(tenantSlug);

  const normalizedEmail = normalizeEmail(session.user.email);

  await db
    .update(authUser)
    .set({
      firstName,
      lastName,
      fullName: ownerFullName,
      name: ownerFullName,
      updatedAt: new Date(),
    })
    .where(eq(authUser.id, session.user.id));

  const tenant = await createBusinessTenantForAuthUser({
    authUserId: session.user.id,
    fullName: ownerFullName,
    email: normalizedEmail,
    tenantName,
    tenantSlug,
  });

  await setTenantOnSession(session.session.id, tenant.id);

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    redirectUrl: buildTenantAppUrl({
      slug: tenant.slug,
      pathname: "/dashboard",
      context: requestContext,
    }),
  };
}

/**
 * Sends the tenant invite email. Link uses the current tenant host (subdomain),
 * not generic BETTER_AUTH_URL, so open-in-browser stays on the correct workspace.
 */
export async function sendUserInvitationEmail(input: {
  email: string;
  fullName: string;
  token: string;
  role?: PortalUserRole | null;
  invitedByUserId?: string | null;
}) {
  const requestHeaders = await headers();
  const context = getRequestTenantHostContextFromHeaders(requestHeaders);
  const tenant = await getCurrentTenant();
  const inviteUrl = buildTenantAppUrl({
    slug: tenant.slug,
    pathname: `/invite/${input.token}`,
    context,
  });

  // Look up the inviter's display name so the email can credit them by
  // name ("From Sam Park") rather than leaving the From row blank. We
  // don't fail the send if the lookup misses — it's a best-effort enrich.
  let invitedByName: string | null = null;
  if (input.invitedByUserId) {
    const inviter = await db.query.portalUsers.findFirst({
      where: and(
        eq(portalUsers.authUserId, input.invitedByUserId),
        eq(portalUsers.tenantId, tenant.id),
      ),
      columns: { fullName: true },
    });
    invitedByName = inviter?.fullName?.trim() || null;
  }

  await resend.emails.send({
    from: emailFrom,
    to: input.email,
    subject: `You're invited to ${tenant.name} on Fluxora`,
    react: InviteUserEmail({
      fullName: input.fullName,
      inviteUrl,
      tenantName: tenant.name,
      role: input.role ?? null,
      invitedByName,
    }),
  });
}

export async function inviteUser(input: {
  email: string;
  fullName: string;
  role: PortalUserRole;
  invitedByUserId: string;
}) {
  const tenant = await getCurrentTenant();
  const token = randomUUID();
  const expiresAt = addDays(new Date(), 7);

  await db.insert(userInvitations).values({
    tenantId: tenant.id,
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    token,
    invitedByUserId: input.invitedByUserId,
    expiresAt,
  });

  await sendUserInvitationEmail({
    email: input.email,
    fullName: input.fullName,
    token,
    role: input.role,
    invitedByUserId: input.invitedByUserId,
  });

  return { success: true };
}

export type TenantDiscoveryItem = Awaited<
  ReturnType<typeof discoverTenantsForEmail>
>[number];
