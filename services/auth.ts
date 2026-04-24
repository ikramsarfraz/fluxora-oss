import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { session as authSession, user as authUser } from "@/db/auth-schema";
import { portalUsers, tenants, userInvitations } from "@/db/schema";
import { resend, emailFrom } from "@/lib/email";
import {
  createGoogleAuthFlowToken,
  isGoogleAuthEnabled,
  normalizeGoogleReturnTo,
  parseGoogleAuthFlowToken,
  type GoogleAuthMode,
  type GoogleAuthSignupType,
} from "@/lib/google-auth-flow";
import { InviteUserEmail } from "@/emails/invite-user";
import {
  buildRootAppUrl,
  buildTenantAppUrl,
  getRequestTenantHostContextFromHeaders,
  isReservedTenantSlug,
  slugifyTenantName,
} from "@/lib/tenant-host";
import { getCurrentTenant, getTenantBySlug } from "./tenants";
import { createPortalUser, PortalUserRole } from "./portal-users";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildTenantReturnUrl(args: {
  slug: string;
  returnTo: string;
  context: Parameters<typeof buildTenantAppUrl>[0]["context"];
}) {
  const parsed = new URL(normalizeGoogleReturnTo(args.returnTo), "http://tenant.local");

  return buildTenantAppUrl({
    slug: args.slug,
    pathname: parsed.pathname,
    searchParams: parsed.searchParams,
    context: args.context,
  });
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
    throw new Error("Please choose a tenant slug.");
  }

  if (isReservedTenantSlug(slug)) {
    throw new Error("That tenant slug is reserved. Please choose another.");
  }

  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });

  if (existing) {
    throw new Error("That tenant slug is already taken.");
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

async function setTenantOnSession(sessionId: string, tenantId: string) {
  await db
    .update(authSession)
    .set({
      tenantId,
      updatedAt: new Date(),
    })
    .where(eq(authSession.id, sessionId));
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

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}) {
  const data = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  return data;
}

type TenantDiscoveryResult = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: PortalUserRole;
  loginUrl: string;
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
}): Promise<TenantDiscoveryResult[]> {
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

  return memberships
    .filter(membership => membership.tenant?.isActive)
    .map(membership => ({
      tenantId: membership.tenantId,
      tenantName: membership.tenant.name,
      tenantSlug: membership.tenant.slug,
      role: membership.role,
      loginUrl: buildTenantAppUrl({
        slug: membership.tenant.slug,
        pathname: "/login",
        searchParams: {
          email: normalizedEmail,
          callbackUrl: input.callbackUrl ?? undefined,
        },
        context: requestContext,
      }),
    }))
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
}

export async function getGoogleTenantChooserData(input: {
  flowToken: string;
  authUserId: string;
}) {
  const flow = parseGoogleAuthFlowToken(input.flowToken);
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const memberships = await listActiveTenantMembershipsForAuthUser(input.authUserId);

  return {
    flow,
    tenants: memberships
      .filter(membership => membership.tenant?.isActive)
      .map(membership => ({
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        tenantSlug: membership.tenant.slug,
        role: membership.role,
        continueUrl: buildRootAppUrl({
          pathname: "/google/select-tenant",
          searchParams: {
            flow: input.flowToken,
            tenant: membership.tenant.slug,
          },
          context: requestContext,
        }),
      }))
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName)),
  };
}

