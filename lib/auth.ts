import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { VerifyEmail } from "@/emails/verify-email";
import { emailFrom, resend } from "./email";
import { ResetPasswordEmail } from "@/emails/reset-password";
import { createPortalUser } from "@/services/portal-users";
import { getCurrentTenant } from "@/services/tenants";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is not set");
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is not set");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * After any new Better Auth user is created (email or OAuth), ensure a
         * matching `portal_users` row exists. `createPortalUser` is idempotent
         * so email sign-ups that call it explicitly are safe.
         */
        after: async user => {
          const tenant = await getCurrentTenant();
          await createPortalUser({
            tenantId: tenant.id,
            authUserId: user.id,
            fullName: user.name,
            email: user.email,
          });
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
    autoSignInAfterVerification: true,

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
