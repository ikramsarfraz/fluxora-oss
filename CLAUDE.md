# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Stack and runtime

- **Next.js 16** (App Router, React 19) — APIs differ from earlier versions; consult `node_modules/next/dist/docs/` before reaching for patterns from memory.
- **Node** pinned in `.nvmrc` (currently `v24.14.1`). **pnpm 11.1.1** is the package manager — never use `npm` or `yarn`.
- Path alias: `@/*` resolves to the repo root (see [tsconfig.json](tsconfig.json)). All in-repo imports use `@/…`.
- Multi-tenant SaaS: tenants on subdomains, a reserved `admin.` host for platform admins, plus a root host for marketing/shared auth.
- **Auth: Better Auth** — config in [lib/auth.ts](lib/auth.ts), client in [lib/auth-client.ts](lib/auth-client.ts), DB schema in [db/auth-schema.ts](db/auth-schema.ts). Sessions resolve per-host (root vs tenant vs `admin.`); do not call `cookies()` directly for auth — go through the Better Auth helpers.
- **DB: Neon serverless Postgres + Drizzle ORM.** Schema entry at [db/schema.ts](db/schema.ts) with relations in [db/relations.ts](db/relations.ts) and the driver wired in [db/index.ts](db/index.ts). Both `@neondatabase/serverless` and `pg` are installed; production/edge paths use Neon, scripts under `db/*.ts` use `pg`.
- **UI: Tailwind CSS 4 + shadcn/ui** (Radix UI + Base UI primitives). Components live in [components/ui/](components/ui); the registry is configured via [components.json](components.json). Use `shadcn` CLI to add primitives rather than handcrafting Radix wrappers.
- **Forms: React Hook Form + Zod.** Validation schemas live with the owning module (e.g. `modules/distribution/<domain>/validators/`); `@hookform/resolvers` bridges the two. The same Zod schema usually backs both client-form validation and the server action's input parsing — keep them shared, not duplicated.
- **Deployment: Vercel** (see [vercel.json](vercel.json) for cron + region pins). Stripe + Plaid webhooks and AI-vision routes are exempted from rate limits in `proxy.ts`; check that list when adding new webhook endpoints.

## Common commands

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Dev server | `pnpm dev` |
| Production build | `pnpm build` |
| Production server (after build) | `pnpm start` |
| Lint | `pnpm lint` |
| Unit tests (all) | `pnpm test:unit` |
| Single unit test | `node --conditions=react-server --import tsx --test path/to/file.test.ts` |
| Generate Drizzle migration | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |
| Reset DB (destructive) | `pnpm db:reset` |
| Seed DB | `pnpm db:seed` |
| Enforce import boundaries | `pnpm check:boundaries` |

Tests use the **Node built-in test runner** with `tsx` — there is no Vitest/Jest. The list of test files is hard-coded in `package.json` under `test:unit`; **adding a new `*.test.ts` file requires appending it to that script** or it will not run in CI. The `--conditions=react-server` flag is required for any test that pulls in `server-only` or React Server Component code paths — leave it on by default to avoid resolution surprises.

The bulk of existing test coverage sits under `modules/distribution/supplier-invoices/` (vision dispatch, OpenAI provider, parsing pipeline, line/PDF matching, etc.) — that's the codebase's most failure-prone surface, so when changing AI / PDF parsing code, run the supplier-invoices tests specifically before the full suite.

Local dev requires `ROOT_DOMAIN` set (e.g. `localtest.me`) so the proxy can resolve tenant subdomains — see [docs/local-development.md](docs/local-development.md).

## Architecture: module-based, not layer-based

Domain logic lives under `modules/`, organized by namespace. The flat `services/` and `actions/` directories at the repo root have been **removed** — importing from `@/services/*` or `@/actions/*` is a hard boundary violation enforced by `scripts/check-module-boundaries.mjs`.

```
modules/
  core/           # tenant-agnostic infra: feature-flags, tenants, billing, platform-admin, workspace-settings
  distribution/   # the business vertical: orders, customers, products, inventory, lots,
                  # invoices, supplier-invoices, suppliers, payments, supplier-payments,
                  # expenses, categories, units-of-measure, price-chart, configuration,
                  # plaid, inbox, onboarding
  shared/         # domain-agnostic primitives used by 2+ modules
```

**Each module's `index.ts` is its only public entry point.** External code imports `@/modules/distribution/orders`, never `@/modules/distribution/orders/components/foo`. The top-level `modules/distribution/index.ts`, `modules/distribution/actions.ts`, and `modules/shared/actions.ts` are aggregate barrels that re-export from sub-modules; cross-cutting consumers (e.g. dashboard, aging) import from them.

