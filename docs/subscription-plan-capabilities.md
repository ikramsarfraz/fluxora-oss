# Subscription Plan Capabilities

This document defines the current application-side plan capability matrix. It is intentionally limited to reusable helper functions and documentation for now. There is no hard feature blocking, middleware gating, or auth behavior change in this phase.

## Current status

- Source of truth lives in [`lib/subscription-plan-capabilities.ts`](lib/subscription-plan-capabilities.ts).
- Helpers are read-only and safe to use in UI, server components, actions, and services.
- Current enforcement remains unchanged. Existing subscription access behavior still comes from the broader billing health guard, not from these per-feature capabilities.

## Current plan matrix

### Features

| Plan | Dashboard | Support tickets | Sales orders | Inventory | Purchasing | Reports | Platform support |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Free | Yes | Yes | No | No | No | No | No |
| Starter | Yes | Yes | Yes | Yes | No | No | No |
| Growth | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Enterprise | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Comped | Uses Enterprise capabilities via status override | Uses Enterprise capabilities via status override | Uses Enterprise capabilities via status override | Uses Enterprise capabilities via status override | Uses Enterprise capabilities via status override | Uses Enterprise capabilities via status override | Uses Enterprise capabilities via status override |

### Numeric limits

`Number.POSITIVE_INFINITY` is used for unlimited Enterprise and Comped limits.

| Plan | Max portal users | Max products | Max customers | Max monthly orders |
| --- | --- | --- | --- | --- |
| Free | 1 | 25 | 25 | 25 |
| Starter | 3 | 250 | 250 | 100 |
| Growth | 10 | 5,000 | 5,000 | 1,000 |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited |
| Comped | Unlimited | Unlimited | Unlimited | Unlimited |

## No UI blocking yet

- Do not redirect, hide routes, or reject writes based on these helpers yet.
- Do not add middleware checks from this matrix yet.
- Do not rewrite auth or tenant resolution around plans yet.

For now, these helpers exist so future enforcement and UI messaging can depend on one typed source of truth instead of repeating plan conditionals across the app.

## First UI-only gated feature

- The first applied gate is the tenant price chart page at [`app/(app)/(subscription-guard)/price-chart/page.tsx`](app/(app)/(subscription-guard)/price-chart/page.tsx).
- It uses the `reports` capability through `PlanFeatureGate`.
- When unavailable, the page shows an upgrade prompt instead of redirecting.
- Backend API calls and server actions remain unchanged for now.
- A second UI-only `reports` gate now wraps the dashboard AR aging section in [`app/(app)/(subscription-guard)/(dashboard)/components/dashboard-shell.tsx`](app/(app)/(subscription-guard)/(dashboard)/components/dashboard-shell.tsx).

## Future usage pattern

Start by reading the tenant once, then use the helpers at the edge of the behavior you want to evolve:

```ts
import {
  canUseFeature,
  getPlanLimit,
} from "@/lib/subscription-plan-capabilities";
import { getCurrentTenantCached } from "@/services/tenants";

const tenant = await getCurrentTenantCached();

const canSeeReports = canUseFeature(tenant, "reports");
const maxPortalUsers = getPlanLimit(tenant, "maxPortalUsers");
```

Recommended next steps when enforcement begins:

1. Use `canUseFeature()` for route-level messaging, disabled actions, or soft warnings.
2. Use `getPlanLimit()` near create/update flows that need count-based enforcement.
3. Keep raw `tenant.subscriptionPlan === ...` checks out of feature code unless the behavior is truly billing-specific and cannot use the shared matrix.
