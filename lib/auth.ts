import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "@better-auth/core/error";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { platformUsers, portalUsers, tenants } from "@/db/schema";
import { VerifyEmail } from "@/emails/verify-email";
import { emailFrom, resend } from "./email";
import { getRequestTenantHostContextFromHeaders, getRootDomain } from "./tenant-host";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { claimApprovedTenantJoinRequestForSession } from "@/services/tenant-join-requests-core";

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

  databaseHooks: {
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
              })
              .from(authSchema.user)
              .where(eq(authSchema.user.id, session.userId))
              .limit(1);

            const claimedMembership = authUserRecord
              ? await claimApprovedTenantJoinRequestForSession({
                  tenantId: tenant.id,
                  authUserId: session.userId,
                  email: authUserRecord.email,
                  fallbackFullName: authUserRecord.name,
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

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,

    async sendResetPassword({ user, url }) {
      await resend.emails.send({
        from: emailFrom,
        to: user.email,
        subject: "Reset your password",
        react: ResetPasswordEmail({
          name: user.name,
          url,
        }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,

    async sendVerificationEmail({ user, url }) {
      await resend.emails.send({
        from: emailFrom,
        to: user.email,
        subject: "Verify your email",
        react: VerifyEmail({
          name: user.name,
          url,
        }),
      });
    },
  },

  plugins: [nextCookies()],
});
