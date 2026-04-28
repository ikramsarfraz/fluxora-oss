import Stripe from "stripe";

import { processStripeWebhookEvent } from "@/services/stripe-tenant-billing";
import { getStripeClient, getStripeWebhookSecretOrThrow } from "@/lib/stripe/config";

export const runtime = "nodejs";

/** Do not cache; body must be read once as received for signature verification. */
export const dynamic = "force-dynamic";

/**
 * Stripe sends raw body + Stripe-Signature header. Do not parse JSON before verify.
 *
 * Mirrors the webhook route handler pattern used in Next’s Stripe example (“with-stripe-typescript”):
 * raw body verification, then delegated processing ({@link https://github.com/vercel/next.js/tree/canary/examples/with-stripe-typescript}).
 */
export async function POST(request: Request) {
  const rawBody = new TextDecoder("utf-8", { fatal: false }).decode(
    new Uint8Array(await request.arrayBuffer()),
  );
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe-Signature header" }, { status: 400 });
  }
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecretOrThrow(),
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[dev] Webhook signing: use the Signing secret from `stripe listen` while the CLI is running (starts with whsec_). " +
          "It is not the Dashboard endpoint secret unless you are hitting a production URL that Stripe calls directly. " +
          "Restart `next dev` after changing STRIPE_WEBHOOK_SECRET in `.env.local`.",
      );
    }
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    await processStripeWebhookEvent(event);
  } catch (err) {
    console.error("Stripe webhook processing error:", err);
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
  return new Response(null, { status: 200 });
}
