# Stripe subscriptions

Tenant plans use **Stripe Checkout** (subscription mode). The app stores Stripe customer/subscription IDs and plan status on the tenant record; **webhooks** keep that data in sync. Plan limits remain out of scope for the current integration.

**Code touchpoints:** `lib/stripe/`, `services/stripe-tenant-billing.ts`, `services/stripe-catalog.ts`, `app/api/stripe/webhook/route.ts`, server actions in `actions/stripe-billing.ts`, `actions/platform-stripe-billing.ts`, and `actions/stripe-catalog-sync.ts`. Tenant admins start Checkout from `**/account/billing`**; platform admins can start Checkout from `**/admin/tenants/[id]**` (internal admin host) or sync the catalog from `**/admin/subscriptions**`.

## Stripe Customer Portal

In the [Stripe Dashboard → Settings → Billing → Customer portal](https://dashboard.stripe.com/settings/billing/portal), enable and configure the **Customer portal** (which features customers can use, cancellation behavior, etc.). Without this, `billingPortal.sessions.create` will fail when a tenant admin opens **Manage billing** on `/account/billing`.

After the workspace has a **Stripe Customer** id (from the first successful Checkout or other flow that persisted `tenants.stripe_customer_id`), **owners and admins** can open the hosted portal to update the default **payment method**, **cancel** the subscription, and **view invoices**. Stripe returns users to **`/account/billing`** on your app origin (`NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` / Vercel URL — see `getAppPublicOrigin()` in `lib/stripe/config.ts`). Webhooks continue to sync subscription changes back to the tenant row.

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
2. **Manual sync** — Platform admin: **Admin → Subscriptions** or **Admin → Stripe catalog**, then **Sync Stripe catalog**. This pulls **active** Products and recurring Prices via the Stripe API. For scripts or tooling, call `syncStripeCatalogFullFromStripeApi` from `services/stripe-catalog.ts`.

The **Stripe catalog** screen (`/admin/stripe-catalog`) is a read-only view of cached Products and grouped Prices plus the last full-sync audit entry.

After schema changes, run `**npm run db:migrate`**. For a new environment, create Products/Prices in Stripe, set metadata, then run the manual sync or wait for webhooks.

## Subscription access guard (canceled / expired tenants)

Production/staging tenant hosts route through **`proxy.ts`** (Next.js Proxy middleware). On every forwarded request it sets **`x-internal-pathname`** (`lib/subscription-guard-constants.ts`) to `request.nextUrl.pathname`. `resolveTenantAppPathname()` (`lib/subscription-guard-pathname.ts`) reads that header (plus a few proxy fallbacks). **`app/(app)/(subscription-guard)/layout.tsx`** redirects canceled/expired workspaces to **`/billing-blocked`** unless the browser path matches **`isSubscriptionAccessExemptPath()`**.

**Outside the subscription guard** (still use the tenant app shell): **`/account`** (including **`/account/billing`**) and **`/billing-blocked`**, so billing recovery does not depend on resolving the path for guarded routes. If the pathname cannot be resolved for a **guarded** route while the tenant is blocked, the user is sent to **`/billing-blocked`** and a **dev `console.error` / prod `console.warn`** log is emitted — do not deploy without the proxy setting the canonical header on HTML navigations.

**Manual spot-checks (tenant host, test tenant):**

1. **Canceled → dashboard** — With subscription health **canceled**, open **`/dashboard`**; expect redirect to **`/billing-blocked`**.
2. **Canceled → Billing** — Open **`/account/billing`**; expect **no** redirect (full Billing page; Checkout / Customer Portal as before).
3. **Active → unblock screen** — Healthy tenant opens **`/billing-blocked`**; expect redirect to **`/dashboard`** (see `billing-blocked/page.tsx`).
4. **Platform admin** — On the internal admin host, navigation is unchanged (no tenant `(app)` subscription guard).

## Observability and manual regression checklist

**Tenant Billing (`/account/billing`)** shows plan, status, trial, current period end, Stripe customer/subscription ids, default card, and a short note on webhook-driven updates.

**Platform tenant** subscription overview and **Activity** summarize Stripe automation: each webhook sync records a system audit with `eventType`, `stripeEventId`, and either applied field changes or **`stripeSyncResult: unchanged`** for idempotent retries (no duplicate row noise on field diffs—see `audit_logs` rows).

**Manual spot-checks (Stripe test mode + `stripe listen`):**

1. **Checkout completed** — Finish Checkout; expect `checkout.session.completed` in Activity (or platform tenant Activity) with Stripe event id; tenant row reflects plan/status.
2. **Subscription updated** — Change plan in Stripe Dashboard or via subscription update; `customer.subscription.updated` syncs tenant fields.
3. **Subscription deleted** — Cancel subscription; `customer.subscription.deleted` sets tenant toward free/canceled handling implemented in `syncTenantFromSubscription`.
4. **Invoice payment succeeded / failed** — Paid invoice or failed charge paths should re-sync from subscription after `invoice.payment_succeeded` / `invoice.payment_failed`.
5. **Duplicate webhook** — Replay the same Stripe event (CLI resend or Stripe Dashboard resend where available); expect an audit line with **Duplicate / idempotent** outcome when stored subscription fields already matched Stripe (no row diff).

Platform admins editing subscription fields manually see an in-form warning that **future Stripe webhooks may overwrite** those corrections.
