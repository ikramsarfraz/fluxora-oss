# Acme Distribution ERP

Next.js (App Router) UI at the repo root; the previous FastAPI + Vite stack lives under [`docs/legacy-app/`](docs/legacy-app/).

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui (Radix UI + Base UI primitives) |
| Auth | [Better Auth](https://better-auth.com) — email/password + Google OAuth |
| Database | [Neon](https://neon.tech) serverless Postgres |
| ORM | [Drizzle ORM](https://orm.drizzle.team) + Drizzle Kit |
| Data fetching | TanStack Query v5, TanStack Table v8 |
| Forms | React Hook Form + Zod |
| Email | [Resend](https://resend.com) + React Email |
| Charts / PDF | Recharts, @react-pdf/renderer |
| File storage | [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| Deployment | [Vercel](https://vercel.com) |

## Local dev

1. **Backend** (from `docs/legacy-app/`): `./run-one-port.sh` or `uvicorn api.main:app --reload --host 127.0.0.1 --port 8005` so the API is on port **8005**.

2. **Frontend**: `npm run dev` (default [http://localhost:3000](http://localhost:3000)).

3. **Environment**: copy `.env.local.example` to `.env.local` and set **Better Auth** (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`), **Postgres** (`DATABASE_URL`), and optionally API rewrite vars.  
   If `NEXT_PUBLIC_API_URL` is unset, the app calls `/api` on the same origin; `next.config.ts` rewrites that to `ERP_API_ORIGIN` (default `http://127.0.0.1:8000`). Route handlers under `app/api/auth/*` are served by Next.js (Better Auth) and are not proxied to FastAPI.

See [`docs/monorepo-notes.md`](docs/monorepo-notes.md) for more.

## Layout

```
app/
  (app)/            # Authenticated app shell (sidebar + breadcrumb)
    (admin)/        # Admin-only routes (users, invite)
    (dashboard)/    # Dashboard / overview
    account/        # User account & profile
    customers/      # Customer management
    expenses/       # Expense tracking
    inventory/      # Inventory items
    invoice/        # New sales order entry
    lots/           # Lot management
    monthly-report/ # Monthly report
    orders/         # Sales orders
    payments/       # Payments
    price-chart/    # Price list
    products/       # Product catalogue
    supplier-invoices/
    suppliers/
    units-of-measure/
  (auth)/           # Unauthenticated pages (sign-in, sign-up, invite, reset)
  api/              # Next.js route handlers (Better Auth + ERP resource APIs)

components/         # Shared React components (app shell, auth, UI primitives)
  ui/               # shadcn/ui components

db/                 # Drizzle schema, migrations, relations, seed
emails/             # React Email templates (verification, reset, invite)
hooks/              # React Query hooks (use-users, use-user-invitations, …)
lib/
  api/              # Typed fetch client + per-resource API functions
  query/            # React Query key registry
  utils/            # Shared utilities
services/           # Server-only business logic (portal-users, invitations, auth)
```
