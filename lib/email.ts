import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set");
}

if (!process.env.EMAIL_FROM) {
  throw new Error("EMAIL_FROM is not set");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const emailFrom = process.env.EMAIL_FROM;
