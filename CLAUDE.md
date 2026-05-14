# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack and runtime

- **Next.js 16** (App Router, React 19) — APIs differ from earlier versions; consult `node_modules/next/dist/docs/` before reaching for patterns from memory.
- **Node** pinned in `.nvmrc` (currently `v24.14.1`). **pnpm 11.1.1** is the package manager — never use `npm` or `yarn`.
- Path alias: `@/*` resolves to the repo root (see [tsconfig.json](tsconfig.json)). All in-repo imports use `@/…`.
- Multi-tenant SaaS: tenants on subdomains, a reserved `admin.` host for platform admins, plus a root host for marketing/shared auth.

## Common commands

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Dev server | `pnpm dev` |
| Production build | `pnpm build` |
| Lint | `pnpm lint` |
| Unit tests (all) | `pnpm test:unit` |
| Single unit test | `node --import tsx --test path/to/file.test.ts` |
| Generate Drizzle migration | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |
| Reset DB (destructive) | `pnpm db:reset` |
| Seed DB | `pnpm db:seed` |
| Enforce import boundaries | `pnpm check:boundaries` |

Tests use the **Node built-in test runner** with `tsx` — there is no Vitest/Jest. The list of test files is hard-coded in `package.json` under `test:unit`; **adding a new `*.test.ts` file requires appending it to that script** or it will not run in CI.

Local dev requires `ROOT_DOMAIN` set (e.g. `localtest.me`) so the proxy can resolve tenant subdomains — see [docs/local-development.md](docs/local-development.md).

## Architecture: module-based, not layer-based

Domain logic lives under `modules/`, organized by namespace. The flat `services/` and `actions/` directories at the repo root have been **removed** — importing from `@/services/*` or `@/actions/*` is a hard boundary violation enforced by `scripts/check-module-boundaries.mjs`.

```
modules/
  core/           # tenant-agnostic infra: feature-flags, tenants, billing, platform-admin, workspace-settings
  distribution/   # the business vertical: orders, customers, products, inventory, lots,
                  # invoices, supplier-invoices, suppliers, payments, expenses,
                  # categories, units-of-measure, price-chart, configuration, plaid, inbox, onboarding
  shared/         # domain-agnostic primitives used by 2+ modules
```

**Each module's `index.ts` is its only public entry point.** External code imports `@/modules/distribution/orders`, never `@/modules/distribution/orders/components/foo`.

### Forbidden import directions (enforced by `pnpm check:boundaries`)

- `modules/**` → `@/app/`
- `modules/distribution/<A>/**` → `modules/distribution/<B>/**` (cross-domain coupling — expose via a service or shared util)
- `modules/core/**` → `modules/distribution/**`
- `modules/shared/**` → `modules/distribution/**`
- Anyone → `@/services/` or `@/actions/` (legacy paths — import from the owning module)

`modules/shared/` may import from `modules/core/` **only** for auth/session, tenant resolution, subscription/billing context, and portal user identity helpers. See [docs/architecture-overview.md](docs/architecture-overview.md) for the full rationale.

### Client/server boundary (critical)

Client components (`"use client"` files and everything in `components/`) **must not value-import from `@/services/*` or `@/db/*`** — those modules pull in `next/headers`, `cookies()`, and the DB driver and will fail the build. The rule:

- Runtime values for the client come from `@/hooks/*`, `@/modules/<domain>` actions, `@/components/*`, or `@/lib/*`.
- Types from `@/services/*` / `@/db/*` are fine **only** via `import type { … }` (erased at build).
- To call a server operation from the client: expose a `"use server"` action in the owning module, consume it via a React Query hook.
- Pure helpers (math, formatters, constants) belong in `@/lib/*`, not in an action — actions cost a network roundtrip.

Full rule: [.cursor/rules/client-imports.mdc](.cursor/rules/client-imports.mdc).

### Routing and host resolution

This codebase uses **`proxy.ts` at the repo root** (Next.js 16's renamed middleware) — not `middleware.ts`. It handles:

1. Rate limiting (`/api/**`, with explicit exemptions for webhooks, cron, and `/api/auth/**`; magic-link is rate-limited per-email).
2. Host classification into root / tenant / platform-admin via `lib/tenant-host.ts`. The `x-tenant-slug` request header is **stripped from incoming requests** and re-set from the hostname — clients cannot forge tenant identity.
3. Redirects/rewrites: tenant `/admin/{roles,branding,billing}` rewrite to `/tenant-admin/*` or `/account/billing`; tenant `/` rewrites to `/dashboard` when signed in; the `admin.` host restricts everything to `/admin/*`.
4. Sets the `TENANT_ROUTE_PATH_HEADER` so the tenant RSC layout can run subscription guards based on the original path.

When changing routing, the proxy's three host modes and the `matcher` config at the bottom of `proxy.ts` both need to be considered.

### Feature flags

Every distribution module exports a `FEATURE` constant (e.g. `ORDERS_FEATURE`) registered in `modules/core/feature-flags/`. Gate new routes/components with `requireFeature()` / `hasFeature()` from day one — features are toggled per-tenant.

## Drizzle migrations

The full rule is in [AGENTS.md](AGENTS.md) — restated here because getting this wrong silently breaks production: **`drizzle/meta/_journal.json` entries' `when` values must be strictly increasing**, and a new entry's `when` must be greater than the max `created_at` already in the `__drizzle_migrations` table. After `drizzle-kit generate`, verify the new entry's `when` is the largest in the file; if not, bump it (e.g. `previousMax + 100000`). Drizzle silently skips out-of-order migrations — no error, table just never gets created.

## Conventions worth knowing

- **Compat re-exports** in `lib/` and (formerly) `actions/`, `services/` exist during the in-flight migration to modules. New code imports from the module directly; if you touch a compat shim, prefer migrating callers over expanding the shim.
- **`types.ts` per module** re-exports the practical domain types (inferred from services / Zod / Drizzle `$inferSelect`) rather than redefining them. The service/schema is the source of truth.
- **`@react-pdf/renderer` and `pdf-parse`** are marked `serverExternalPackages` in [next.config.ts](next.config.ts) — needed because the RSC bundler otherwise resolves `react` to the server build and breaks PDF rendering. Don't remove without testing PDF output.
- **Sentry** is wired via `withSentryConfig` in `next.config.ts` plus `instrumentation*.ts` and `sentry.*.config.ts`. Source map upload is gated on `SENTRY_AUTH_TOKEN`.
