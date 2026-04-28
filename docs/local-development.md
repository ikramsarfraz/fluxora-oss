# Local development

## Quick start

1. **Install dependencies:** `npm install`
2. **Environment:** copy `.env.local.example` to `.env.local` and set required vars (see the **Required environment** section above and [Stripe subscriptions](./stripe-subscriptions.md) for billing).

3. **Migrations:** `npm run db:migrate`
4. **Dev server:** `npm run dev`

## Required environment (core)

Typically set in `.env.local`:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Neon (or Postgres) connection string |
| `BETTER_AUTH_SECRET` | Better Auth encryption secret |
| `BETTER_AUTH_URL` | Public base URL matching how you open the app (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Same URL for client-side auth URLs |
| `ROOT_DOMAIN` | Domain suffix for tenant slug resolution (`localhost`, `localtest.me`, or your app domain — no protocol, no trailing slash) |

Optional: `DATABASE_URL_UNPOOLED`, `NEXT_PUBLIC_SUPPORT_EMAIL`, Stripe vars per [Stripe subscriptions](./stripe-subscriptions.md).

## Host routing locally

The app distinguishes three host kinds:

| Kind | Role |
| ---- | ---- |
| `root` | Marketing and shared auth on the base domain |
| `tenant` | ERP workspaces on tenant subdomains |
| `platform-admin` | Internal admin UI on reserved **`admin`** host |

The slug **`admin`** is reserved — it cannot be created as `tenants.slug`.

### Recommended: `localtest.me`

Wildcard DNS maps `*.localtest.me` to `127.0.0.1` without editing `/etc/hosts`.

Examples (dev server on port **3000**):

- Root marketing: [http://localtest.me:3000/](http://localtest.me:3000/)
- Central login: [http://localtest.me:3000/login](http://localtest.me:3000/login)
- Signup: [http://localtest.me:3000/signup](http://localtest.me:3000/signup)
- Platform admin login: [http://admin.localtest.me:3000/login](http://admin.localtest.me:3000/login)
- Platform admin shell: [http://admin.localtest.me:3000/admin](http://admin.localtest.me:3000/admin)

Set `ROOT_DOMAIN=localtest.me` together with **`admin.localtest.me:3000`**.

Alternatively: `ROOT_DOMAIN=app.localtest.me` with `admin.app.localtest.me`.

### Behavior summary

- Root `/` shows marketing; `/login` is central tenant resolution; `/signup` creates tenants then sends users to subdomain login.
- `admin.<DOMAIN>` restricts sign-in to `platform_users` and serves `/admin`.
- Tenant hosts derive tenant from subdomain; ERP routes live there; `/admin` ERP routes from tenant hosts are blocked.
- Unauthenticated tenant requests redirect to `/login`; session cookies are scoped per deployment.

Modern browsers resolve `*.localhost` as well — `*.localtest.me` is documented here for predictable subdomain testing.

## UAT hosts

- Root / shared auth: `uat.app.pelzersolutions.com`
- Tenant: `<tenant>.uat.app.pelzersolutions.com`
- Platform admin: `admin.uat.app.pelzersolutions.com`

`admin.uat.app.pelzersolutions.com` is reserved for platform admins and must never be used as a customer tenant slug.

## Repository layout

The root [README](../README.md) includes an **app/layout** overview of `app/`, `components/`, `db/`, and `services/`.
