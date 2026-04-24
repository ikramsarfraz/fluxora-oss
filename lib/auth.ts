import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "@better-auth/core/error";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { portalUsers, tenants } from "@/db/schema";
import { VerifyEmail } from "@/emails/verify-email";
import { emailFrom, resend } from "./email";
import { getRootDomain } from "./tenant-host";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { createPortalUser } from "@/services/portal-users";
import { getCurrentTenant } from "@/services/tenants";
import { parseTenantSlugFromHostname } from "./tenant-host";

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
  trustedOrigins: [
    `https://*.${rootDomain}`,
    `http://*.${rootDomain}`,
    "https://*.localtest.me",
    "http://*.localtest.me",
  ],
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
    user: {
      create: {
        /**
         * After any new Better Auth user is created (email or OAuth), ensure a
         * matching `portal_users` row exists. `createPortalUser` is idempotent
         * so email sign-ups that call it explicitly are safe.
         */
        after: async user => {
          // During email sign-up there is no session yet — getCurrentTenant()
          // would throw. The portal user is created explicitly by the calling
          // code (e.g. acceptInvitation). This hook only runs for OAuth
          // sign-ins or other paths where a session is already established.
          let tenantId: string;
          try {
            const tenant = await getCurrentTenant();
            tenantId = tenant.id;
          } catch {
            return;
          }
          await createPortalUser({
            tenantId,
            authUserId: user.id,
            fullName: user.name,
            email: user.email,
          });
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          if (!ctx) return;

          const requestHeaders = ctx.request?.headers ?? ctx.headers;
          const requestUrl = ctx.request?.url ? new URL(ctx.request.url) : null;
          const host = requestHeaders?.get("host") ?? requestHeaders?.get("x-forwarded-host");
          const hostname = host?.split(",")[0]?.trim()?.split(":")[0]?.toLowerCase() ?? "";
          const tenantSlug =
            requestHeaders?.get("x-tenant-slug") ??
            (hostname ? parseTenantSlugFromHostname(hostname) : null);

          const isSocialCallback =
            requestUrl?.pathname?.startsWith("/api/auth/callback/") ?? false;

          if (!tenantSlug) {
            if (isSocialCallback) {
              return {
                data: {
                  ...session,
                  tenantId: null,
                },
              };
            }

            throw APIError.from("FORBIDDEN", {
              code: "TENANT_REQUIRED",
              message: "A tenant subdomain is required to sign in.",
            });
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
