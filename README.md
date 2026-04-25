# Acme Distribution ERP

Acme Distribution ERP is a multi-tenant operations platform for food and wholesale distribution teams. It helps tenants manage customers, suppliers, products, lots, inventory, sales orders, invoices, payments, expenses, and user access from one workspace-scoped application. The app supports tenant subdomains, role-aware workflows, warehouse traceability, supplier receiving, sales order fulfillment, invoice generation, tenant branding, and file uploads backed by Cloudflare R2.

## Tech stack

| Layer         | Technology                                                                          |
| ------------- | ----------------------------------------------------------------------------------- |
| Framework     | [Next.js 16](https://nextjs.org) (App Router, React 19)                             |
| Language      | TypeScript 5                                                                        |
| Styling       | Tailwind CSS 4, shadcn/ui (Radix UI + Base UI primitives)                           |
| Auth          | [Better Auth](https://better-auth.com) — root, tenant, and platform-admin host auth |
| Database      | [Neon](https://neon.tech) serverless Postgres                                       |
| ORM           | [Drizzle ORM](https://orm.drizzle.team) + Drizzle Kit                               |
| Data fetching | TanStack Query v5, TanStack Table v8                                                |
| Forms         | React Hook Form + Zod                                                               |
| Email         | [Resend](https://resend.com) + React Email                                          |
| Charts / PDF  | Recharts, @react-pdf/renderer                                                       |
| File storage  | [Cloudflare R2](https://developers.cloudflare.com/r2/)                              |
| Deployment    | [Vercel](https://vercel.com)                                                        |

## Support workflow

Tenant users can submit and track support tickets from `/support`. New tickets are created from `/support/new`, can include supporting documents, and preserve tenant isolation so users only see tickets for their workspace. Ticket detail pages show the original report, attachments, status timeline, assigned platform admin when available, and tenant-visible progress updates.

Platform admins manage support from `admin.<ROOT_DOMAIN>/admin/support`. The platform view includes filters by status, priority, and issue type; ticket detail pages support status changes, assignment, internal notes, tenant-visible updates, and attachment downloads. Basic service-layer notifications use Resend when configured and fall back to structured console logging when email credentials are unavailable.

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
   - `NEXT_PUBLIC_SUPPORT_EMAIL`

4. **Run migrations**
   Run `npm run db:migrate`

5. **Run the app**
   Run `npm run dev`

### Host routing locally

The app now resolves three host types:

- `root`: marketing and shared auth on the base/root domain
- `tenant`: customer ERP workspaces on tenant subdomains
- `platform-admin`: internal Pelzer Solutions admin surface on the reserved `admin` host

The `admin` slug is reserved. It is not a customer tenant and cannot be created in `tenants.slug`.

For local development you can use either:

- `ROOT_DOMAIN=localtest.me` with `admin.localtest.me:3000`
- `ROOT_DOMAIN=app.localtest.me` with `admin.app.localtest.me:3000`

Examples below use `localtest.me` because it maps wildcard subdomains to `127.0.0.1` without editing `/etc/hosts`.

Examples:

- root marketing: [http://localtest.me:3000/](http://localtest.me:3000/)
- central login: [http://localtest.me:3000/login](http://localtest.me:3000/login)
- root signup: [http://localtest.me:3000/signup](http://localtest.me:3000/signup)
- platform admin login: [http://admin.localtest.me:3000/login](http://admin.localtest.me:3000/login)
- platform admin dashboard: [http://admin.localtest.me:3000/admin](http://admin.localtest.me:3000/admin)
- solo tenant login: [http://solo.localtest.me:3000/login](http://solo.localtest.me:3000/login)
- business tenant login: [http://company.localtest.me:3000/login](http://company.localtest.me:3000/login)
- tenant dashboard: [http://company.localtest.me:3000/](http://company.localtest.me:3000/)

Behavior:

- `localtest.me:3000/` = marketing homepage
- `localtest.me:3000/features` and `localtest.me:3000/pricing` = public marketing routes
- `localtest.me:3000/login` = central login
  Enter an email first and the app finds the tenant or lets the user choose among multiple tenants.
- `localtest.me:3000/signup` = first-time signup
  Business and solo tenants are created from the root domain, then the user is redirected to the tenant subdomain login.
- `admin.localtest.me:3000/login` = internal platform admin login
  Sign-in succeeds only for active `platform_users`, and tenant resolution is blocked for the reserved `admin` host.
- `admin.localtest.me:3000/admin` = internal platform admin surface
- `tenant.localtest.me:3000/login` = tenant login
  The tenant is derived from the request host and sign-in only succeeds if the user belongs to that tenant.
- `tenant.localtest.me:3000/` = tenant dashboard
  The proxy rewrites tenant root requests to the dashboard route internally.
- `tenant.localtest.me:3000/signup` = redirected back to `localtest.me:3000/signup`
- tenant-host access to `/admin` is blocked
- root-host access to `/admin` is blocked
- root-domain access to ERP routes like `localtest.me:3000/orders` is blocked and redirected back to the marketing home page
- unauthenticated tenant app requests are redirected to the tenant's `/login`
- authenticated users who hit tenant `/login` are redirected back to tenant `/`
- unauthenticated platform admin requests are redirected to the admin host `/login`

Examples:

- `solofounder.localtest.me:3000`
- `company.localtest.me:3000`
- `admin.localtest.me:3000`

Most modern browsers resolve `*.localhost` automatically, and `*.localtest.me` resolves publicly to `127.0.0.1`, so you usually do **not** need to edit `/etc/hosts` for local subdomain testing.

### UAT hosts

- root/shared auth: `uat.app.pelzersolutions.com`
- tenant workspace: `<tenant>.uat.app.pelzersolutions.com`
- platform admin: `admin.uat.app.pelzersolutions.com`

`admin.uat.app.pelzersolutions.com` is reserved for internal platform admins. It must never resolve as a customer tenant slug.

### Notes

- Both solo/freelancer accounts and business/team accounts are stored as `tenants`.
- Solo signup creates `tenantType=solo`.
- Business signup creates `tenantType=business`.
- Reserved tenant slugs such as `admin`, `www`, and `localhost` are blocked.

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
