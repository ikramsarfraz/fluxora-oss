# Acme Distribution ERP

Acme Distribution ERP is a multi-tenant operations platform for food and wholesale distribution teams. It helps tenants manage customers, suppliers, products, lots, inventory, sales orders, invoices, payments, expenses, and user access from one workspace-scoped application. The app supports tenant subdomains, role-aware workflows, warehouse traceability, supplier receiving, sales order fulfillment, invoice generation, tenant branding, and file uploads backed by Cloudflare R2.

## Documentation

Detailed guides live under **`docs/`** so this page stays lean. Start here:

| Topic | Doc |
| ----- | --- |
| **Index of all docs** | [docs/README.md](docs/README.md) |
| **Local setup, env, subdomain routing, UAT** | [docs/local-development.md](docs/local-development.md) |
| **Stripe** (Checkout, Customer Portal, webhooks, CLI testing, catalog sync, signing secrets) | [docs/stripe-subscriptions.md](docs/stripe-subscriptions.md) |
| **Support tickets** (tenant vs platform workflows) | [docs/support-workflow.md](docs/support-workflow.md) |
| **Business rules & permissions** | [docs/rules/README.md](docs/rules/README.md) |
| **Misc. workspace notes** | [docs/monorepo-notes.md](docs/monorepo-notes.md) |

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

## Local dev (minimal)

See **[docs/local-development.md](docs/local-development.md)** for host routing (`localtest.me`, `admin.` subdomain behavior) and UAT URLs.

1. **`npm install`**
2. Copy **`.env.local.example`** → **`.env.local`** — set at minimum `DATABASE_URL`, `BETTER_AUTH_*`, `ROOT_DOMAIN`; add Stripe vars if you exercise billing. For Subscription Checkout use `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`; configure `STRIPE_PRICE_*` ids or populate the Stripe catalog with metadata **`plan=starter`**, **`growth`**, or **`enterprise`** (**[stripe subscriptions](docs/stripe-subscriptions.md)**).
3. **`npm run db:migrate`**
4. **`npm run dev`**

## Layout

```
app/
  (app)/            # Authenticated app shell (sidebar + breadcrumb)
    (admin)/        # Admin-only routes (users, invite)
    (dashboard)/    # Dashboard / overview
    account/        # User account & profile (& billing route)
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
  api/              # Next.js route handlers (Better Auth + ERP APIs + Stripe webhook)

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
