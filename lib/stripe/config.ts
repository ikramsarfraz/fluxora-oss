import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripeSecretKeyOrThrow(): string {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  if (!k) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }
  return k;
}

/** Normalizes env webhook secret (trim, strip wrapping quotes, BOM) so .env mistakes don’t break Stripe signature checks. */
export function getStripeWebhookSecretOrThrow(): string {
  let k = process.env.STRIPE_WEBHOOK_SECRET?.replace(/^\uFEFF/, "").trim() ?? "";
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  if (!k) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  }
  return k;
}

/**
 * Public origin for redirects (no trailing slash). Uses NEXT_PUBLIC_APP_URL, then
 * BETTER_AUTH_URL, then VERCEL_URL, then localhost.
 */
export function getAppPublicOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ?? process.env.BETTER_AUTH_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function getStripeClient(): Stripe {
  if (!client) {
    client = new Stripe(getStripeSecretKeyOrThrow(), {
      typescript: true,
    });
  }
  return client;
}