### Forbidden import directions (enforced by `pnpm check:boundaries`)

- `modules/**` → `@/app/`
- `modules/distribution/<A>/**` → `modules/distribution/<B>/**` (cross-domain coupling — expose via a service or shared util)
- `modules/core/**` → `modules/distribution/**`
- `modules/shared/**` → `modules/distribution/**`
- Anyone → `@/services/` or `@/actions/` (legacy paths — import from the owning module)

`modules/shared/` may import from `modules/core/` **only** for auth/session, tenant resolution, subscription/billing context, and portal user identity helpers. See [docs/module-architecture.md](docs/module-architecture.md) for the full rationale.

### Client/server boundary (critical)

Client components (`"use client"` files and everything in `components/`) **must not value-import from `@/services/*` or `@/db/*`** — those modules pull in `next/headers`, `cookies()`, and the DB driver and will fail the build. The rule:

- Runtime values for the client come from `@/hooks/*`, `@/modules/<domain>` actions, `@/components/*`, or `@/lib/*`.
- Types from `@/services/*` / `@/db/*` are fine **only** via `import type { … }` (erased at build).
- To call a server operation from the client: expose a `"use server"` action in the owning module, consume it via a React Query hook.
- Pure helpers (math, formatters, constants) belong in `@/lib/*`, not in an action — actions cost a network roundtrip.

Full rule: [.cursor/rules/client-imports.mdc](.cursor/rules/client-imports.mdc).

### `app/` route groups

The App Router is split by host audience, not just navigation grouping:

- `app/(app)/` — authenticated tenant app shell (sidebar + breadcrumb); most distribution routes live here.
- `app/(auth)/` — unauthenticated pages (sign-in, sign-up, invite, password reset) on the root host.
- `app/(marketing)/`, `app/pricing/`, `app/features/`, `app/changelog/`, `app/reel/` — public marketing on the root host.
- `app/(onboarding)/`, `app/onboarding/`, `app/select-destination/` — post-signup tenant bootstrap.
- `app/admin/` — platform-admin routes; the `admin.` host restricts everything to this segment via `proxy.ts`.
- `app/api/` — Next.js route handlers (Better Auth, ERP APIs, Stripe + Plaid webhooks).

When adding a tenant-app page, place it under `app/(app)/<feature>/` and gate it with the owning module's `FEATURE` constant. Route group boundaries (`(group)`) do not affect URLs but do select the layout that wraps the page.

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

- **Client data goes through TanStack Query.** React Query hooks live in `hooks/use-*` (cross-cutting) or `modules/<domain>/hooks/` (domain-specific) and wrap `"use server"` actions exported from the module. Query keys are centralized in [lib/query/keys.ts](lib/query/keys.ts) — reuse existing factories rather than inlining tuple keys so invalidation stays consistent.
- **Compat re-exports** in `lib/` exist during the in-flight migration to modules — root-level `actions/` and `services/` have been removed entirely (server logic now lives inside the owning `modules/<domain>/services/` and `modules/<domain>/actions/`). New code imports from the module directly; if you touch a compat shim in `lib/`, prefer migrating callers over expanding the shim.
- **`types.ts` per module** re-exports the practical domain types (inferred from services / Zod / Drizzle `$inferSelect`) rather than redefining them. The service/schema is the source of truth.
- **`@react-pdf/renderer` and `pdf-parse`** are marked `serverExternalPackages` in [next.config.ts](next.config.ts) — needed because the RSC bundler otherwise resolves `react` to the server build and breaks PDF rendering. Don't remove without testing PDF output.
- **Sentry** is wired via `withSentryConfig` in `next.config.ts` plus `instrumentation*.ts` and `sentry.*.config.ts`. Source map upload is gated on `SENTRY_AUTH_TOKEN`.
- **File storage is Cloudflare R2** (S3-compatible, accessed via `@aws-sdk/client-s3`). Uploads go through presigned URLs; never assume local-disk storage when wiring file features.

## Further reading

The `docs/` directory has detailed guides; [docs/README.md](docs/README.md) is the index. Start with [docs/module-architecture.md](docs/module-architecture.md) for the module layout rationale, [docs/local-development.md](docs/local-development.md) for env/host setup, [docs/feature-flows.md](docs/feature-flows.md) for end-to-end domain flows, [docs/rules/README.md](docs/rules/README.md) for business rules & permissions (e.g. credit limits, multi-page imports), [docs/ai-setup.md](docs/ai-setup.md) for the OpenAI / vision pipeline used in supplier-invoices, and [docs/stripe-subscriptions.md](docs/stripe-subscriptions.md) + [docs/subscription-system-overview.md](docs/subscription-system-overview.md) for billing.
