# Module Architecture

## Why Module-Based Architecture

This codebase organizes domain logic into explicit modules under `modules/` rather than scattering files across flat `lib/`, `services/`, `actions/`, and `hooks/` directories. The goals are:

- **Ownership clarity**: every file has an obvious owning domain
- **Independent understandability**: a module should be readable and testable without needing to understand other modules
- **Controlled public APIs**: external consumers import from `@/modules/<domain>/<subdomain>`, not from sub-paths three levels deep
- **Migration path**: new features go into modules from day one; legacy layer-based code migrates incrementally

---

## Module Namespaces

### `modules/core/`

Infrastructure that every tenant uses. Not business-vertical-specific.

| Subdomain | Purpose |
|---|---|
| `feature-flags/` | Feature gate constants, query helpers, server actions |
| `workspace-settings/users/` | Portal user management (invite, roles, directory) |
| `platform-admin/` | Internal operator tools — tenants, subscriptions, support, Stripe catalog |

### `modules/distribution/`

The primary business vertical. All 13 distribution domains live here.

| Subdomain | Purpose |
|---|---|
| `orders/` | Sales orders, fulfillment, attachments |
| `customers/` | Customer CRUD, addresses, pricing overrides |
| `products/` | Product catalog, units, categories |
| `inventory/` | Per-lot inventory items, warehouse adjustments |
| `lots/` | Receiving lots, bulk adjustments |
| `invoices/` | Sales invoices, PDF generation |
| `supplier-invoices/` | Purchase invoices, case-weight tracking, payments |
| `suppliers/` | Supplier CRUD, payment terms |
| `payments/` | Customer payment records |
| `expenses/` | Operational expense tracking |
| `categories/` | Product category taxonomy |
| `units-of-measure/` | Unit definitions and conversions |
| `price-chart/` | Customer-specific pricing overrides |
| `configuration/` | Workspace configuration UI |

### `modules/shared/`

Domain-agnostic utilities used by 2+ modules. Promote code here only when it is genuinely reusable across module boundaries. Do not use as a catch-all for things that haven't found a home yet.

---

## Module Internal Structure

A well-formed module looks like:

```
modules/distribution/orders/
  index.ts              ← public API — only import this from outside the module
  types.ts              ← domain type re-exports (inferred from services/Zod/Drizzle)
  feature.ts            ← ORDERS_FEATURE constant for feature gating
  permissions.ts        ← role-based access helpers for this domain
  actions/
    index.ts            ← "use server" wrappers over service functions
  components/           ← React components owned by this domain
  routes/               ← Next.js route components (thin wrappers)
  validators/           ← Zod schemas for form/action inputs
  utils/                ← pure, client-safe domain helpers (no server imports)
  db/                   ← domain-specific query helpers (server-only)
```

Not all modules need every layer. Add layers when there is real content.

---

## What Belongs Where

