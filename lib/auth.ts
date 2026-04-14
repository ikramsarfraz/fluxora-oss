import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { VerifyEmail } from "@/emails/verify-email";
import { emailFrom, resend } from "./email";
import { ResetPasswordEmail } from "@/emails/reset-password";

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
