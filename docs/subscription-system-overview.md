# Subscription System Overview

This document is the short internal map of the current subscription system across tenant billing, Stripe sync, plan capabilities, and numeric limits.

## Scope

- Tenant subscriptions use Stripe for paid plan checkout and hosted self-service billing management.
- Tenant records store the current Stripe linkage and subscription snapshot.
- App-side helpers drive feature gating, reporting guardrails, limit enforcement, and usage visibility.

## Stripe checkout

- Tenant admins start Checkout from [`/account/billing`](app/(app)/account/billing/page.tsx).
- Platform admins can also start Checkout for a tenant from [`/admin/tenants/[id]`](app/admin/tenants/[id]/page.tsx).
- Checkout sessions are created in [`actions/stripe-billing.ts`](actions/stripe-billing.ts) and [`actions/platform-stripe-billing.ts`](actions/platform-stripe-billing.ts), using [`services/stripe-tenant-billing.ts`](services/stripe-tenant-billing.ts).
- A Stripe Customer is created or reused per tenant via `getOrCreateStripeCustomerForTenant()`.
- Checkout metadata includes the tenant id on both the session and subscription so webhook reconciliation can map Stripe events back to the correct tenant.

## Stripe Customer Portal

- Tenant owners/admins can open the hosted Stripe Customer Portal from Billing after the tenant has a stored Stripe customer id.
- Portal sessions are created by `createTenantStripeBillingPortalSession()` in [`services/stripe-tenant-billing.ts`](services/stripe-tenant-billing.ts).
- The portal is used for payment method updates, cancellation, and invoice history.
- Return navigation comes back to `/account/billing`.

## Webhook sync and idempotency

- Stripe sends events to [`/api/stripe/webhook`](app/api/stripe/webhook/route.ts).
- Webhook processing lives in [`services/stripe-tenant-billing.ts`](services/stripe-tenant-billing.ts) and catalog sync helpers.
- Checkout completion and subscription lifecycle events update the tenant record’s:
  - Stripe customer id
  - Stripe subscription id
  - subscription plan
  - subscription status
  - trial / current period dates
- Replayed or duplicate webhook deliveries are intentionally safe. Subscription updates are diffed against stored tenant values, and audit entries record unchanged/idempotent outcomes instead of creating conflicting behavior.

## Subscription health states

- Health derivation lives in [`lib/tenant-subscription-health.ts`](lib/tenant-subscription-health.ts).
- Current health states are:
  - `good`
  - `trialing`
  - `past_due`
  - `canceled`
  - `expired`
  - `free`
- Health is a coarse UX-oriented view derived from tenant `subscriptionPlan`, `subscriptionStatus`, and persisted trial / period end dates.

## Canceled and expired tenant blocking

- Hard tenant-app blocking is intentionally narrow.
- The tenant subscription guard in [`app/(app)/(subscription-guard)/layout.tsx`](app/(app)/(subscription-guard)/layout.tsx) blocks access only when health resolves to `canceled` or `expired`.
- Blocked tenants are redirected to `/billing-blocked`.
- Billing recovery routes remain reachable, especially `/account/billing`, so a blocked tenant can still recover access.
- This is separate from plan capability gating. Subscription health controls whether the tenant app can be used at all; plan capabilities control what specific features or limits a healthy tenant gets.

## Plan capability helpers

- Capability source of truth lives in [`lib/subscription-plan-capabilities.ts`](lib/subscription-plan-capabilities.ts).
- It defines:
  - feature availability by plan
  - numeric limits by plan
  - `comped` behavior as an enterprise-equivalent override
- Shared helpers:
  - `getTenantPlanCapabilities(plan, status?)`
  - `canUseFeature(tenant, featureKey)`
  - `getPlanLimit(tenant, limitKey)`
  - `assertTenantCanUseFeature(tenant, featureKey)`

## UI feature gating

- Reusable UI gating lives in [`components/subscription/plan-feature-gate.tsx`](components/subscription/plan-feature-gate.tsx).
- It shows a lightweight upgrade message and billing CTA instead of redirecting.
- Current applied UI gates:
  - price chart page, using the `reports` capability
  - dashboard AR aging section, also using the `reports` capability
- This remains intentionally narrow and UI-first.

## Server-side reporting guardrails

- Minimal backend guardrails exist only for reporting-style actions.
- `assertTenantCanUseFeature()` is currently used to prevent unavailable plans from executing guarded reporting actions directly.
- The existing local example is the AR aging action in [`actions/aging.ts`](actions/aging.ts).
- Core ERP writes are not broadly feature-blocked by plan at this stage.

## Upgrade-required errors

- Limit and feature enforcement now use a shared subscription enforcement helper in [`lib/subscription-enforcement.ts`](lib/subscription-enforcement.ts).
- Backend enforcement throws consistent, parseable upgrade-required errors.
- Tenant UI strips the internal prefix and shows a clean upgrade CTA linked to `/account/billing#billing-plans`.
- Enforcement blocks also emit lightweight structured `console.warn` logs for operational visibility.

## Numeric limits

Numeric limits are enforced through the shared capability matrix plus shared usage counting helpers in [`services/subscription-usage.ts`](services/subscription-usage.ts).

Current enforced limits:

- `maxPortalUsers`
  - enforced before creating/sending a new portal user invitation
  - counts active portal users plus pending invites
- `maxProducts`
  - enforced before product creation
  - counts non-archived products
- `maxCustomers`
  - enforced before customer creation
  - counts non-archived customers
- `maxMonthlyOrders`
  - enforced before sales order creation
  - counts sales orders created during the current server-calendar month

When a limit is reached:

- the create/invite action is blocked
- the record is not created
- the user-facing form shows an upgrade message with a link to `/account/billing#billing-plans`

## Usage visibility

- Tenant Billing shows a read-only usage summary on [`/account/billing`](app/(app)/account/billing/page.tsx).
- Platform admin tenant detail shows the same summary on [`/admin/tenants/[id]`](app/admin/tenants/[id]/page.tsx).
- The shared UI is [`components/subscription/tenant-plan-usage-card.tsx`](components/subscription/tenant-plan-usage-card.tsx).
- Current metrics:
  - Portal users
  - Products
  - Customers
  - Monthly orders
- Billing includes warning states and upgrade CTAs:
  - below 80%: normal
  - 80% or more: `Near limit`
  - at or above the cap: `At limit`
- Platform admin uses the same usage data for visibility only, without upgrade CTAs.

## Billing reliability notes

- Stripe webhook processing is idempotent and tracked separately from tenant row updates.
- Subscription sync now logs explicit warnings for:
  - missing tenant linkage
  - invalid tenant ids
  - missing price items
  - unmapped Stripe price ids
  - non-canonical Stripe statuses that must be mapped into local tenant states
- When metadata linkage is missing, Stripe sync can fall back to stored `stripeCustomerId` or `stripeSubscriptionId` on the tenant row before giving up.
- Canceled, unpaid, and incomplete-expired Stripe subscriptions reconcile the tenant back to `free` + `canceled` instead of leaving a stale paid plan attached.

## What is intentionally not included yet

- No broad feature blocking across the full app.
- No billing portal flow for platform admins. Platform admins can launch Checkout for a tenant, but tenant self-service billing management remains tenant-facing.
- No hard enforcement for every plan capability or every page/action.
- No automated dunning or retry workflow beyond syncing Stripe subscription status back onto the tenant record.

## Related docs

- [Stripe subscriptions](./stripe-subscriptions.md)
- [Subscription plan capabilities](./subscription-plan-capabilities.md)
