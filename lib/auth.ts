import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "@better-auth/core/error";
import { magicLink } from "better-auth/plugins";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { platformUsers, portalUsers, tenants } from "@/db/schema";
import { MagicLinkEmail } from "@/emails/magic-link";
import { emailFrom, resend } from "./email";
import { formatAuthUserDisplayName } from "@/lib/user-display-name";
import { claimApprovedTenantJoinRequestForSession } from "@/modules/core/workspace-settings/services/tenant-join-requests-core";
import { bootstrapAuthUserIdentityOnCreate } from "@/services/signup-profile";
import {
  getRequestTenantHostContextFromHeaders,
  getRootDomain,
} from "./tenant-host";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is not set");
}

const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
);

const rootDomain = getRootDomain();
const crossSubdomainCookiesEnabled =
  rootDomain !== "localhost" && rootDomain !== "127.0.0.1";
const betterAuthUrl = new URL(process.env.BETTER_AUTH_URL);
const betterAuthPort = betterAuthUrl.port || null;

function buildTrustedOrigins() {
  const origins = [
    `https://*.${rootDomain}`,
    `http://*.${rootDomain}`,
    "https://*.localtest.me",
    "http://*.localtest.me",
  ];

  if (betterAuthPort) {
    origins.push(
      `https://*.${rootDomain}:${betterAuthPort}`,
      `http://*.${rootDomain}:${betterAuthPort}`,
      `https://*.localtest.me:${betterAuthPort}`,
      `http://*.localtest.me:${betterAuthPort}`,
    );
  }

  return origins;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  /**
   * Allow any subdomain of ROOT_DOMAIN to make auth requests.
   * Better Auth's matchesOriginPattern supports glob wildcards, so
   * "https://*.domain.com" covers all tenant subdomains without
   * needing to enumerate them. localtest.me is always included for
   * local development convenience.
   *
   * Additional origins can also be added at deploy time via the
   * BETTER_AUTH_TRUSTED_ORIGINS env var (comma-separated).
   */
  trustedOrigins: buildTrustedOrigins(),
  advanced: {
    crossSubDomainCookies: crossSubdomainCookiesEnabled
      ? {
          enabled: true,
          domain: rootDomain,
        }
      : undefined,
  },
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "",
      },
      lastName: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "",
      },
      fullName: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "",
      },
    },
  },
  session: {
    additionalFields: {
      tenantId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  socialProviders: googleAuthEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {},

  emailAndPassword: {
    enabled: false,
  },

  emailVerification: {
    sendOnSignUp: false,
    sendOnSignIn: false,
    autoSignInAfterVerification: false,
  },

  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      disableSignUp: false,
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: emailFrom,
          to: email,
          subject: "Sign in to Fluxora",
          react: MagicLinkEmail({
            url,
            name: null,
          }),
        });
      },
    }),
    nextCookies(),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (createdUser): Promise<void> => {
          await bootstrapAuthUserIdentityOnCreate({
            userId: createdUser.id,
            emailLower: createdUser.email,
            initialName: createdUser.name ?? "",
          });
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          if (!ctx) return;

          const requestHeaders = ctx.request?.headers ?? ctx.headers;
          const hostContext = requestHeaders
            ? getRequestTenantHostContextFromHeaders(requestHeaders)
            : null;
          const tenantSlug = hostContext?.tenantSlug ?? null;

          if (hostContext?.isPlatformAdminHost) {
            const platformUser = await db.query.platformUsers.findFirst({
              where: and(
                eq(platformUsers.authUserId, session.userId),
                eq(platformUsers.isActive, true),
              ),
            });

            if (!platformUser) {
              throw APIError.from("FORBIDDEN", {
                code: "PLATFORM_USER_REQUIRED",
                message: "Your account does not have platform admin access.",
              });
            }

            return {
              data: {
                ...session,
                tenantId: null,
              },
            };
          }

          if (!tenantSlug) {
            return {
              data: {
                ...session,
                tenantId: null,
              },
            };
          }

          const tenant = await db.query.tenants.findFirst({
            where: and(eq(tenants.slug, tenantSlug), eq(tenants.isActive, true)),
          });

          if (!tenant) {
            throw APIError.from("FORBIDDEN", {
              code: "TENANT_NOT_FOUND",
              message: "This tenant was not found or is inactive.",
            });
          }

          const membership = await db.query.portalUsers.findFirst({
            where: and(
              eq(portalUsers.authUserId, session.userId),
              eq(portalUsers.tenantId, tenant.id),
              eq(portalUsers.isActive, true),
            ),
          });

          if (!membership) {
            const [authUserRecord] = await db
              .select({
                email: authSchema.user.email,
                name: authSchema.user.name,
                fullName: authSchema.user.fullName,
                firstName: authSchema.user.firstName,
                lastName: authSchema.user.lastName,
              })
              .from(authSchema.user)
              .where(eq(authSchema.user.id, session.userId))
              .limit(1);

            const claimedMembership = authUserRecord
              ? await claimApprovedTenantJoinRequestForSession({
                  tenantId: tenant.id,
                  authUserId: session.userId,
                  email: authUserRecord.email,
                  fallbackFullName: formatAuthUserDisplayName(authUserRecord),
                })
              : null;

            if (claimedMembership) {
              return {
                data: {
                  ...session,
                  tenantId: tenant.id,
                },
              };
            }

            throw APIError.from("FORBIDDEN", {
              code: "TENANT_MEMBERSHIP_REQUIRED",
              message: "Your account does not belong to this tenant.",
            });
          }

          return {
            data: {
              ...session,
              tenantId: tenant.id,
            },
          };
        },
      },
    },
  },
});