export async function finalizeGoogleAuthFlow(input: {
  flowToken: string;
  authUserId: string;
  sessionId: string;
}) {
  const flow = parseGoogleAuthFlowToken(input.flowToken);
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const memberships = await listActiveTenantMembershipsForAuthUser(input.authUserId);
  const activeMemberships = memberships.filter(membership => membership.tenant?.isActive);

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
    const tenant =
      flow.signupType === "business"
        ? await createBusinessTenantForAuthUser({
            authUserId: input.authUserId,
            fullName: authUserRecord.name,
            email: authUserRecord.email,
            tenantName: flow.tenantName ?? "",
            tenantSlug: flow.tenantSlug ?? "",
          })
        : await createSoloTenantForAuthUser({
            authUserId: input.authUserId,
            fullName: authUserRecord.name,
            email: authUserRecord.email,
          });

    await setTenantOnSession(input.sessionId, tenant.id);

    return {
      type: "redirect" as const,
      url: buildTenantReturnUrl({
        slug: tenant.slug,
        context: requestContext,
        returnTo: flow.returnTo,
      }),
    };
  }

  if (flow.tenantSlug) {
    const tenant = await getTenantBySlug(flow.tenantSlug);
    if (!tenant) {
      return {
        type: "redirect" as const,
        url: buildRootLoginUrl("tenant_not_found"),
      };
    }

    const membership = activeMemberships.find(
      item => item.tenantId === tenant.id,
    );

    if (!membership) {
      return {
        type: "redirect" as const,
        url: buildTenantAppUrl({
          slug: tenant.slug,
          pathname: "/login",
          searchParams: { error: "tenant_membership_required" },
          context: requestContext,
        }),
      };
    }

    await setTenantOnSession(input.sessionId, tenant.id);

    return {
      type: "redirect" as const,
      url: buildTenantReturnUrl({
        slug: tenant.slug,
        context: requestContext,
        returnTo: flow.returnTo,
      }),
    };
  }

  if (activeMemberships.length === 0) {
    return {
      type: "redirect" as const,
      url: buildRootAppUrl({
        pathname: "/signup",
        searchParams: { oauthError: "no_tenants" },
        context: requestContext,
      }),
    };
  }

  if (activeMemberships.length === 1) {
    const membership = activeMemberships[0];
    await setTenantOnSession(input.sessionId, membership.tenantId);

    return {
      type: "redirect" as const,
      url: buildTenantReturnUrl({
        slug: membership.tenant.slug,
        context: requestContext,
        returnTo: flow.returnTo,
      }),
    };
  }

  return {
    type: "choose-tenant" as const,
    url: buildRootAppUrl({
      pathname: "/google/select-tenant",
      searchParams: { flow: input.flowToken },
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
    returnTo: flow.returnTo,
  });
}

export async function signUpBusinessTenantAccount(input: {
  name: string;
  email: string;
  password: string;
  tenantName: string;
  tenantSlug: string;
}) {
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const normalizedEmail = normalizeEmail(input.email);
  const tenantSlug = slugifyTenantName(input.tenantSlug);
  const tenantName = input.tenantName.trim();

  if (!tenantName) {
    throw new Error("Please enter a tenant name.");
  }

  if (!input.tenantSlug.trim()) {
    throw new Error("Please choose a tenant slug.");
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
    const signUpData = await signUp({
      name: input.name,
      email: normalizedEmail,
      password: input.password,
    });

    if (!signUpData?.user?.id) {
      throw new Error("Sign up did not return a user id.");
    }

    await createPortalUser({
      tenantId: tenant.id,
      authUserId: signUpData.user.id,
      fullName: input.name,
      email: normalizedEmail,
      role: "owner",
    });

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      loginUrl: buildTenantAppUrl({
        slug: tenant.slug,
        pathname: "/login",
        searchParams: {
          email: normalizedEmail,
          created: "1",
        },
        context: requestContext,
      }),
      rootLoginUrl: buildRootAppUrl({
        pathname: "/login",
        context: requestContext,
      }),
    };
  } catch (error) {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
    throw error;
  }
}

export async function signUpSoloTenantAccount(input: {
  name: string;
  email: string;
  password: string;
}) {
  const requestContext = getRequestTenantHostContextFromHeaders(await headers());
  const normalizedEmail = normalizeEmail(input.email);
  const tenantName = `${input.name.trim() || normalizedEmail}'s Workspace`;
  const tenantSlug = await createUniquePersonalTenantSlug(
    input.name.trim() || normalizedEmail.split("@")[0] || "tenant",
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
    const signUpData = await signUp({
      name: input.name,
      email: normalizedEmail,
      password: input.password,
    });

    if (!signUpData?.user?.id) {
      throw new Error("Sign up did not return a user id.");
    }

    await createPortalUser({
      tenantId: tenant.id,
      authUserId: signUpData.user.id,
      fullName: input.name,
      email: normalizedEmail,
      role: "owner",
    });

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      loginUrl: buildTenantAppUrl({
        slug: tenant.slug,
        pathname: "/login",
        searchParams: {
          email: normalizedEmail,
          created: "1",
        },
        context: requestContext,
      }),
      rootLoginUrl: buildRootAppUrl({
        pathname: "/login",
        context: requestContext,
      }),
    };
  } catch (error) {
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
    throw error;
  }
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

  const inviteUrl = `${process.env.BETTER_AUTH_URL}/invite/${token}`;

  await resend.emails.send({
    from: emailFrom,
    to: input.email,
    subject: "You were invited to Acme Distribution",
    react: InviteUserEmail({
      fullName: input.fullName,
      inviteUrl,
    }),
  });

  return { success: true };
}

/** Row shape returned by `signUp()` (for client `import type` only). */
export type SignUpResponse = Awaited<ReturnType<typeof signUp>>;
export type TenantDiscoveryItem = Awaited<
  ReturnType<typeof discoverTenantsForEmail>
>[number];
