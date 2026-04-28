# Stripe subscriptions

Tenant plans use **Stripe Checkout** (subscription mode). The app stores Stripe customer/subscription IDs and plan status on the tenant record; **webhooks** keep that data in sync. Plan limits and the Billing Portal are out of scope for the current integration.

**Code touchpoints:** `lib/stripe/`, `services/stripe-tenant-billing.ts`, `services/stripe-catalog.ts`, `app/api/stripe/webhook/route.ts`, server actions in `actions/stripe-billing.ts`, `actions/platform-stripe-billing.ts`, and `actions/stripe-catalog-sync.ts`. Tenant admins start Checkout from `**/account/billing`**; platform admins can start Checkout from `**/admin/tenants/[id]**` (internal admin host) or sync the catalog from `**/admin/subscriptions**`.

## Environment variables

Set in `.env.local` (see `.env.local.example` in the repo root):


| Variable                                                                 | Purpose                                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                                                      | Server-side Stripe API secret (test key in development)                                         |
| `STRIPE_WEBHOOK_SECRET`                                                  | Signing secret for verifying `POST /api/stripe/webhook` (see below — **CLI ≠ Dashboard**)       |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_ENTERPRISE` | Fallback Stripe Price IDs when catalog rows are missing (see **Catalog** below)                 |
| `NEXT_PUBLIC_APP_URL` (optional)                                         | Public origin for Checkout success/cancel redirects (falls back via `BETTER_AUTH_URL` / Vercel) |


## Production webhooks

1. In [Developers → Webhooks](https://dashboard.stripe.com/webhooks), add an endpoint: `https://<your-domain>/api/stripe/webhook`.
2. Select the event types your app handles. At minimum: `**checkout.session.completed`**, `**customer.subscription.created**`, `**customer.subscription.updated**`, `**customer.subscription.deleted**`, `**invoice.payment_succeeded**`, `**invoice.payment_failed**`, and for catalog sync: `**product.created**`, `**product.updated**`, `**product.deleted**`, `**price.created**`, `**price.updated**`, `**price.deleted**` (see `services/stripe-tenant-billing.ts` and `services/stripe-catalog.ts`).
3. **Reveal signing secret** for **that endpoint** — it is a `**whsec_...`** tied to **that URL**. Set it as `**STRIPE_WEBHOOK_SECRET`** in deployment env. It is **not** the secret printed by `**stripe listen`** (that is only for local forwarding).

## Local development (Stripe CLI)

1. Create three recurring **Prices** (Starter, Growth, Enterprise) in the [Stripe test Dashboard](https://dashboard.stripe.com/test); paste their IDs into the `STRIPE_PRICE_*` env vars.
2. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
3. Forward events to **this** app (**include port `:3000` and path `/api/stripe/webhook`**):
  ```bash
   stripe listen --forward-to http://localtest.me:3000/api/stripe/webhook
  ```
   Or with localhost:
4. Copy the `**whsec_...**` printed by `**stripe listen**` into `**STRIPE_WEBHOOK_SECRET**` in `.env.local`. Restart `npm run dev` after changing secrets.
5. Sign in as a tenant user → `**/account` → Billing** (or `**/account/billing`**) → start Checkout as owner/admin. Use [Stripe test cards](https://docs.stripe.com/testing#cards) (e.g. `4242424242424242`). After Checkout, redirects include `session_id`; the Billing UI can confirm the session while webhooks update the tenant row.

A **platform admin** can open `**/admin/subscriptions`** on the internal admin host and use **Sync Stripe catalog** to pull active Products and Prices from Stripe into the database (also possible via `syncStripeCatalogFullFromStripeApi` in server code).

Platform admins may also start Checkout from tenant detail (`/admin/tenants/[id]`).

The Checkout return flow aligns with Next’s Stripe sample pattern (`with-stripe-typescript`): [GitHub — with-stripe-typescript](https://github.com/vercel/next.js/tree/canary/examples/with-stripe-typescript).

## Signing secret troubleshooting

If webhook requests return `**400 Invalid signature`** / `No signatures found matching…`:

- While using `**stripe listen**`, `**STRIPE_WEBHOOK_SECRET` must equal the `whsec_` printed in that CLI session.** Restart `**stripe listen`** → new secret → update `.env.local` → restart `**npm run dev**`.
- Do **not** paste the Dashboard endpoint signing secret into local env while testing forwarded events via the CLI (and vice versa for production). See Stripe’s docs: [Resolve webhook signature errors](https://docs.stripe.com/webhooks/signature).

Common mistakes: forgetting `**:3000`** in the forward URL (hits port 80 and fails), wrong path (`**/api/stripe/webhook**` vs `/api/webhooks`), or stale secret after restarting `stripe listen`.

## Catalog (Products & Prices cache)

The tables `**stripe_products**` and `**stripe_prices**` mirror Stripe’s Product and Price objects. They are used so Checkout can resolve **which Stripe Price id** to use per plan from your catalog instead of relying only on fixed env vars.

**Metadata convention (required for plan mapping without env price IDs):**

- On each **recurring Price** that backs a tenant tier, set metadata key `**plan`** to one of: `**starter**`, `**growth**`, `**enterprise**`. You may set `**plan**` on the **Product** instead; the sync copies the effective plan into `stripe_prices.billing_plan_key` (Stripe Price metadata wins over Product when merging).
- Optionally set `**lookup_key`** in Stripe for human-readable keys; we store it but primary plan resolution uses `**plan**`.

**Checkout & subscription resolution:** When creating a Checkout Session, the app selects the **latest active** cached price with matching `billing_plan_key`. If none is found, it falls back to `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, or `STRIPE_PRICE_ENTERPRISE`. Webhook subscription sync maps a subscription’s price id back to a tenant plan via the same cache, then env ids.

Stripe `product.deleted` / `price.deleted` events **archive** local rows (`active = false`) instead of deleting them, so a subscription that still references an old Stripe price id continues to match `billing_plan_key` / cached metadata (env remains a fallback if the row was never synced).

**Keeping the cache fresh:**

1. **Webhooks** — Forward the `product.*` and `price.*` events listed above; the handler upserts or deletes local rows and writes **system** audit logs.
2. **Manual sync** — Platform admin: **Admin → Subscriptions → Sync Stripe catalog**. This pulls **active** Products and recurring Prices via the Stripe API. For scripts or tooling, call `syncStripeCatalogFullFromStripeApi` from `services/stripe-catalog.ts`.

After schema changes, run `**npm run db:migrate`**. For a new environment, create Products/Prices in Stripe, set metadata, then run the manual sync or wait for webhooks.