### In `app/`
- Route files (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`)
- Route group layouts and wrappers
- API route handlers (`app/api/`)
- The single-line module route re-exports: `export { default } from "@/modules/..."` 

**Not in `app/`**: business logic, domain types, form schemas, service calls.

### In a module
- All domain logic for that feature
- `"use server"` actions scoped to the domain
- React components specific to that domain
- Validators and form schemas
- Pure utility functions used only within the domain
- Domain type definitions

### In `lib/`
- Infrastructure cross-cuts: auth, pagination, Stripe, subscriptions, pg helpers
- Generic utilities used by many domains (currency, date, phone, uuid)
- Keeps `next/headers`-free utilities that must be safe for client bundles (document this with a comment when relevant)

### In `services/`
- Server-only database access functions for cross-cutting infrastructure (auth, tenants, billing, platform-admin, etc.)
- Distribution domain services have been migrated into their owning modules under `module/services/` with compat re-exports at the original paths

### In `shared/`
- React primitives and UI utilities used by 2+ modules
- Domain-agnostic type helpers

---

## Public Module APIs

Each module exposes a single `index.ts` as its public API. External code should import only from the module root:

```ts
// Good
import type { SalesOrderDetail } from "@/modules/distribution/orders";
import { ORDERS_FEATURE } from "@/modules/distribution/orders";

// Avoid — couples caller to internal structure
import type { SalesOrderDetail } from "@/modules/distribution/orders/components/order-detail-page";
```

The top-level `modules/distribution/index.ts` and `modules/core/index.ts` re-export all subdomain APIs, so callers can also import from the namespace root when appropriate.

---

## `types.ts` Convention

Each module's `types.ts` re-exports the practical domain types that a consumer would need when working with that module. Types come from:

1. **Service return types** (inferred via `Awaited<ReturnType<typeof ...>>`)
2. **Zod validator inferences** (via `z.infer<typeof schema>`)
3. **Drizzle row types** (via `$inferSelect`, `$inferInsert`)
4. **Local utility types** from `utils/`

Keep `types.ts` as re-exports rather than primary definitions — the source of truth lives in the service or schema file.

---

## Feature Flag Philosophy

Every distribution module exports a `FEATURE` constant (e.g., `ORDERS_FEATURE`) that is a string key registered in `modules/core/feature-flags/constants.ts`. Route pages and components call `requireFeature()` or `hasFeature()` to gate access.

This allows per-tenant feature enabling/disabling without code changes. New features should be gated from day one.

---

## Import Boundary Conventions

| From | May import from |
|---|---|
| `app/` | `modules/`, `lib/`, `services/`, `components/`, `db/` |
| `modules/distribution/X/` | `lib/`, `services/`, `db/`, `modules/core/`, `modules/shared/`, **not** other `modules/distribution/Y/` directly |
| `modules/core/` | `lib/`, `services/`, `db/`, `modules/shared/` |
| `modules/shared/` | `lib/`, `modules/core/` (auth/session/tenant/billing primitives only — see below) |
| `lib/` | `db/` (schema/types only), other `lib/` files |
| `services/` | `db/`, `lib/`, other `services/` |

Cross-distribution-module imports are a boundary violation. If two distribution modules share data, expose it through a service function, not a direct module import.

### Explicitly Forbidden Imports

The following import directions are architectural violations and must never appear:

| Forbidden | Reason |
|---|---|
| `modules/**` → `app/` | Modules must not depend on routing decisions |
| `modules/core/**` → `modules/distribution/**` | Core infrastructure must be vertical-agnostic |
| `modules/shared/**` → `modules/distribution/**` | Shared utilities must not know distribution workflows |
| `modules/distribution/<A>/**` → `modules/distribution/<B>/**` | Cross-domain coupling; use a service or shared utility instead |
| Any file → `@/services/` or `@/actions/` (root) | These root directories have been migrated; import from the module directly |

### The `shared → core` Narrow Exception

`modules/shared/` may import from `modules/core/` **only** for these primitives:

- Auth session helpers (`getCurrentUser`, `requireAuth`)
- Tenant resolution (`getCurrentTenant`, `getCurrentTenantCached`)
- Subscription/billing context (`assertTenantCanUseFeature`, plan capability helpers)
- Portal user identity helpers

**Why this exception exists:** Several shared utilities — such as permission helpers, audit hooks, and tenant-scoped query wrappers — genuinely need to know *who* the current user is and *what plan* they are on. These concerns are owned by `modules/core/` (tenants, billing). Without this narrow exception, shared utilities would need to accept session/tenant objects as parameters everywhere, which is impractical for deeply-used helpers.

**The constraint that keeps this safe:** `modules/shared/` must remain infrastructure-oriented. It must not import from `modules/core/platform-admin/` or any core subdomain that itself does business logic. If a shared utility starts needing distribution domain data (orders, products, etc.), it belongs in the distribution module, not in shared.

---

## Compatibility Re-exports

During incremental migration, legacy import paths are preserved via re-export shims:

```ts
// lib/expenses/metadata.ts (compat shim)
export * from "@/modules/distribution/expenses/utils/metadata";

// actions/customers.ts (compat shim)
export * from "@/modules/distribution/customers/actions";
```

These shims keep existing callers working while the codebase migrates. New code should always import from the module, not from the compat path.

---

## Deferred Migration — Known Architectural Debt

The following files belong in modules but have not been moved yet:

| File(s) | Intended home | Reason deferred |
|---|---|---|
| `services/platform-admin.ts`, `services/platform-admin-stripe-catalog.ts` | `modules/core/platform-admin/` | Deferred — no core module scaffold yet |
| `lib/warehouse/` (4 files) | `modules/distribution/inventory/utils/` | Shared by inventory+lots; 15+ callers need updating |
| `lib/invoices/sales-invoice-pdf.tsx` | `modules/distribution/invoices/pdf/` | Used directly by API route handler |
| `lib/inventory-status.ts` | Redundant with `lib/warehouse/insights.ts` | Should be removed or consolidated |
| `hooks/use-*.ts` (root-level) | Module-level hooks | Hooks directory predates module architecture |
| `actions/*.ts` (root-level) | Already re-export from modules — shims to clean up eventually | |

---

## Adding New Industry Verticals

The architecture is intentionally limited to the `distribution` vertical today. Do not add new verticals (e.g., `modules/retail/`, `modules/manufacturing/`) without a deliberate decision:

- A new vertical requires its own feature-gating, navigation, permission model, and data isolation strategy
- New domains within the existing distribution vertical are the right incremental step
- Shared infrastructure (auth, billing, tenancy) already supports multi-vertical apps in principle, but the UI and service layers do not yet

---

## Future Enforcement Tooling

These tools are recommended for enforcing import boundaries once the migration is further along:

### `eslint-plugin-boundaries`
Define explicit boundary zones (`core`, `distribution`, `shared`, `app`, `lib`) and assert that cross-zone imports follow the allowed matrix above. Rules would run in CI.

### `dependency-cruiser`
Generate a dependency graph from the source tree and assert that no cycles exist between modules. Can visualize the current state as a `.svg`.

### Conventions to document in the linter config (when adopted):
- `modules/distribution/X` may not import from `modules/distribution/Y` (cross-domain)
- `modules/shared` may not import from any module namespace
- `lib/` may not import from `services/` or `modules/`
- Each module's `index.ts` is the only permitted entry point for external callers

### Module ownership file (future)
A `CODEOWNERS`-style file that maps each module to a responsible team or developer. Useful once the team grows past 3-4 engineers.
