# Acme Distribution ERP

Next.js (App Router) UI at the repo root; the previous FastAPI + Vite stack lives under [`docs/legacy-app/`](docs/legacy-app/).

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui (Radix UI + Base UI primitives) |
| Auth | [Better Auth](https://better-auth.com) — email/password + tenant subdomain auth |
| Database | [Neon](https://neon.tech) serverless Postgres |
| ORM | [Drizzle ORM](https://orm.drizzle.team) + Drizzle Kit |
| Data fetching | TanStack Query v5, TanStack Table v8 |
| Forms | React Hook Form + Zod |
| Email | [Resend](https://resend.com) + React Email |
| Charts / PDF | Recharts, @react-pdf/renderer |
| File storage | [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| Deployment | [Vercel](https://vercel.com) |

## Local dev

1. **Install dependencies**
   Run `npm install`

2. **Set environment**
   Copy `.env.local.example` to `.env.local`

3. **Required env vars**
   Set:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL=http://localhost:3000`
   - `NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000`
   - `ROOT_DOMAIN=localhost`

   Optional:
   - `DATABASE_URL_UNPOOLED`
   - `ERP_API_ORIGIN`
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_SUPPORT_EMAIL`

4. **Run migrations**
   Run `npm run db:migrate`

5. **Run the app**
   Run `npm run dev`

6. **Optional legacy backend**
   If you still need the old backend/API for specific routes, run it from `docs/legacy-app/` with `./run-one-port.sh` or `uvicorn api.main:app --reload --host 127.0.0.1 --port 8005`

### Tenant subdomains locally

Local tenant auth uses subdomains on `localhost`, so you can test without changing the `tenants` table name or introducing a separate workspace model.

Examples:
- root marketing: [http://localhost:3000/](http://localhost:3000/)
- central login: [http://localhost:3000/login](http://localhost:3000/login)
- root signup: [http://localhost:3000/signup](http://localhost:3000/signup)
- solo tenant login: [http://solo.localhost:3000/login](http://solo.localhost:3000/login)
- business tenant login: [http://company.localhost:3000/login](http://company.localhost:3000/login)
- tenant dashboard: [http://company.localhost:3000/](http://company.localhost:3000/)

Behavior:
- `localhost:3000/` = marketing homepage
- `localhost:3000/features` and `localhost:3000/pricing` = public marketing routes
- `localhost:3000/login` = central login
  Enter an email first and the app finds the tenant or lets the user choose among multiple tenants.
- `localhost:3000/signup` = first-time signup
  Business and solo tenants are created from the root domain, then the user is redirected to the tenant subdomain login.
- `tenant.localhost:3000/login` = tenant login
  The tenant is derived from the request host and sign-in only succeeds if the user belongs to that tenant.
- `tenant.localhost:3000/` = tenant dashboard
  The proxy rewrites tenant root requests to the dashboard route internally.
- `tenant.localhost:3000/signup` = redirected back to `localhost:3000/signup`
- root-domain access to ERP routes like `localhost:3000/orders` is blocked and redirected back to the marketing home page
- unauthenticated tenant app requests are redirected to the tenant's `/login`
- authenticated users who hit tenant `/login` are redirected back to tenant `/`

Examples:
- `solofounder.localhost:3000`
- `company.localhost:3000`

Most modern browsers resolve `*.localhost` automatically, so you usually do **not** need to edit `/etc/hosts` for local subdomain testing.

### Notes

- Both solo/freelancer accounts and business/team accounts are stored as `tenants`.
- Solo signup creates `tenantType=solo`.
- Business signup creates `tenantType=business`.
- Reserved tenant slugs such as `www` and `localhost` are blocked.

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
