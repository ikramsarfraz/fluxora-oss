# Billing Release Checklist

This is the lightweight V1 release checklist for subscription billing and plan enforcement.

## Stripe configuration

- `STRIPE_SECRET_KEY` is set for the target environment.
- `STRIPE_WEBHOOK_SECRET` matches the deployed webhook endpoint, not a local Stripe CLI secret.
- Paid Stripe Prices exist for `starter`, `growth`, and `enterprise`.
- Either:
  - `stripe_prices` cache is populated with active recurring prices and `plan` metadata, or
  - fallback `STRIPE_PRICE_*` env vars are set correctly.
- The Stripe Customer Portal is enabled in the Stripe Dashboard.

## Webhook delivery

- `POST /api/stripe/webhook` is reachable from Stripe.
- Stripe is sending:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Replay a recent webhook and confirm duplicate delivery is safely skipped or recorded as unchanged.
- Check logs for:
  - missing tenant linkage
  - unmapped price ids
  - sync failures

## Tenant billing lifecycle

- New paid checkout works from `/account/billing`.
- Plan upgrade works and syncs back to the tenant record.
- Plan downgrade works and syncs back to the tenant record.
- Cancellation works through Stripe Customer Portal or Stripe Dashboard.
- Re-subscribe after cancel works and restores tenant access after webhook sync.
- A tenant with no `stripeCustomerId` can still start Checkout.
- A tenant with a stored `stripeCustomerId` can open Customer Portal.

## Subscription access behavior

- Healthy tenants can access the app normally.
- `canceled` tenants are redirected to `/billing-blocked` for guarded tenant routes.
- `expired` tenants are redirected to `/billing-blocked` for guarded tenant routes.
- `/account/billing` remains accessible even when the tenant is blocked.
- Platform admin routes are unaffected by tenant subscription blocking.

## Plan capabilities and limits

- `reports` UI gating shows upgrade messaging on:
  - price chart page
  - dashboard AR aging section
- AR aging backend action is blocked for plans without `reports`.
- Portal user invite limit blocks correctly.
- Product creation limit blocks correctly.
- Customer creation limit blocks correctly.
- Monthly sales order limit blocks correctly.
- Upgrade-required errors render actionable Billing CTAs in tenant UI.

## Usage visibility

- `/account/billing` shows:
  - current plan
  - current usage for portal users, products, customers, monthly orders
  - warning states for near-limit and at-limit rows
- `/admin/tenants/[id]` shows the same usage summary without upgrade CTA links.

## Tenant isolation spot checks

- Product detail lookup is tenant-scoped.
- Customer detail lookup is tenant-scoped.
- Category detail lookup is tenant-scoped.
- Customer delete is tenant-scoped.
- Invoice creation reads the sales order through tenant scope.

## Local test flow

1. Start the app with `pnpm dev`.
2. Run Stripe CLI forwarding:
   `stripe listen --forward-to http://localtest.me:3000/api/stripe/webhook`
3. Sign in as a tenant owner or admin.
4. Open `/account/billing`.
5. Start Checkout and complete it with a Stripe test card.
6. Confirm:
   - Billing page updates after webhook sync
   - Customer Portal opens once the customer id is stored
   - usage and plan state render correctly

## Known limitation

- Full `next build` is currently blocked in this environment by the pre-existing native `lightningcss` module issue. Use `tsc --noEmit` and focused tests as the primary verification signal until that native dependency is fixed in the runtime.
