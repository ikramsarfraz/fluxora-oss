# Stripe subscriptions

Tenant plans use **Stripe Checkout** (subscription mode). The app stores Stripe customer/subscription IDs and plan status on the tenant record; **webhooks** keep that data in sync. Plan limits and the Billing Portal are out of scope for the current integration.

**Code touchpoints:** `lib/stripe/`, `services/stripe-tenant-billing.ts`, `app/api/stripe/webhook/route.ts`, server actions in `actions/stripe-billing.ts` and `actions/platform-stripe-billing.ts`. Tenant admins start Checkout from **`/account/billing`**; platform admins can start Checkout from **`/admin/tenants/[id]`** (internal admin host).

## Environment variables

Set in `.env.local` (see `.env.local.example` in the repo root):

| Variable | Purpose |
| -------- | ------- |
| `STRIPE_SECRET_KEY` | Server-side Stripe API secret (test key in development) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for verifying `POST /api/stripe/webhook` (see below — **CLI ≠ Dashboard**) |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_ENTERPRISE` | Stripe Price IDs for the three SaaS tiers |
| `NEXT_PUBLIC_APP_URL` (optional) | Public origin for Checkout success/cancel redirects (falls back via `BETTER_AUTH_URL` / Vercel) |

## Production webhooks

1. In [Developers → Webhooks](https://dashboard.stripe.com/webhooks), add an endpoint: `https://<your-domain>/api/stripe/webhook`.
2. Select the event types your app handles (checkout, subscriptions, invoices as implemented in `processStripeWebhookEvent`).
3. **Reveal signing secret** for **that endpoint** — it is a **`whsec_...`** tied to **that URL**. Set it as **`STRIPE_WEBHOOK_SECRET`** in deployment env. It is **not** the secret printed by **`stripe listen`** (that is only for local forwarding).

## Local development (Stripe CLI)

1. Create three recurring **Prices** (Starter, Growth, Enterprise) in the [Stripe test Dashboard](https://dashboard.stripe.com/test); paste their IDs into the `STRIPE_PRICE_*` env vars.
2. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
3. Forward events to **this** app (**include port `:3000` and path `/api/stripe/webhook`**):

   ```bash
   stripe listen --forward-to http://localtest.me:3000/api/stripe/webhook
   ```

   Or with localhost:

   ```bash
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   ```

4. Copy the **`whsec_...`** printed by **`stripe listen`** into **`STRIPE_WEBHOOK_SECRET`** in `.env.local`. Restart `npm run dev` after changing secrets.
5. Sign in as a tenant user → **`/account` → Billing** (or **`/account/billing`**) → start Checkout as owner/admin. Use [Stripe test cards](https://docs.stripe.com/testing#cards) (e.g. `4242424242424242`). After Checkout, redirects include `session_id`; the Billing UI can confirm the session while webhooks update the tenant row.

Platform admins may also start Checkout from tenant detail (`/admin/tenants/[id]`).

The Checkout return flow aligns with Next’s Stripe sample pattern (`with-stripe-typescript`): [GitHub — with-stripe-typescript](https://github.com/vercel/next.js/tree/canary/examples/with-stripe-typescript).

## Signing secret troubleshooting

If webhook requests return **`400 Invalid signature`** / `No signatures found matching…`:

- While using **`stripe listen`**, **`STRIPE_WEBHOOK_SECRET` must equal the `whsec_` printed in that CLI session.** Restart **`stripe listen`** → new secret → update `.env.local` → restart **`npm run dev`**.
- Do **not** paste the Dashboard endpoint signing secret into local env while testing forwarded events via the CLI (and vice versa for production). See Stripe’s docs: [Resolve webhook signature errors](https://docs.stripe.com/webhooks/signature).

Common mistakes: forgetting **`:3000`** in the forward URL (hits port 80 and fails), wrong path (**`/api/stripe/webhook`** vs `/api/webhooks`), or stale secret after restarting `stripe listen`.
