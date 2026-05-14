# Fluxora — Feature Flows & QA Reference

Living reference of every feature in the app: what triggers it, what it touches, what can go wrong, and a copy-paste prompt at the end of each feature you can hand to ChatGPT (with image generation / DALL·E) or Claude Chat to produce a high-resolution system-design diagram image.

**Source branch when written:** `feature/ai-invoice-import` (commit context as of 2026-05-13).
**Use for:** system understanding, QA test planning, onboarding, diagramming.

---

## How to read each feature

Every feature section follows the same shape:

- **Purpose** — one line
- **Actors / roles** — who can trigger it
- **Entry points** — URLs, buttons, webhooks, crons
- **Flow** — numbered steps with file references
- **Data touched** — DB tables read/written
- **External effects** — emails, API calls, webhooks fired, events captured
- **Edge cases & failure modes** — what can break
- **Observability** — PostHog events, audit logs, Sentry, heartbeats
- **QA checklist** — concrete cases to verify
- **Diagram prompt** — paste into ChatGPT (with image gen / DALL-E) or Claude Chat to produce a system-design image

File paths are repo-relative.

---

## Contents

1. [Cross-cutting context](#0-cross-cutting-context)
2. [Auth: Signup, Login, Magic Links](#1-auth--signup-login-magic-links)
3. [Auth: Google OAuth](#2-auth--google-oauth)
4. [Tenancy: Onboarding & Tenant Chooser](#3-tenancy--onboarding--tenant-chooser)
5. [Tenancy: Multi-tenant Subdomain Routing](#4-tenancy--multi-tenant-subdomain-routing)
6. [Invitations](#5-invitations)
7. [Roles & Permissions](#6-roles--permissions)
8. [Subscription: Stripe Checkout](#7-subscription--stripe-checkout)
9. [Subscription: Stripe Customer Portal](#8-subscription--stripe-customer-portal)
10. [Subscription: Stripe Webhook](#9-subscription--stripe-webhook)
11. [Subscription: Plan capabilities & enforcement](#10-subscription--plan-capabilities--enforcement)
12. [Subscription: Stripe catalog sync](#11-subscription--stripe-catalog-sync)
13. [Feature Flags](#12-feature-flags)
14. [Customers](#13-customers)
15. [Suppliers](#14-suppliers)
16. [Products & Catalog (UOM, Categories)](#15-products--catalog-uom-categories)
17. [Lots](#16-lots)
18. [Inventory & FIFO Allocation](#17-inventory--fifo-allocation)
19. [Price Chart](#18-price-chart)
20. [Sales Orders](#19-sales-orders)
21. [Sales Invoices & PDF](#20-sales-invoices--pdf)
22. [Payments](#21-payments)
23. [Supplier Invoices (manual)](#22-supplier-invoices-manual)
24. [Supplier Invoice AI Import](#23-supplier-invoice-ai-import)
25. [Plaid Bank Linking & Sync](#24-plaid-bank-linking--sync)
26. [Expenses](#25-expenses)
27. [Dashboard (KPIs)](#26-dashboard-kpis)
28. [Support Tickets](#27-support-tickets)
29. [Platform Admin](#28-platform-admin)
30. [Workspace Settings & Tenant Branding](#29-workspace-settings--tenant-branding)
31. [File Uploads (Cloudflare R2)](#30-file-uploads-cloudflare-r2)
32. [Cron Jobs](#31-cron-jobs)
33. [Observability (Sentry, PostHog, Better Stack, Upstash)](#32-observability)
34. [Changelog page](#33-changelog-page)
35. [Appendix A — All PostHog events](#appendix-a--all-posthog-events)
36. [Appendix B — All cron jobs](#appendix-b--all-cron-jobs)
37. [Appendix C — All external services](#appendix-c--all-external-services)
38. [Appendix D — Master "whole system" diagram prompt](#appendix-d--master-whole-system-diagram-prompt)

---

## 0. Cross-cutting context

**Stack**: Next.js 16 (App Router, React 19, TS), Drizzle ORM, Neon Postgres, Better Auth, Tailwind 4 + shadcn/Base UI, TanStack Query/Table, Zod + React Hook Form, Resend, Cloudflare R2, Stripe, Plaid, OpenAI (primary AI) + Anthropic (fallback AI), Sentry, PostHog, Better Stack, Upstash Redis, Vercel + Vercel Cron.

**Hostnames**:
- `app.<root>` — primary tenant chooser / auth (root host)
- `<tenant>.<root>` — tenant workspace
- `admin.<root>` — platform admin

Resolution: [`proxy.ts`](proxy.ts) → [`lib/tenant-host.ts`](lib/tenant-host.ts) via `getRequestTenantHostContextFromHeaders()`.

**Session**: Better Auth cookie. Cross-subdomain enabled when `ROOT_DOMAIN` is not `localhost`. Session row carries `tenantId` (set on login / tenant select / accept-invite).

**Subscription gate**: [`app/(app)/(subscription-guard)/layout.tsx`](app/(app)/(subscription-guard)/layout.tsx) — blocks expired/cancelled tenants. Exempt paths: `/account/billing`, `/account/*`.

**Roles**: `owner | admin | sales | warehouse | accounting`. Defined in [`lib/auth/permissions.ts`](lib/auth/permissions.ts). Owner/admin have all permissions. See [§6](#6-roles--permissions) for matrix.

**Tenant boundary**: every service layer reads `getCurrentTenant()` and includes `tenantId` in every WHERE clause. No cross-tenant query is permitted.

---

## 1. Auth — Signup, Login, Magic Links

**Purpose**: Let a user create or access an account on the root host. Sign-in is exclusively magic-link based (no password reset ceremony — the magic link IS the reset).

**Actors / roles**: Anonymous visitor (new user), existing portal user, platform admin.

**Entry points**:
- `GET /signup` — root host only
- `GET /login` — root host AND tenant host (different callback defaults)
- `POST /api/auth/sign-in/magic-link` — Better Auth route (exempt from rate-limit gate in [`proxy.ts`](proxy.ts))
- Magic link in email → `GET /api/auth/magic-link/verify?...` (Better Auth internal)

**Flow — signup**:
1. User submits email in `SignUpForm` → server action `sendRootSignupMagicLinkAction()` in [`modules/shared/actions.ts:38`](modules/shared/actions.ts).
2. Service `sendRootSignupMagicLink()` in [`modules/shared/services/auth.ts:357`](modules/shared/services/auth.ts) — invokes Better Auth `magicLink` plugin with 15-minute expiry, callbackURL = `/onboarding`.
3. Resend sends `MagicLinkEmail` template (`lib/auth.ts:138-152`).
4. User clicks link → Better Auth verifies → invokes `databaseHooks.user.create` (`lib/auth.ts:157-172`) → inserts `user` row, calls `bootstrapAuthUserIdentityOnCreate()`, fires PostHog `user.signed_up`.
5. **No `portal_users` row exists yet** — created at onboarding (`§3`) or invitation accept (`§5`).
6. Redirect to `/onboarding`.

**Flow — login (existing user)**:
1. Submit email → magic link sent (same mechanism, different callback host context).
2. After verify, `databaseHooks.session.create` (`lib/auth.ts:176-282`) validates:
   - Platform-admin host → require `platform_users.isActive`
   - Tenant host → resolve tenant by slug → require `portal_users` row with `isActive`
   - If missing → attempt auto-claim via `claimApprovedTenantJoinRequestForSession()`
   - If still missing → throw `TENANT_MEMBERSHIP_REQUIRED`
3. Session created with `tenantId` set. Callback URL: `/dashboard` (tenant) or `/select-destination` (root, multi-tenant user).

**Flow — forgot password / reset**: Same as login. The 15-minute magic link replaces a password.

**Data touched**:
- Read: `user`, `portal_users`, `platform_users`, `tenants`, `tenant_join_requests`
- Write: `user` (on first signup), `session` (every login), `account` (Better Auth identity)

**External effects**:
- Resend email — `MagicLinkEmail` template
- PostHog `user.signed_up` event (signup only)

**Edge cases & failure modes**:
- Magic link rate-limited per email: `rateLimiters.magicLink` = 5/hour ([`lib/rate-limit.ts`](lib/rate-limit.ts))
- Token expired (>15 min) → Better Auth returns error, generic message to user
- Duplicate email at signup → unique constraint on `user.email`
- Login on tenant host where user isn't a member → `TENANT_MEMBERSHIP_REQUIRED` after verify (rejected at session-create hook)
- Cross-subdomain cookies require `ROOT_DOMAIN` set to non-localhost in production
- No PostHog event for login (sparse coverage)

**Observability**:
- PostHog: `user.signed_up` (server)
- Sentry: any thrown error in session-create hook captured by global handler
- Rate limit: Sentry warning if Upstash unreachable (graceful no-op)

**QA checklist**:
- [ ] Signup with new email → magic link email arrives → first click creates user + redirects to `/onboarding`
- [ ] Signup magic link expires after 15 min (use clock skew or wait)
- [ ] Signup 6th time in an hour from same email → rate-limited
- [ ] Login on tenant subdomain as a user not in that tenant → blocked at session-create (not after page load)
- [ ] Login on root host as multi-tenant user → land at `/select-destination`
- [ ] Login on tenant host where session cookie was set on a different tenant subdomain → cookie scope honors cross-subdomain in prod, separate in dev (localhost)
- [ ] Magic link re-used → "already used" error
- [ ] Magic link on platform-admin host as non-platform user → blocked

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's magic-link signup and login flow. Style: clean flat architecture diagram, white background, rounded rectangles for components, labeled arrows for data flow, professional sans-serif labels. Color palette — pale blue: User Browser; pale green: Next.js App (proxy + Better Auth); pale orange: Resend (email); pale yellow: Postgres; lavender: PostHog. Show the sequence left-to-right: User Browser → POST signup/login form → Next.js App generates magic link → Resend delivers email → User clicks link → Better Auth verifies token → branch into `databaseHooks.user.create` (signup only, writes `user` row + fires PostHog `user.signed_up`) or `databaseHooks.session.create` (login, validates `portal_users` membership against `tenants`) → on success, set cross-subdomain session cookie → redirect to `/onboarding` (signup) or `/dashboard` (login). Draw the failure branch as a dashed red arrow: missing membership → `TENANT_MEMBERSHIP_REQUIRED` error → `/login` redirect. Include a compact legend in the lower right.

---

## 2. Auth — Google OAuth

**Purpose**: Sign in or join workspaces via Google. Cannot create a workspace via Google directly; new Google users are routed to `/onboarding` after consent.

**Entry points**:
- Google button on `/signup` and `/login`
- Return URL: `/google/complete?flow={token}`
- Tenant selection: `/google/select-tenant`

**Flow**:
1. Click "Continue with Google" → `prepareGoogleAuthStartAction()` mints a signed flow token (HMAC-SHA256, 10-min expiry, base64url) — [`lib/google-auth-flow.ts:54-67`](lib/google-auth-flow.ts).
2. Browser redirects to Google OAuth consent (Better Auth Google plugin).
3. Google returns to `/google/complete?flow={token}` — calls `finalizeGoogleAuthFlow()` in [`modules/shared/services/auth.ts`](modules/shared/services/auth.ts).
4. Branching on accessible destinations:
   - No tenant + no platform-admin role → redirect `/onboarding`
   - Exactly one tenant → auto-select via `/select-destination?flow=…&tenant={slug}`
   - Multiple → chooser at `/select-destination?flow=…`
5. On tenant select, `completeGoogleTenantSelection()` validates membership (or approved join request → auto-create `portal_users`), updates session `tenantId`, redirects to tenant dashboard.

**Flow token payload**: `mode (login|signup), returnTo, tenantSlug?, signupType (solo|business), request context (host, port, protocol, rootDomain)`.

**Data touched**: `user`, `portal_users` (insert on first claim), `tenants`, `tenant_join_requests`, `session`.

**External effects**: Google OAuth (consent + token exchange).

**Edge cases & failure modes**:
- Flow token expired (>10 min) or HMAC mismatch → redirect `/login?error=…`
- Selected tenant inactive → "This workspace is not available"
- User chose Google account whose email doesn't match their existing `portal_users.email` → blocked
- New Google user who never created a workspace lands in `/onboarding` (cannot accidentally orphan)

**Observability**:
- PostHog: no explicit event (gap)
- Sentry: errors from Better Auth Google plugin

**QA checklist**:
- [ ] New Google email → consent → onboarding flow
- [ ] Returning Google user with one tenant → auto-route to tenant dashboard
- [ ] Returning Google user with multiple tenants → chooser shown
- [ ] Replay an old flow token (>10 min) → error redirect
- [ ] Tamper with flow token signature → error redirect
- [ ] Sign in with Google email that matches a pending invitation → invitation flow should claim membership

**Diagram prompt**:
> Generate a system-design diagram image for the Fluxora Google OAuth flow. Style: clean flat architecture diagram, white background, rounded rectangles, labeled arrows, professional. Color palette — pale blue: User Browser; pale green: Next.js App; pale orange: Google OAuth (third party); pale yellow: Postgres. Layout top-down. Show: User clicks "Continue with Google" → Next.js App mints a signed flow token (HMAC-SHA256, 10-minute expiry) → redirect to Google consent → Google returns to `/google/complete?flow={token}` → Next.js parses the token and queries accessible destinations from Postgres → three branches: (1) **no tenants** → redirect to `/onboarding`; (2) **one tenant** → auto-select via `/select-destination?flow=…&tenant={slug}`; (3) **multiple tenants** → render chooser at `/select-destination`. Include a separate branch labelled "approved join request" where `tenant_join_requests` is consumed to auto-create a `portal_users` row. Draw failure branches as dashed red arrows: expired (>10 min) or tampered HMAC → redirect to `/login?error=…`. Include a compact legend in the lower right.

---

## 3. Tenancy — Onboarding & Tenant Chooser

**Purpose**: Create a workspace (tenant) for a newly registered user, or let a multi-tenant user choose where to land.

### 3a. Onboarding (`/onboarding`)

**Triggers**: After signup magic link, after Google OAuth for a user with no tenants, or manual navigation by an authenticated user without a workspace.

**Flow**:
1. Page-load guard: must have authenticated session ([`app/onboarding/page.tsx:31-108`](app/onboarding/page.tsx)). If user has any accessible tenants, redirect to `/select-destination`.
2. Render `OnboardingForm` pre-filled with name suggestions + a tenant slug preview.
3. Submit → server action `completeUserOnboardingAction()` in [`modules/shared/actions.ts:63`](modules/shared/actions.ts).
4. Service `completeUserOnboarding()`:
   - Validate slug (not reserved per [`lib/tenant-slug-policy.ts`](lib/tenant-slug-policy.ts), not taken).
   - Update auth `user` with firstName/lastName/fullName.
   - Insert `tenants` row (`type = solo | business`, `isActive = true`).
   - Insert `portal_users` row (`role = owner`, `isActive = true`).
   - Update session `tenantId`.
   - Redirect to new tenant dashboard.

**Data touched**: `user`, `tenants` (insert), `portal_users` (insert), `session`.

**Plan defaults**: New tenant starts on platform default plan (effectively `free`); no Stripe subscription. Trial logic in `getTenantSubscriptionHealth()` ([`lib/tenant-subscription-health.ts`](lib/tenant-subscription-health.ts)).

**Edge cases**:
- Reserved slug (`admin`, etc.) → rejected
- Slug collision → rejected
- Empty tenant name → rejected
- No PostHog event captured on workspace creation (gap)

### 3b. Tenant Chooser (`/select-destination`)

Three modes:
1. **Authenticated chooser** (no token) — lists `portal_users` + `platform_users` rows; click → `completeAuthenticatedTenantSelection()` (or `…PlatformAdminSelection()`).
2. **Email-destination handoff** (`emailSelect` token) — issued from emails that need user to pick a tenant; finalized via `completeEmailSelectTenantHandoff()` / `…PlatformHandoff()`.
3. **Google flow** (`flow` token) — see §2.

**Failure modes**: No accessible destinations → auto-redirect `/onboarding` (Google flow); selected tenant inactive → error; user not a member of selection → error.

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's onboarding and tenant selection. Style: clean flat architecture diagram, white background, rounded rectangles, labeled arrows. Color palette — pale blue: User Browser; pale green: Next.js App; pale yellow: Postgres (`user`, `tenants`, `portal_users`). Show three entry vectors converging on `/select-destination` (depict each as a thin rectangle on the left): (a) authenticated session with multiple memberships, (b) email destination token (`completeEmailSelectTenantHandoff`), (c) Google OAuth flow token (from §2 diagram). In the right half of the diagram, show `/onboarding`: validate slug via tenant-slug policy → write `tenants` row → write `portal_users` row with `role=owner` → set `session.tenantId` → redirect to tenant dashboard. Draw a thin dashed arrow from `/select-destination` to `/onboarding` labelled "no accessible destinations". Include a compact legend in the lower right.

---

## 4. Tenancy — Multi-tenant Subdomain Routing

**Purpose**: Single Next.js app serves three host classes with different routing, auth scope, and gates.

**File**: [`proxy.ts`](proxy.ts) (Next 16 calls middleware "proxy").

**Host classes** (resolved by `getRequestTenantHostContextFromHeaders()`):
- `root` — `<root>` and `app.<root>`: marketing + tenant chooser
- `tenant` — `<slug>.<root>`: the app
- `platform-admin` — `admin.<root>`: admin console

**Behavior summary**:
| Host | Unauth user lands | Auth user with no tenant | Auth user with tenant |
|---|---|---|---|
| root | marketing | `/onboarding` | `/dashboard` (rewrite from `/`) |
| tenant | `/login?callbackUrl=/` | `/login` | tenant `(app)` shell |
| admin | `/login` | denied unless `platform_users.isActive` | `/admin` |

**Headers injected**:
- `x-tenant-slug` — for downstream services
- `x-tenant-route-path-header` (from [`lib/subscription-guard-constants.ts`](lib/subscription-guard-constants.ts)) — used by subscription guard layout

**Auth + sub gate**:
- Session cookie validated early
- `/admin/roles`, `/admin/branding`, `/admin/billing` on tenant host → rewritten to `/tenant-admin/*` or `/account/billing`
- Subscription block evaluated in `app/(app)/(subscription-guard)/layout.tsx`

**Cross-subdomain cookies**: enabled when `ROOT_DOMAIN` is not localhost ([`lib/auth.ts:36-37,80-84`](lib/auth.ts)). Trusted origins built dynamically: `https://*.{rootDomain}`, `http://*.{rootDomain}`.

**Exempt paths from per-tenant auth**:
- `/login`, `/signup`, `/onboarding`, `/select-destination`, `/google/*`, `/forgot-password`, `/reset-password`, `/invite/*`
- `/changelog`, `/privacy`, `/terms`
- `/api/auth/*`, `/api/invitations/*`, `/api/stripe/webhook`

**Edge cases**:
- Tenant subdomain that doesn't exist → 404 or redirect (depends on route)
- Reserved slugs blocked (`admin`, etc.)
- Localhost dev uses `.localtest.me` for subdomain emulation

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's multi-tenant request routing in `proxy.ts`. Style: clean flat architecture diagram, white background, rounded rectangles for stages, labeled arrows. Color palette — pale blue: incoming HTTPS request; pale green: middleware stages; pale yellow: data lookups (Postgres / session); pale red: redirects. Layout top-down with three vertical lanes after the first decision. Show: incoming request → host class resolution (first fork into three lanes — `root`, `<tenant>.root`, `admin.root`). Each lane shows in order: (1) exempt-path early exit (list a few examples: `/api/stripe/webhook`, `/api/auth/*`, `/invite/*`), (2) session cookie check, (3) tenant slug resolution and `x-tenant-slug` + `x-tenant-route-path` header injection, (4) admin-path rewrites on the tenant lane (e.g. `/admin/billing` → `/account/billing`), (5) callback-URL composition for unauthenticated users, (6) handoff to the App Router. Below the lanes, draw a wide rectangle for the subscription-guard layout that intercepts authenticated tenant requests; show its arrow to `/billing-blocked` for cancelled/expired tenants. Include a compact legend in the lower right.

---

## 5. Invitations

**Purpose**: Admin invites a user by email into the current tenant with a specific role.

**Files**: [`modules/core/workspace-settings/services/invitations.ts`](modules/core/workspace-settings/services/invitations.ts), [`app/api/invitations/*`](app/api/invitations/), [`app/api/user-invitations/*`](app/api/user-invitations/), [`emails/invite-user.tsx`](emails/invite-user.tsx).

**Flow — send**:
1. Admin opens tenant user management → fills email, fullName, role.
2. Server action invokes service → insert `user_invitations` row: random UUID token, status `pending`, expiresAt = now + 30 days, invitedByUserId.
3. Resend sends `InviteUserEmail` with link `{tenantHost}/invite/{token}`.

**Flow — accept**:
1. Recipient clicks → `/invite/{token}` page → `getInvitationPreview(token)` returns fullName, email, role (no auth required).
2. If new user → redirect `/signup?token={token}` (tenant or root host).
3. If existing user signed in → "Accept Invite" button POSTs to `/api/invitations/accept`.
4. `acceptInvitation()` → `completeInvitationFromSession()`:
   - Validate session, session.user.email == invitation.email (case-insensitive)
   - If `portal_users` row already exists for (authUserId, tenantId): mark accepted, return
   - Else: `createPortalUser()` with invitation.role
   - `setAuthSessionTenantId()` → cookie now scoped to tenant
   - Update `user_invitations`: status `accepted`, acceptedAt = now
   - Return redirect to tenant dashboard

**Flow — magic-link resend**: `POST /api/invitations/send-magic` → `sendInvitationMagicLink()` mints a new Better Auth magic link with callback to the invite page (no auto-accept — still requires explicit POST `/accept`).

**Flow — list pending**: `GET /api/user-invitations` → `listPendingInvitationsForAdmin()` (workspace-scoped admin view).

**Flow — revoke**: `revokeUserInvitationAction(invitationId)` → status `revoked`.

**Data touched**: `user_invitations` (insert / update), `portal_users` (insert on accept), `session` (update tenantId).

**External effects**: Resend `InviteUserEmail`, Resend `MagicLinkEmail` (resend flow).

**Edge cases & failure modes**:
| Case | Status / response |
|---|---|
| Token not found | 404 |
| Expired (`expiresAt < now`) | 410 |
| Already accepted | 410 |
| Revoked | 410 |
| Session email != invitation email | 403 |
| Tenant inactive | error |
| Email reused with different auth_user_id | error "already used with a different login" |

**Observability**: No PostHog events for invitations (gap). Audit log entry on accept (implied; not verified by greps).

**QA checklist**:
- [ ] Send invite to new email → invitee receives email → signup → click link → joins as expected role
- [ ] Send invite to existing user with same email → accept → joins existing user to new tenant
- [ ] Send invite, wait past expiry → recipient gets 410
- [ ] Revoke invite → recipient gets 410
- [ ] Accept invite while signed in as wrong email → 403
- [ ] Resend magic link → new email arrives, old link still works until original expiry
- [ ] Invited role assignments enforced — invite as `sales`, verify cannot fulfill orders

**Diagram prompt**:
> Generate a system-design diagram image for the Fluxora invitation lifecycle. Style: clean flat architecture diagram, white background, rounded rectangles for components, labeled arrows. Color palette — pale blue: Admin Browser and Invitee Browser (two separate boxes); pale green: Next.js App; pale orange: Resend; pale yellow: Postgres (`user_invitations`, `portal_users`, `session`). Layout left-to-right. Show: Admin Browser submits invite (email + role) → Next.js writes `user_invitations` (UUID token, `expiresAt = now + 30d`, status `pending`) → Resend sends `InviteUserEmail` to Invitee Browser → Invitee clicks magic link → `/invite/{token}` shows preview via `getInvitationPreview` → branch: (a) **new user** → `/signup?token=…` → magic-link signup → returns to accept; (b) **existing user signed in** → POST `/api/invitations/accept` → email match + tenant-active checks → insert `portal_users` (with invitation role) → set `session.tenantId` → mark invitation `accepted` → redirect to tenant dashboard. Draw failure branches as dashed red arrows: expired (410), revoked (410), email mismatch (403), already accepted (410). Include a compact legend in the lower right.

---

## 6. Roles & Permissions

**File**: [`lib/auth/permissions.ts`](lib/auth/permissions.ts).

**Roles**: `owner | admin | sales | warehouse | accounting`.

**Permission matrix** (from [`lib/auth/permissions.ts:65-87`](lib/auth/permissions.ts)):

| Permission | owner | admin | sales | warehouse | accounting |
|---|---|---|---|---|---|
| edit_order | ✔ | ✔ | ✔ | | |
| confirm_order | ✔ | ✔ | ✔ | | |
| fulfill_order | ✔ | ✔ | | ✔ | |
| short_ship_order | ✔ | ✔ | | ✔ | |
| reverse_fulfillment | ✔ | ✔ | | ✔ | |
| generate_invoice | ✔ | ✔ | | | ✔ |
| record_payment | ✔ | ✔ | | | ✔ |
| view supplier invoices | ✔ | ✔ | | ✔ | ✔ |
| edit supplier invoices | ✔ | ✔ | | ✔ | ✔ |
| complete supplier invoices | ✔ | ✔ | | ✔ | |
| reverse supplier receipts | ✔ | ✔ | | ✔ | |
| delete drafts | ✔ | ✔ | | ✔ | |
| record_supplier_payment | ✔ | ✔ | | | ✔ |
| adjust inventory | ✔ | ✔ | | ✔ | |
| manage expenses | ✔ | ✔ | | | ✔ |

**Enforcement points**:
- Server-side guard: `requirePermission(role, permission)` throws ([`lib/auth/permissions.ts:136-143`](lib/auth/permissions.ts))
- Predicate: `can(role, permission)` returns boolean
- UI gating: components read role from session/context and hide buttons

**Escalation**: only owner/admin can change roles (role updates via workspace settings). Invitee role set by inviter.

**QA checklist**:
- [ ] Confirm every action listed above is rejected for each role NOT marked
- [ ] Confirm UI hides disallowed action buttons (defense in depth, not sole gate)
- [ ] Confirm role change by non-admin is rejected

**Diagram prompt**:
> Generate a system-design image of the Fluxora role/permission matrix as a radial mindmap. Style: clean flat design, white background, central node "Fluxora roles" with five colored branches radiating outward. Color palette: gold for owner/admin (superset), blue for sales, green for warehouse, purple for accounting. Under each role, list the granted permissions as small rounded labels. Owner and admin should visually overlap or be drawn as a single "all permissions" superset on top; specialized roles fan out beneath. Permissions to include: edit_order, confirm_order, fulfill_order, short_ship_order, reverse_fulfillment, generate_invoice, record_payment, supplier-invoice view/edit/complete/reverse/delete-drafts, record_supplier_payment, adjust_inventory, manage_expenses. Include a compact legend in the lower right.

---

## 7. Subscription — Stripe Checkout

**Purpose**: Tenant admin starts a paid subscription (`starter | growth | enterprise`).

**Entry point**: `/account/billing` → "Upgrade" → server action `startTenantAdminStripeCheckoutAction(plan)` ([`modules/core/billing/actions.ts:16`](modules/core/billing/actions.ts)).

**Flow**:
1. Validate plan via `checkoutPlanSchema` ([`lib/stripe/checkout-plan-schema.ts:6`](lib/stripe/checkout-plan-schema.ts)).
2. Resolve `stripePriceId` via `resolveStripePriceIdForPaidPlan()` ([`modules/core/billing/stripe-tenant-billing/lib/plan-resolution.ts:45-60`](modules/core/billing/stripe-tenant-billing/lib/plan-resolution.ts)):
   - First: `SELECT stripePriceId FROM stripePrices WHERE billingPlanKey = $plan AND active = true ORDER BY createdAt DESC LIMIT 1`
   - Fallback: env `STRIPE_PRICE_STARTER | STRIPE_PRICE_GROWTH | STRIPE_PRICE_ENTERPRISE`
3. `createTenantStripeCheckoutSession()` → `stripe.checkout.sessions.create({ mode: "subscription", customer, line_items, metadata })` with `STRIPE_METADATA_TENANT_ID`.
4. Redirect user to hosted Checkout.
5. After payment, Stripe → success URL `{origin}/account/billing?success=1&session_id={id}` (cancel → `?canceled=1`).
6. Webhook (`§9`) is the authoritative source for tenant subscription state.

**Data touched**: read `tenants`, `stripe_prices`. No direct DB write (webhook handles it).

**External**: Stripe `checkout.sessions.create`.

**Edge cases**:
- No `stripePrices` row + no env fallback → action errors
- Tenant has no `stripeCustomerId` → Stripe creates one; webhook records on `customer.subscription.created`
- User abandons Checkout → cancel redirect; no DB change
- Race: user upgrades twice → second Checkout creates a separate subscription; admin must cancel one in Portal

**QA checklist**:
- [ ] Each plan key resolves to the right price (DB and env paths)
- [ ] Tenant metadata flows through to Stripe (visible in Stripe Dashboard)
- [ ] After Checkout success, webhook fires and tenant.subscriptionPlan/status updated
- [ ] Cancel redirect lands at `/account/billing?canceled=1` with no state change
- [ ] Non-admin role cannot start checkout

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora Stripe Checkout. Style: clean flat architecture diagram, white background, rounded rectangles, labeled arrows. Color palette — pale blue: Tenant Admin Browser; pale green: Next.js App (server action); pale yellow: Postgres (`stripe_prices`, `tenants`); pale orange: Stripe (hosted Checkout). Layout left-to-right. Show: Admin clicks "Upgrade {plan}" → server action validates plan via Zod schema → resolve `stripePriceId` (first from `stripe_prices` DB table by `billingPlanKey`, fallback to `STRIPE_PRICE_*` env var) → call `stripe.checkout.sessions.create({ mode: subscription, line_items, customer, metadata: { tenantId } })` → redirect Admin Browser to Stripe-hosted Checkout → Admin completes payment → Stripe emits TWO parallel signals: (1) browser redirect to `/account/billing?success=1&session_id=…`, (2) webhook POST to `/api/stripe/webhook` (link to §9). Include a compact legend in the lower right.

---

## 8. Subscription — Stripe Customer Portal

**Purpose**: Tenant admin manages payment method, views invoices, cancels subscription.

**Entry point**: `/account/billing` → "Manage Billing" → server action `startTenantAdminStripeCustomerPortalAction()`.

**Flow**:
1. Tenant must have `tenants.stripeCustomerId` (set by prior Checkout or webhook).
2. `createTenantStripeCustomerPortalSession()` ([`modules/core/billing/stripe-tenant-billing/services/stripe-tenant-billing.ts:291-322`](modules/core/billing/stripe-tenant-billing/services/stripe-tenant-billing.ts)) → `stripe.billingPortal.sessions.create({ customer, return_url })`.
3. Return URL: `NEXT_PUBLIC_APP_URL` → fallback `BETTER_AUTH_URL` → fallback Vercel URL.

**Data**: read `tenants`. No write (Portal mutations come back via webhook).

**Edge cases**:
- No `stripeCustomerId` → action errors (button should be hidden)
- Portal configuration missing in Stripe Dashboard → Stripe returns error

**QA checklist**:
- [ ] Portal opens; user sees payment methods, invoices
- [ ] Cancel inside Portal → Stripe sends `customer.subscription.updated` (`canceled` or `cancel_at_period_end`) → webhook updates tenant
- [ ] Update payment method → reflected in subsequent webhooks

**Diagram prompt**: see §9 master prompt — Portal can be combined with Checkout/Webhook flow.

---

## 9. Subscription — Stripe Webhook

**Purpose**: Authoritative ingestion of Stripe state changes.

**Endpoint**: `POST /api/stripe/webhook` ([`app/api/stripe/webhook/route.ts:26-85`](app/api/stripe/webhook/route.ts)) — exempt from auth gate.

**Flow**:
1. Read raw body (must NOT parse before verify).
2. `stripe.webhooks.constructEvent(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET)` → HMAC-SHA256 verify. Invalid → 400.
3. Idempotency claim via `claimStripeWebhookEventForProcessing(event)`:
   - Returns `"skip"` if `stripeWebhookEvents.processingStatus = succeeded` for this event id → 200
   - Returns `"defer"` if another POST is `processing` (and <90s old) → 503 + `Retry-After`
   - Returns `"process"` if new or stale (>90s) → continue
4. Dispatch via `processStripeWebhookEvent(event)`. Handled events:
   - `checkout.session.completed` → retrieve subscription → `syncTenantFromSubscription()`
   - `customer.subscription.{created,updated}` → `syncTenantFromSubscription()`
   - `customer.subscription.deleted` → mark `canceled`, plan → `free`
   - `product.*`, `price.*` → `processStripeCatalogWebhook()` (see §11)
   - `invoice.payment_{succeeded,failed}` → logged only (audit, no mutation)
5. Finalize: update `stripeWebhookEvents` to `succeeded` or `failed` with error message.

**Data touched**:
- `stripeWebhookEvents` (insert + state machine)
- `tenants` (`stripeCustomerId`, `stripeSubscriptionId`, `subscriptionPlan`, `subscriptionStatus`, `trialEndsAt`, `currentPeriodEndsAt`)
- `auditLogs` (system actor, before/after snapshots)
- `stripeProducts`, `stripePrices` (catalog events)

**External**: Stripe API (`stripe.subscriptions.retrieve` on `checkout.session.completed`).

**Idempotency**:
- Table: `stripeWebhookEvents(stripe_event_id UNIQUE, processingStatus, errorMessage, processedAt)`
- Stale reclaim: `updatedAt - createdAt >= 90s` and status = processing
- Retry on unique-constraint race: up to 5 attempts

**Failure modes**:
- Out-of-order delivery: idempotency + row lock + reclaim handles it; deferred deliveries get 503 retry
- Unmapped price ID (no `stripe_prices` row, no env match) → warning, no tenant sync (manual intervention)
- Missing tenant linkage: tries metadata → subscription metadata → customer/subscription lookup; logs warning and skips if all fail
- Tampered signature → 400

**Observability**:
- Console: `[stripe webhook] claimed new event | skip duplicate delivery | defer | stale reclaim`
- No explicit Sentry/PostHog at the webhook handler (gap — global handler may catch)

**QA checklist**:
- [ ] Local dev: `stripe listen --forward-to http://localtest.me:3000/api/stripe/webhook` and confirm event ingestion
- [ ] Replay an event id → 200 + "skip duplicate delivery"
- [ ] Forge signature → 400
- [ ] Send out-of-order `subscription.updated` and `subscription.created` → final state matches latest event
- [ ] Stripe customer with metadata.tenantId missing → logged as warning, no DB write
- [ ] Subscription cancellation → tenant immediately blocked on next request (or at period end per Stripe config)
- [ ] Catalog event creates a `stripe_prices` row that subsequent Checkout uses

**Diagram prompt**:
> Generate a system-design diagram image for the Fluxora Stripe webhook handler. Style: clean flat architecture diagram, white background, rounded rectangles for stages, labeled arrows. Color palette — pale orange: Stripe (external); pale green: Next.js webhook handler stages; pale yellow: Postgres tables (`stripeWebhookEvents`, `tenants`, `stripeProducts`, `stripePrices`, `auditLogs`); pale red: error/defer responses. Layout top-down. Show: Stripe POSTs signed event → raw body captured (must not be pre-parsed) → `stripe.webhooks.constructEvent` HMAC-SHA256 verify (dashed red branch to 400 on invalid sig) → `claimStripeWebhookEventForProcessing` idempotency claim with three outcomes drawn as a fork: **skip** (already succeeded → 200), **defer** (concurrent in-flight, <90s → 503 + Retry-After), **process** (new or stale-reclaim). On `process`, dispatch to `processStripeWebhookEvent` and fan out to handlers for `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `product.*`, `price.*`, `invoice.payment_*`. Show each handler writing to its DB tables. End with finalize step updating `stripeWebhookEvents` row to `succeeded` or `failed`. Include a compact legend in the lower right.

---

## 10. Subscription — Plan capabilities & enforcement

**Files**: [`lib/subscription-plan-capabilities.ts`](lib/subscription-plan-capabilities.ts), [`lib/subscription-enforcement.ts`](lib/subscription-enforcement.ts), [`lib/subscription-usage-metrics.ts`](lib/subscription-usage-metrics.ts), [`lib/tenant-subscription-health.ts`](lib/tenant-subscription-health.ts), [`lib/subscription-guard-*`](lib/), [`app/(app)/(subscription-guard)/layout.tsx`](app/(app)/(subscription-guard)/layout.tsx), [`app/(app)/billing-blocked/`](app/(app)/billing-blocked/).

**Plan capabilities** (high-level):
| Plan | Features | Limits (users, products, customers, orders/mo) |
|---|---|---|
| free | dashboard, support_tickets | 1 / 25 / 25 / 25 |
| starter | + sales_orders, inventory | 3 / 250 / 250 / 100 |
| growth | + purchasing, reports | 10 / 5000 / 5000 / 1000 |
| enterprise | + platform_support | unlimited |

**Health states** from `getTenantSubscriptionHealth()`: `active | trial | grace | cancelled | expired`. `shouldBlockTenantAccess(health)` returns true for cancelled/expired outside grace.

**Enforcement**:
- **Action-time check**: services throw `createPlanLimitReachedError(key)` / `createFeatureUnavailableError(key)` with a prefix like `[SUBSCRIPTION_ENFORCEMENT:limit_reached:max_customers]`.
- **Block layout**: `(subscription-guard)/layout.tsx` redirects to `/billing-blocked` when health says block — exempts `/account/billing`, `/account/*`.
- **Usage display**: `getSubscriptionUsageMetrics(tenantId)` returns ratios for dashboard cards.

**Edge cases**:
- Health computed at every request — slight cost; cached implicitly via React server cache
- Grace window is plan-dependent; configuration in plan-capabilities module
- Pathname header missing → fail-closed redirect to `/billing-blocked`

**QA checklist**:
- [ ] At each plan limit, attempt action +1 → blocked with `limit_reached` error
- [ ] Toggle subscription to `cancelled` → next request redirects to `/billing-blocked` except billing pages
- [ ] Trial expires → app transitions to grace then block
- [ ] Owner cannot navigate to gated features on free plan; sees upsell

**Diagram prompt**:
> Generate a system-design image that combines (a) a state diagram of the Fluxora tenant subscription lifecycle and (b) a request-time enforcement flow. Style: clean flat design, white background, rounded rectangles for states, arrows annotated with the triggering event. Color palette — gold for active states, gray for inactive/blocked states. (a) States: `none | trial | active | grace | cancelled | expired`. Transitions to draw: signup → `trial` (or `none`); Stripe webhook `checkout.session.completed` → `active`; Stripe webhook `customer.subscription.deleted` → `cancelled`; trial timeout → `grace` → `expired`; Stripe webhook `customer.subscription.updated` with `cancel_at_period_end` → stays `active` until period end → `cancelled`. (b) On the right or below, draw the request-time enforcement flow: HTTPS request → `(subscription-guard)` layout → call `getTenantSubscriptionHealth` → `shouldBlockTenantAccess` → branch into either "pass through to route" or redirect to `/billing-blocked` (exempt paths `/account/billing`, `/account/*` excluded from the block). Include a compact legend in the lower right.

---

## 11. Subscription — Stripe catalog sync

**Purpose**: Mirror Stripe products/prices into Postgres so Checkout resolution is fast and offline-able.

**Entry points**:
- Admin: `syncStripeCatalogFullFromStripeApi()` (manually run from platform admin, see §28)
- Webhook: `product.*` / `price.*` events → `processStripeCatalogWebhook()`

**Files**: [`modules/core/billing/stripe-catalog/services/stripe-catalog.ts`](modules/core/billing/stripe-catalog/services/stripe-catalog.ts).

**Plan-key resolution priority**:
1. Price `metadata.plan` → `stripePrices.billingPlanKey`
2. Product `metadata.plan`
3. Env fallback at Checkout time

**Data**: `stripeProducts(id, name, description, metadataJson, active, …)`, `stripePrices(id, productId, billingPlanKey, type, amount, currency, metadataJson, active, …)`.

**External**: Stripe `products.list`, `prices.list` (pagination limit=100).

**Edge cases**: Price/product with `metadata.plan` missing → `billingPlanKey` stays null → Checkout falls back to env. Webhook delete events → soft-delete `active = false`.

**QA checklist**:
- [ ] Add a product+price in Stripe with metadata `plan=starter` → webhook upserts → row visible
- [ ] Delete in Stripe → row marked inactive
- [ ] Full sync produces same end-state as incremental webhooks

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's Stripe catalog sync. Style: clean flat architecture diagram, white background, rounded rectangles, labeled arrows. Color palette — pale green: Next.js handlers; pale orange: Stripe API; pale yellow: Postgres (`stripe_products`, `stripe_prices`). Layout: two entry points on the left feeding into a single write path on the right. Entry A: platform admin triggers `syncStripeCatalogFullFromStripeApi`, which paginates `stripe.products.list` (limit=100), then per product paginates `stripe.prices.list`. Entry B: Stripe webhook events `product.created|updated|deleted` and `price.created|updated|deleted` dispatched into `processStripeCatalogWebhook`. Both flow into the shared write path: `upsertStripeProductFromStripe` and `upsertStripePriceFromStripe`, with a small inset showing the `billingPlanKey` resolution priority (price metadata → product metadata). Include a compact legend in the lower right.

---

## 12. Feature Flags

**Files**: [`modules/core/feature-flags/`](modules/core/feature-flags/).

**Data**: `tenantFeatures(tenantId, feature, enabled)`. Default when row missing: `true` (i.e., flags are opt-out per tenant).

**Evaluation**: `getTenantFeatureEnabled(tenantId, feature)` returns boolean. Used by some platform-admin-controlled gating.

**Admin**: only platform admins can flip flags (set/enable/disable/delete) — UI under `/admin/features` or similar.

**QA checklist**:
- [ ] Default behavior: no row → enabled
- [ ] Disable a flag → tenant no longer sees the gated UI
- [ ] Non-platform-admin cannot flip flags

---

## 13. Customers

**Files**: [`modules/distribution/customers/`](modules/distribution/customers/), [`app/(app)/customers/`](app/(app)/customers/).

**Entry points**:
- `/customers` (list, server-paginated)
- `/customers/new`
- `/customers/[id]` (hero + KPIs + tabs)
- `/customers/[id]/edit`

**Server actions** ([`modules/distribution/customers/actions/index.ts`](modules/distribution/customers/actions/index.ts)):
- `getCustomersPageAction()` → paginated text search on `name | abbreviation`
- `getCustomerAction(id)` / `getCustomerPortfolioAction(id)` (hero metrics + tabs)
- `createCustomerAction(input)` / `updateCustomerAction(id, input)`
- `deleteCustomerAction(id)` — **soft delete** (sets `archivedAt`, `archivedByUserId`), logs `customer.delete` audit event

**Schema** ([`modules/distribution/customers/validators/customer.schemas.ts`](modules/distribution/customers/validators/customer.schemas.ts)):
- name (required, trimmed)
- abbreviation (1–32 chars, uppercase) — used in invoice numbers
- phoneNumber (optional)
- fuelSurchargeAmount (optional numeric)
- addresses[] — `addressType (shipping|billing|both)`, street, city, state (US 5-letter codes), zip (5 digits), `isDefault`

**Data touched**:
- `customers` (unique index `customers_tenant_name_unique`)
- `customerAddresses` (FK cascade delete on customer)
- `customerProductPrices` (read for hero/pricing)

**Computed hero fields** via `getCustomerPortfolio(id)`: total order value, recent order count, last order date, total invoice amount, AR balance.

**Edge cases**:
- Duplicate name per tenant → unique constraint violation
- Soft delete only — cannot hard-delete (use platform admin if needed)
- `customerProductPrices` not cascade-deleted (orphan rows possible)
- Plan limit `maxCustomers` checked before insert; throws `limit_reached:max_customers`

**Observability**: audit log on delete; no PostHog event captured in actions.

**QA checklist**:
- [ ] Create with duplicate name (case-insensitive?) → reject
- [ ] Edit abbreviation while invoices exist → confirm historical invoice numbers unchanged
- [ ] Delete (archive) → no longer shown in lists or pickers, existing orders/invoices unaffected
- [ ] Plan limit hit → friendly error
- [ ] Address with non-US state code → validation error
- [ ] Hero metrics match raw query when manually counted
- [ ] Server-side pagination: page through 100+ customers, ensure no duplicates / skips

**Diagram prompt**:
> Generate a system-design diagram image for the Fluxora Customer lifecycle. Style: clean flat architecture diagram, white background, rounded rectangles, labeled arrows. Color palette — pale blue: Tenant user browser; pale green: Next.js server actions; pale yellow: Postgres (`customers`, `customerAddresses`, `customerProductPrices`, `salesInvoices`). Layout left-to-right. Show: list/search → create (Zod validate → plan-limit check against `maxCustomers` → insert `customers` + `customerAddresses`) → detail (load portfolio via `getCustomerPortfolio` — joins `salesOrders`, `salesInvoices`, `payments` for hero KPIs and tab data) → edit → soft delete (set `archivedAt`, log audit event `customer.delete`). Draw a dashed red arrow for plan-limit-reached error path. Include a compact legend in the lower right.

---

## 14. Suppliers

**Files**: [`modules/distribution/suppliers/`](modules/distribution/suppliers/), [`app/(app)/suppliers/`](app/(app)/suppliers/).

**Mirror of Customers** with these differences:
- Fields: name, `netDays` (payment terms; nullable, falls back to net-0)
- Detail view computes `_invoiceCount` from `supplierInvoices`
- Delete is **restricted** by FK if `supplierInvoices` reference it (cannot archive while invoices exist)
- Unique index `suppliers_tenant_name_unique`

**Cross-links**: `productSupplierCosts` (cost per lb per supplier per product) — primary vs secondary vendor tracking. See §18.

**QA checklist**:
- [ ] Cannot delete supplier with invoices
- [ ] Net days null → AP aging treats as net-0
- [ ] Duplicate name per tenant blocked
- [ ] Supplier listed in product detail page when cost row exists

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora Supplier management. Style: clean flat architecture diagram, white background, rounded rectangles, labeled arrows. Color palette — pale green: Next.js server actions; pale yellow: Postgres tables. Layout left-to-right. Show CRUD on `suppliers`: list/search → create/edit (validate, plan-aware) → soft delete with a dashed red **restrict** arrow blocked by FK from `supplier_invoices`. To the right, draw the cost relationship: a many-to-many `productSupplierCosts` linking `products` ↔ `suppliers`, with a small star icon marking the **primary vendor** (`promoteProductVendor`) versus secondary. Include a compact legend in the lower right.

---

## 15. Products & Catalog (UOM, Categories)

**Files**: [`modules/distribution/products/`](modules/distribution/products/), [`modules/distribution/categories/`](modules/distribution/categories/), [`modules/distribution/units-of-measure/`](modules/distribution/units-of-measure/), [`db/seed-uom.ts`](db/seed-uom.ts), [`db/add-lb-sales-unit.ts`](db/add-lb-sales-unit.ts), [`db/split-multicases.ts`](db/split-multicases.ts).

**Entry points**:
- `/products` list (paginated, SKU/name search)
- `/products/new`, `/products/[id]`, `/products/[id]/edit`
- `/settings/categories` (per-tenant categories)
- `/settings/units-of-measure` (global UOM admin)

**Schema** ([`db/schema.ts`](db/schema.ts)):
- `products(id, tenantId, sku, name, defaultPricePerLb, species, baseUnitId, isActive, …)`
- `productUnits(productId, unitId, purpose, conversionToBase, isDefault, allowsFractional, sortOrder)` — multiple rows per product, one per **purpose**: `stock | purchase | sales | pricing | display`
- `productCategories(productId, categoryId)` (many-to-many)
- `categories(id, tenantId, name, slug, isActive, archivedAt)`
- `unitsOfMeasure(id, name, abbreviation, type, sortOrder, …)` — **global**, seeded from [`db/seed-uom.ts`](db/seed-uom.ts) (lb, kg, oz, g, ea, cs, hcs, bx, bag, plt, tr, pkt, gal, L, fl oz)

**Validations** (Zod): SKU 1–64, name 1–255, defaultPricePerLb numeric string, species 1–64.

**Permissions**: edit by owner/admin; reads by all roles.

**Plan limit**: `maxProducts` checked before insert.

**Catch-weight products**: a product is "catch-weight" if it has BOTH `lb` and `cs` sales-purpose `productUnits`. Triggers FIFO allocation UI on order lines (§17, §19).

**One-time migrations** (not run on every deploy):
- [`db/seed-uom.ts`](db/seed-uom.ts) — idempotent UOM seed (`onConflictDoNothing()`)
- [`db/add-lb-sales-unit.ts`](db/add-lb-sales-unit.ts) — adds `lb` sales unit to all products NOT in beverages/processed-foods (only if a `cs` sales unit already exists; cannot invent case weight)
- [`db/split-multicases.ts`](db/split-multicases.ts) — historical: split `cases > 1` `inventoryItems` into one-case-per-item with fresh barcodes, dividing weight equally

**Edge cases**:
- SKU duplicate per tenant → reject (app-level check; no DB unique index spotted)
- Product referenced by `supplierInvoiceLines` or `salesOrderLines` → delete blocked
- Conversion factor stored as decimal string; precision 4 for weights — be careful with FP arithmetic
- Product without `baseUnitId` defaults to case-only (non-catch-weight)

**QA checklist**:
- [ ] Create catch-weight product (lb + cs sales) → catch-weight UI appears on order lines
- [ ] Create fixed-case product (cs only) → no catch-weight UI; weight = cases × conversion
- [ ] Edit conversion factor while inventory exists → confirm prior fulfillments unchanged (cost snapshots preserved)
- [ ] Delete product with sales history → blocked
- [ ] Re-running seed-uom is idempotent
- [ ] Plan `maxProducts` hit → friendly error

**Diagram prompt**:
> Generate a system-design ER (entity-relationship) diagram image for Fluxora's product catalog. Style: clean flat ER diagram, white background, rectangular entity nodes with title bars and field lists, lines with crow's-foot notation for cardinality. Color palette — central node `products` in pale green; join tables in pale yellow; reference data (`unitsOfMeasure`, `categories`, `suppliers`, `customers`) in pale gray. Entities and relationships: `products` 1—N `productUnits` (with `purpose` enum: stock/purchase/sales/pricing/display); `productUnits` N—1 `unitsOfMeasure` (global, seeded list); `products` M—N `categories` via `productCategories`; `products` M—N `suppliers` via `productSupplierCosts` (per-vendor cost); `products` M—N `customers` via `customerProductPrices` (per-customer override). Add a callout box: "Catch-weight = product has BOTH `lb` and `cs` sales-purpose `productUnits` rows". Include a compact legend in the lower right.

---

## 16. Lots

**Files**: [`modules/distribution/lots/`](modules/distribution/lots/), [`app/(app)/lots/`](app/(app)/lots/).

**Purpose**: Traceable batches of product, usually received from a supplier invoice.

**Schema**:
- `lots(id, tenantId, lotNumber UNIQUE per tenant, supplierId FK restrict, receiveDate, expirationDate, state: active|archived|expired, createdAt)`
- `lotReceipts(id, lotId FK cascade, supplierInvoiceLineId FK cascade)` — many-to-one
- `inventoryItems` (see §17) — actual stock units belonging to a lot

**Creation paths**:
1. **Automatic** — on completing a supplier invoice (§22/§23): one lot per line (with override for lotNumberOverride / expirationDateOverride) + `lotReceipts` link.
2. **Manual** — direct CRUD via UI (assume admin/warehouse). Less common.

**Detail page** loads via `getLotById(id)`: joins supplier, `markdownHistories` (disposition discount history), `lotReceipts → supplierInvoiceLine → product + supplier`, `inventoryItems` with allocations and fulfillments.

**Expiry**:
- `isLotExpired()` filters lots during inventory allocation (§17)
- Default expiry on auto-create = `receiveDate + 7 days` unless overridden

**State transitions**: `active → archived | expired`. No rollback observed.

**Markdown / disposition**: `markdownHistories` table records discounts offered, quantity moved, sell-through %, expected vs actual revenue. PostHog event `markdown.applied` captured.

**Edge cases**:
- Cascade delete: deleting lot removes lotReceipts, inventoryItems, allocations, fulfillments
- Supplier delete restricted while lots reference it

**QA checklist**:
- [ ] Supplier-invoice receive creates one lot per line with default 7-day expiry
- [ ] lotNumberOverride respected and unique-checked per tenant
- [ ] Manual lot creation (if exposed) sets `lotReceipts = []`
- [ ] Expiry filter excludes expired lots from FIFO allocation
- [ ] Markdown application updates `markdownHistories` and fires PostHog event

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora Lot creation and lifecycle. Style: clean flat architecture diagram, white background, rounded rectangles for actions and DB tables, oval shapes for states. Color palette — pale green: server actions; pale yellow: Postgres (`lots`, `lotReceipts`, `inventoryItems`, `markdownHistories`); blue ovals for states. Layout left-to-right. Two entry paths on the left: (a) supplier-invoice complete → batch insert `lots` (one per line) + `lotReceipts` (links lot → supplier_invoice_line) + `inventoryItems` (one per case); (b) manual create by admin/warehouse. Center: state oval `active`. Right: state transitions — `active` → `expired` (date-driven, when `expirationDate < now`), `active` → `archived` (manual). Below: an arrow from `active` lots into the disposition flow that writes `markdownHistories` and fires PostHog `markdown.applied`. Include a compact legend in the lower right.

---

## 17. Inventory & FIFO Allocation

**Files**: [`modules/distribution/inventory/`](modules/distribution/inventory/), [`lib/warehouse/`](lib/warehouse/), [`modules/distribution/orders/services/orders.ts`](modules/distribution/orders/services/orders.ts).

**Entry points**:
- `/inventory` (list, paginated)
- `/inventory/[id]` (detail)

**Schema**:
- `inventoryItems(id, productId FK restrict, lotId FK restrict, barcodeId, exactWeightLbs, cases, costPerUnitSnapshot, costUnitTypeSnapshot, status, …)`
- Status enum: `in_stock | allocated | picked | packed | shipped | sold`
- `salesOrderLineAllocations(id, salesOrderLineId, inventoryItemId, allocatedWeightLbs, …)`
- `fulfillments(id, salesOrderLineId, inventoryItemId, quantityFulfilled, weightLbs, fulfilledAt, reversedAt, …)`
- `inventoryAdjustments(id, inventoryItemId, reason, quantity/weight before+after, appliedByUserId, …)`

**On-hand computation** (no separate `stock_movements` table — derived from `status`):
```
onHand    = SUM(cases) WHERE status IN (in_stock, allocated, picked, packed)
allocated = SUM(cases) WHERE status = allocated
available = SUM(cases) WHERE status = in_stock
```

**FIFO allocation** ([`modules/distribution/orders/services/orders.ts:78-115, 826-894`](modules/distribution/orders/services/orders.ts)):
1. Query `inventoryItems` for product, `status = in_stock`, no active allocations, lot not expired.
2. Sort by `compareInventoryByOldestLot()`: `receiveDate, lotCreatedAt, lotNumber, itemCreatedAt, barcodeId` ascending.
3. Exact-fit pass: pick items that sum exactly to `targetQuantity`.
4. If gap remains: pick smallest overshooting item.
5. Validate (`assertSalesOrderLinesCanAutoAllocateInventory`) — **no DB write yet** (allocation rows only written on confirm/fulfill).

**Manual lot override** (recent commit): user can pass `inventoryItemIds[]` per line; validation accepts the explicit picks instead of auto-FIFO.

**Adjustment flow** (`adjustInventoryItem`):
- Role gate: owner/admin/warehouse via `canAdjustInventory()`
- Blocked if status ∈ {shipped, sold}
- Blocked if active allocations or active fulfillments exist
- Inserts `inventoryAdjustments` row + updates item

**Edge cases**:
- Negative stock prevented at validation (`exactWeightLbs > 0`, `cases > 0`)
- Concurrency: two orders racing for the last inventory item — both may pass auto-allocation validation; only fulfillment write (which marks `allocated`) is exclusive
- Weight precision: stored as `numeric` string with 4 decimals (`roundInventoryWeight().toFixed(4)`)
- Multi-case-per-item legacy data was migrated 1-case-per-item via `db/split-multicases.ts`

**Observability**: audit log on adjustments. No PostHog events on adjust observed.

**QA checklist**:
- [ ] FIFO order honored: oldest lot allocated first
- [ ] Expired lot skipped even if oldest
- [ ] Manual lot pick overrides FIFO and validates feasibility
- [ ] Allocate beyond available → granular error message
- [ ] Adjust shipped item → forbidden
- [ ] Adjust item with active allocation → forbidden
- [ ] Two simultaneous fulfillments on same item → second errors (`allocated` status conflict)
- [ ] Weight rounding consistent across order, fulfillment, invoice

**Diagram prompt**:
> Generate a system-design diagram image with TWO panels for Fluxora inventory. Style: clean flat design, white background, rounded rectangles + ovals, labeled arrows. Color palette — pale green for processing stages, blue ovals for states. **Panel 1 (top)**: state diagram of an `inventoryItem`. States in order: `in_stock` → `allocated` → `picked` → `packed` → `shipped` → `sold`. Include a reverse arrow `allocated → in_stock` labelled "reverseFulfillment / restoreInventoryItemsToStock". **Panel 2 (bottom)**: the FIFO allocation algorithm as a flow chart. Start with: "Order line added (productId, targetQuantity)" → query candidate `inventoryItems` (filters: `status = in_stock`, no active allocations, lot not expired) → sort by composite key `receiveDate, lotCreatedAt, lotNumber, itemCreatedAt, barcodeId` ascending → exact-fit pass (select items summing exactly to targetQuantity) → if gap remains, smallest-overshoot fallback → result returned to UI tray. Add a note in a callout: "Allocation rows are written to `salesOrderLineAllocations` only on confirm/fulfill, not on line add". Include a compact legend in the lower right.

---

## 18. Price Chart

**Files**: [`modules/distribution/price-chart/`](modules/distribution/price-chart/), [`app/(app)/price-chart/`](app/(app)/price-chart/).

**Purpose**: Per-customer price overrides + per-supplier cost tracking, with a master/detail UI (recent commit).

**Tables**:
- `customerProductPrices(customerId, productId, pricePerLb)` — per-customer override
- `productSupplierCosts(productId, supplierId, costPerLb)` — multi-vendor cost
- `customers.fuelSurchargeAmount` — flat per-customer fuel surcharge

**Order-time price resolution** (`resolveLinePricePerLb()` in [`modules/distribution/orders/services/orders.ts:479-498`](modules/distribution/orders/services/orders.ts)):
1. `pricePerLbOverride` on the line (manual one-off)
2. `customerProductPrices.pricePerLb` for (customerId, productId)
3. `products.defaultPricePerLb`

**Actions**:
- `setCustomerProductPrice(customerId, productId, pricePerLb)` — upsert
- `deleteCustomerProductPrice(customerId, productId)`
- `applyMarkupToCustomer(customerId, markupPercent)` — bulk markup
- `updateCustomerFuelSurcharge(customerId, fuelSurchargeAmount)`
- `setProductSupplierCost(productId, supplierId, costPerLb)`
- `deleteProductSupplierCost(productId, supplierId)`
- `promoteProductVendor(productId, supplierId)` — set as primary

**COGS implication**: at fulfillment, `costPerUnitSnapshot` is captured from the item's lot → supplier cost. Primary vendor convention drives default cost.

**Permissions**: likely owner/admin only (not explicitly enumerated in ORDER_PERMISSIONS).

**Edge cases**:
- Markup applied → existing override rows updated; products without an override row may be ignored (verify behavior in agent)
- Resolution skips inactive prices? — needs check in code

**QA checklist**:
- [ ] Set customer override → next order line uses override price
- [ ] Remove override → line falls back to product default
- [ ] Apply 10% markup → all customer override rows updated
- [ ] Fuel surcharge propagates to invoice total
- [ ] Cost change to primary supplier reflected on future fulfillments (snapshots preserve historical)
- [ ] Promote secondary vendor to primary → confirm flag and any downstream defaults

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's price-per-lb resolution on a sales order line. Style: clean flat decision-tree diagram, white background, diamond shapes for decisions, rounded rectangles for outcomes, labeled arrows. Color palette — pale green: lookups; pale yellow: data sources. Inputs at top (rounded boxes): `customerId`, `productId`, optional `pricePerLbOverride`. First decision diamond: "override provided?" → yes → use override; no → next. Second decision: "row in `customerProductPrices` for (customerId, productId)?" → yes → use `customerProductPrices.pricePerLb`; no → fallback to `products.defaultPricePerLb`. End node at the bottom: "pricePerLbSnapshot stored on `salesOrderLines`". Include a compact legend in the lower right.

---

## 19. Sales Orders

**Files**: [`modules/distribution/orders/`](modules/distribution/orders/), [`app/(app)/orders/`](app/(app)/orders/), [`app/(app)/invoice/`](app/(app)/invoice/) (new SO entry).

**Status workflow**: `draft (sales_order) → confirmed → fulfilled`. Cancel possible only when no fulfillments exist.

**Entry points**:
- `/orders` (list)
- `/invoice` (new order entry — yes the URL says "invoice"; legacy)
- `/orders/[id]` (detail, edit, confirm, fulfill)

**Create flow** ([`modules/distribution/orders/services/orders.ts:createSalesOrder`](modules/distribution/orders/services/orders.ts)):
1. Validate customer + each line (product, salesUnit valid, `expectedCases > 0`).
2. Inventory feasibility check via `assertSalesOrderLinesCanAutoAllocateInventory()` — no DB write.
3. Plan limit: `countCurrentMonthSalesOrdersForTenant()` vs `maxSalesOrdersPerMonth`.
4. Insert `salesOrders` (status `sales_order`, orderDate, customerId, …).
5. Insert `salesOrderLines` with snapshots:
   - `productId, salesUnitId, expectedCases, unitType (catch_weight | fixed_case)`
   - `pricePerLbOverride` (optional)
   - `pricePerUnitSnapshot, pricingUnitTypeSnapshot, conversionToBaseSnapshot, baseUnitIdSnapshot, salesUnitNameSnapshot, abbreviationSnapshot`
6. Generate order number: `SO-{customer.abbrev}-{id.slice(0,8)}` stored on row.

**Confirm**: status `sales_order → confirmed`. Workflow rules in [`modules/distribution/orders/utils/order-action-rules.ts`](modules/distribution/orders/utils/order-action-rules.ts).

**Fulfill** (`recordSalesOrderFulfillment`):
- Role: `fulfill_order` (warehouse/admin/owner)
- Inserts `salesOrderLineAllocations` (if not yet) + `salesOrderFulfillments` with cost snapshot (`calculateFulfillmentCostSnapshot` lines 121–148)
- Calls `markInventoryItemsAllocated()` → status `allocated`

**Short ship / reversal**:
- `markSalesOrderLineShortShipped()` — sets `shortShippedAt, shortShippedByUserId`
- `reverseSalesOrderFulfillment()` — sets `reversedAt`, restores inventory to `in_stock` (`restoreInventoryItemsToStock`)
- Reversed fulfillments excluded from invoice COGS computation

**Manual lot override**: order line accepts `inventoryItemIds[]`; auto-FIFO replaced.

**Attachments**: via R2; `files.category = sales_order_attachment` (see §30).

**Data touched**: `salesOrders`, `salesOrderLines`, `salesOrderLineAllocations`, `salesOrderFulfillments`, `inventoryItems` (status), `files` (attachments).

**Edge cases**:
- Order created without sufficient inventory → blocked at validation
- Confirming an order whose inventory was just allocated by another order → second confirm errors
- Editing a confirmed/fulfilled order is gated by `order-action-rules`
- Cancel after fulfillment requires reversing fulfillments first
- Concurrent edits — last-write-wins via `updatedAt`; no optimistic locking

**Observability**: no PostHog events captured in orders module (gap).

**QA checklist**:
- [ ] Create order with valid lines and adequate inventory → succeeds
- [ ] Create order exceeding monthly plan limit → blocked
- [ ] Confirm → cannot edit pricing
- [ ] Fulfill as a sales-role user → forbidden
- [ ] Reverse fulfillment → inventory returns to `in_stock`, invoice (if any) needs reissue/adjustment
- [ ] Short ship → line marked, partial fulfill recorded
- [ ] Manual lot pick overrides FIFO and is preserved through fulfillment
- [ ] Order number unique per tenant
- [ ] Catch-weight line: `unitType = catch_weight`, fulfillment captures `exactWeightLbs`
- [ ] Fixed-case line: weight = cases × `conversionToBase`

**Diagram prompt**:
> Generate a system-design diagram image with THREE panels for Fluxora sales orders. Style: clean flat design, white background, rounded rectangles, ovals for states, labeled arrows. Color palette — pale green: processing; pale yellow: Postgres; blue ovals: states. **Panel 1**: state diagram `draft (sales_order) → confirmed → fulfilled`, with a side branch `cancel` only allowed before any fulfillment exists. **Panel 2**: create-order flow top-down — form submit → Zod validate lines → inventory feasibility check via `assertSalesOrderLinesCanAutoAllocateInventory` (FIFO simulation, no writes) → plan-limit check via `countCurrentMonthSalesOrdersForTenant` vs `maxSalesOrdersPerMonth` → insert `salesOrders` + `salesOrderLines` with price/unit snapshots (`pricePerUnitSnapshot`, `conversionToBaseSnapshot`, etc.) → assign order number `SO-{abbrev}-{hash}`. **Panel 3**: fulfillment flow — role check (`fulfill_order`) → insert `salesOrderLineAllocations` (if not yet) → insert `salesOrderFulfillments` (with cost snapshot from inventory item's supplier cost) → mark inventory items `allocated`. Include a reverse arrow back to `in_stock` labelled "reverseFulfillment". Include a compact legend in the lower right.

---

## 20. Sales Invoices & PDF

**Files**: [`modules/distribution/invoices/`](modules/distribution/invoices/), [`lib/invoices/`](lib/invoices/), [`app/api/invoices/[id]/pdf`](app/api/invoices/[id]/pdf/).

**Generate from order** (`generateInvoiceForSalesOrderAction`):
1. Permission: `generate_invoice` (accounting/admin/owner)
2. Order has no existing active invoice
3. All lines fulfilled or short-shipped
4. `createInvoiceFromSalesOrder()`:
   - Compute subtotal per line: `billedWeight × pricePerLb`
   - COGS snapshot: sum of fulfilled items' `costAmountSnapshot` (excluding `reversedAt`)
   - Apply fuel surcharge if `addFuelSurcharge = true` and customer has `fuelSurchargeAmount`
   - Insert `salesInvoices` with temp `invoiceNumber = TEMP-{orderId}-{ts}`, status `draft`
   - Insert `salesInvoiceLines` (quantityCases, billedWeightLbs, unitPrice, lineTotal, cogsAmountSnapshot)
   - Call `markInventoryItemsSold()` → items move to `sold`
   - Finalize `invoiceNumber = {customer.abbrev}-INV-{6-digit hash of UUID}` via `makeInvoiceNumber()`

**Unique constraint**: `sales_invoices_tenant_invoice_number_unique`.

**PDF** (`GET /api/invoices/[id]/pdf`):
- Component: `SalesInvoicePdf` in [`modules/distribution/invoices/pdf/sales-invoice-pdf.tsx`](modules/distribution/invoices/pdf/sales-invoice-pdf.tsx) (re-exported from `lib/invoices/sales-invoice-pdf.tsx`)
- Renders via `@react-pdf/renderer`
- Pulls tenant branding (logo, colors, footer) from `tenantBranding`
- Includes line items, totals, payment terms

**Attachments**: `files.category = sales_invoice_attachment` (optional).

**Edge cases**:
- Generate before all lines fulfilled → blocked
- Hash collision in invoice number (rare; 6 hex chars) → unique constraint retries
- Logo missing → render without
- Large line counts handled by @react-pdf pagination
- Reverse a fulfillment after invoice generated → invoice still references old fulfillment (COGS may become stale; verify behavior)

**Observability**: tests in [`lib/invoices/sales-invoice-pdf.test.ts`](lib/invoices/sales-invoice-pdf.test.ts) (unit-test suite via `npm run test:unit`).

**QA checklist**:
- [ ] Generate invoice with all lines fulfilled → succeeds
- [ ] Generate with one line partially fulfilled (not short-shipped) → blocked
- [ ] Fuel surcharge customer → surcharge appears on invoice
- [ ] Invoice number stable after refresh (not the temp one)
- [ ] PDF includes logo from tenant branding
- [ ] PDF totals match line totals + surcharges
- [ ] Two simultaneous generate attempts for same order → second errors

**Diagram prompt**:
> Generate a system-design diagram image with TWO sub-flows for Fluxora sales invoices. Style: clean flat design, white background, rounded rectangles, labeled arrows. Color palette — pale green: processing; pale yellow: Postgres tables (`salesOrders`, `salesInvoices`, `salesInvoiceLines`, `inventoryItems`, `tenantBranding`); pale gray: file rendering. **Top sub-flow — invoice generation**: order in `fulfilled` state → permission check (`generate_invoice`) → ensure no existing invoice on this order → per-line compute subtotal (`billedWeight × pricePerLb`) and COGS snapshot from non-reversed `salesOrderFulfillments` → apply customer fuel surcharge if `addFuelSurcharge=true` → insert `salesInvoices` with TEMP invoice number + `salesInvoiceLines` → mark linked `inventoryItems` as `sold` → finalize invoice number to `{customer.abbrev}-INV-{6-char hash}` via `makeInvoiceNumber`. **Bottom sub-flow — PDF**: GET `/api/invoices/[id]/pdf` → load invoice + lines + tenant branding (logo, colors, footer) → render via `@react-pdf/renderer` → response with appropriate Content-Disposition. Include a compact legend in the lower right.

---

## 21. Payments

**Files**: [`modules/distribution/payments/`](modules/distribution/payments/), [`app/(app)/payments/`](app/(app)/payments/), [`modules/distribution/invoices/services/invoicing.ts`](modules/distribution/invoices/services/invoicing.ts).

**Record payment** (`recordPaymentForSalesOrderInvoiceAction`):
1. Permission: `record_payment` (accounting/admin/owner)
2. Validate invoice exists, balanceDue > 0, amount > 0 and ≤ balanceDue (0.01 tolerance)
3. Insert `payments` row (paymentDate, amount, paymentMethod, checkNumber, referenceNumber, notes)
4. Update `salesInvoices.amountPaid += amount`, `.balanceDue -= amount` (floored to 0)
5. Set status: `paid` (amountPaid ≥ totalAmount) | `partially_paid` (amountPaid > 0) | unchanged

**Payment methods**: `cash | check | ach | zelle | credit_card`. No gateway integration; all manual entry.

**Schema**: `payments(id, tenantId, salesInvoiceId, paymentDate, amount (numeric 12,2), paymentMethod, checkNumber, referenceNumber, notes, createdByUserId, createdAt)`.

**Edge cases**:
- Overpayment: `paymentAmount - balanceDue > 0.01` → reject
- Floating-point undershoot: balance floored to 0
- Delete payment? — not explicitly modeled in agent findings (verify)
- Refunds — not modeled

**QA checklist**:
- [ ] Record partial payment → status `partially_paid`, balance reduced
- [ ] Record final payment → status `paid`, balance = 0
- [ ] Overpay by $1 → rejected
- [ ] Overpay by $0.005 → accepted (tolerance)
- [ ] Record on fully-paid invoice → rejected (balanceDue = 0)
- [ ] Payment method enum strictly enforced
- [ ] Customer balance reflects payment

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora payment recording. Style: clean flat flow chart, white background, rounded rectangles for actions, diamond shapes for decisions, labeled arrows. Color palette — pale green: validation/processing; pale yellow: Postgres (`payments`, `salesInvoices`). Layout top-down. Show: payment form submitted → permission check `record_payment` (diamond, deny path dashed red) → validate `balanceDue > 0` (diamond, deny → "invoice already paid") → validate `amount > 0` AND `amount ≤ balanceDue + 0.01` tolerance (diamond, deny → "overpayment rejected") → insert `payments` row (paymentDate, amount, method, refs) → update `salesInvoices` (`amountPaid += amount`, `balanceDue -= amount` floored to 0) → final status fork: `paid` (amountPaid ≥ totalAmount) | `partially_paid` (amountPaid > 0) | unchanged. Include a callout: "0.01 tolerance allows small floating-point overshoot; balanceDue floor prevents negative". Include a compact legend in the lower right.

---

## 22. Supplier Invoices (manual)

**Files**: [`modules/distribution/supplier-invoices/`](modules/distribution/supplier-invoices/), [`lib/supplier-invoices/`](lib/supplier-invoices/), [`app/(app)/supplier-invoices/`](app/(app)/supplier-invoices/), [`app/api/supplier-invoices/*`](app/api/supplier-invoices/).

**Status**: `draft → completed`.

**Server actions** ([`modules/distribution/supplier-invoices/actions/index.ts`](modules/distribution/supplier-invoices/actions/index.ts)):
- `createSupplierInvoiceAction(input)` — draft only; PostHog `bill.saved` event (line_count)
- `updateSupplierInvoiceAction(input)` — draft edits
- `completeSupplierInvoiceAction({ id, lineOverrides? })` — posts the invoice; creates lots + inventory; PostHog `bill.received` (bill_id, line_override_count)
- `uploadSupplierInvoiceAttachmentAction(formData)` — R2 + `supplierInvoiceAttachments`

**Fields**:
- Header: `supplierId, invoiceNumber, invoiceDate, receiveDate, paymentMethod (cash|check|ach|zelle|credit_card), notes`
- Lines: `productId, quantityCases, weightLbs, unitType (catch_weight|fixed_case), unitPrice, caseWeightsLbs (JSON), lotNumberOverride, expirationDateOverride`
- Charges: `description, chargeType (freight|fuel|tax|discount|other), rate, includeInInventoryCost, amount`

**Complete flow** (transactional):
1. Mark `supplier_invoices.status = completed`
2. Create `lots` (one per line, with overrides)
3. Create `lot_receipts` (link lot → supplier_invoice_line)
4. Create `inventory_items` (per case or per item depending on multi-case rules)
5. Upsert `product_supplier_costs` snapshot per (productId, supplierId)

**Attachments** (`GET /api/supplier-invoices/[id]/attachments/[fileId]`):
- Streams from R2 with `Content-Disposition: inline | attachment` (query `?download=1` flips it)

**Permissions**:
- View / edit: warehouse, accounting, owner, admin
- Complete: warehouse, owner, admin
- Reverse receipt: warehouse, owner, admin
- Delete drafts: warehouse, owner, admin
- Supplier payment: accounting, owner, admin

**Edge cases**:
- Complete twice → idempotent? (verify; should be guarded)
- Supplier soft-deleted → cannot create new invoice
- Reverse receipt: must back out inventoryItems and lotReceipts; not all reversal cases observed
- Fuel/freight charge with `includeInInventoryCost = true` adds to per-unit cost basis

**Observability**: PostHog `bill.saved`, `bill.received`.

**QA checklist**:
- [ ] Create draft → no inventory effect
- [ ] Complete → lots + inventory created
- [ ] Complete same invoice twice → blocked (verify)
- [ ] Attach PDF (≤25 MB, allowed MIME) → stored, retrievable, deletable
- [ ] Charge with `includeInInventoryCost=true` → cost per unit increased
- [ ] Reverse receipt removes lot + inventory cleanly
- [ ] PostHog events arrive in their project

**Diagram prompt**:
> Generate a system-design diagram image with TWO panels for Fluxora supplier invoices (manual entry). Style: clean flat design, white background, rounded rectangles, blue ovals for states, labeled arrows. Color palette — pale green: processing; pale yellow: Postgres; lavender: PostHog. **Panel 1**: state diagram — `draft → completed` (no reverse to draft after complete). Show a side branch from `completed` labelled "reverse receipt" that backs inventory out without flipping state back to draft. **Panel 2**: complete-action flow — status update to `completed` → for each line, in a transactional batch: create `lots` row → create `lot_receipts` row → create N `inventory_items` rows (one per case) → upsert `product_supplier_costs` snapshot for (productId, supplierId) → fire PostHog `bill.received` event with `bill_id` and `line_override_count`. Include a compact legend in the lower right.

---

## 23. Supplier Invoice AI Import

**Files**: [`modules/distribution/supplier-invoices/services/`](modules/distribution/supplier-invoices/services/), [`modules/distribution/supplier-invoices/utils/`](modules/distribution/supplier-invoices/utils/), [`docs/ai-setup.md`](docs/ai-setup.md).

**Purpose**: Reduce manual entry — parse vendor PDFs and prefill a supplier-invoice draft for review.

**Pipeline stages**:
1. **Deterministic parser** ([`utils/pdf-prefill.ts`](modules/distribution/supplier-invoices/utils/pdf-prefill.ts)) — regex over `pdf-parse` text
2. **Confidence scoring** ([`utils/pipeline-scoring.ts`](modules/distribution/supplier-invoices/utils/pipeline-scoring.ts)) — returns `score (0-100)`, `linesExtracted (bool)`, `unmatchedProductRatio (0-1)`
3. **AI text extraction** — primary: **OpenAI** ([`services/ai-provider-openai.ts`](modules/distribution/supplier-invoices/services/ai-provider-openai.ts), gpt-4o-mini, `response_format: json_object`, temperature 0). Fallback: **Anthropic** Claude (intended design; provider switch is a TODO at [`services/ai-provider.ts:216`](modules/distribution/supplier-invoices/services/ai-provider.ts) — not wired on this branch).
4. **AI vision extraction** ([`services/ai-vision.ts`](modules/distribution/supplier-invoices/services/ai-vision.ts)) — primary OpenAI gpt-4o, base64 PDF as file input; Anthropic vision fallback intended.
5. **Merge + scoring** — vision overrides if "worth using"
6. **Product matching** ([`services/product-matching.ts`](modules/distribution/supplier-invoices/services/product-matching.ts)) — multi-stage: alias table → meat-signal scoring → AI fallback (OpenAI primary, Anthropic fallback)

**Entry action**: `parseSupplierInvoicePdfAction(formData)` ([`actions/index.ts:161-204`](modules/distribution/supplier-invoices/actions/index.ts)).

**Rate limits**: `rateLimiters.pdfParse` (10/h per user), `pdfParseTenant` (30/h per tenant). Platform admins bypass.

**File validation**: max 25 MB, MIME `application/pdf`, sanitized filename.

**Decision gates**:
```
if (deterministicScore >= threshold (default 70) 
    AND linesExtracted 
    AND unmatchedProductRatio < 1) {
  return deterministic;
}
// else: call AI text
// if (aiResult.lines.length === 0 OR totals don't reconcile OR mergedScore < 60)
//   AND PDF bytes available
//   → call vision
// merge best of all stages
```

**Cost controls**:
- `AI_MAX_INVOICE_TEXT_CHARS` (default 30000) — text truncation with marker
- `AI_MAX_PRODUCT_CANDIDATES` (default 75) — candidate slice
- Token usage appended to result `warnings[]`

**Provider modes** (`AI_PROVIDER`):
- `openai` — primary (requires `OPENAI_API_KEY`)
- `anthropic` — fallback (intended; not wired on this branch, see TODO at [`ai-provider.ts:216`](modules/distribution/supplier-invoices/services/ai-provider.ts))
- `mock` — CI/dev with no key
- unset = auto-detect (openai if key present, else mock)

**Failover design**: requests run through OpenAI first. On hard failure (network, schema invalid after retries, rate-limit) the same request is meant to retry on Anthropic Claude with the same prompt + JSON schema. Today the failover hops straight to deterministic-only fallback; wiring the Anthropic provider is the remaining work.

**First-bill mode**: when tenant has 0 products, parser returns `firstBillLines[]` scaffolding (raw vendor text + suggested name). User names new products in `FirstBillPanel` → `saveFirstBillAction()` creates supplier + products + invoice atomically. Fires PostHog `first_bill.saved`.

**Hallucination guard**: any `suggestedProductId` not in the candidate set is silently nulled; confidence forced to 0 ([`ai-provider-openai.ts:197-212`](modules/distribution/supplier-invoices/services/ai-provider-openai.ts)).

**Vision column-swap correction**: `correctVisionColumnSwap()` detects quantity/weight swapped (common in poor PDFs) and fixes.

**Alias capture**: `saveImportAliasesBatchAction()` writes confirmed vendor-name → product mappings to `supplier_product_aliases` for future runs.

**Tests**: [`modules/distribution/supplier-invoices/utils/ai-validation.test.ts`](modules/distribution/supplier-invoices/utils/ai-validation.test.ts) — pure utility tests, no real API calls.

**PostHog events**:
- `pdf.parsed` (line_count, duration_ms, ai_used, vision_used, first_bill_mode)
- `bill.saved` (line_count)
- `bill.received` (bill_id, line_override_count)
- `first_bill.saved`

**Edge cases**:
| Case | Behavior |
|---|---|
| PDF >25 MB | reject with size error |
| Empty PDF | reject "empty" |
| Non-PDF MIME | reject |
| Text >30k chars | truncated, marker appended |
| 200+ products | sliced to 75 (or env max) |
| Malformed JSON from LLM | markdown fence strip + retry; else failure result |
| Hallucinated product IDs | silently nulled, confidence=0 |
| Network timeout | failure result; falls back to deterministic |
| Scanned PDF (no extractable text) | warning "requires OCR"; vision can still try |
| Vision >20 MB | reject (vision-specific size cap) |
| Empty catalog | first-bill scaffolding mode |
| Column swap | post-process fix |

**QA checklist**:
- [ ] Upload a known-good vendor PDF → deterministic confidence ≥70 → no AI call → PostHog `ai_used=false`
- [ ] Upload low-confidence PDF → AI called → PostHog `ai_used=true`
- [ ] Upload with `OPENAI_API_KEY` unset and `AI_PROVIDER` unset → mock used → empty result + warning
- [ ] Upload with `AI_PROVIDER=openai` and no key → action errors
- [ ] AI returns suggestedProductId not in candidate set → nulled silently
- [ ] AI returns malformed JSON → parser strips markdown fences; if still fails, falls back
- [ ] Rate limit: 11th parse in an hour for one user → 429-style error
- [ ] First-bill mode for empty catalog → user names products → atomic save
- [ ] Vision triggered when text AI returns zero lines + totals don't reconcile
- [ ] Alias captured from manual product pick reused on next invoice from same supplier

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's supplier-invoice AI import pipeline. Style: clean flat pipeline diagram, white background, rounded rectangles for stages, diamond shapes for decision gates, labeled arrows. Color palette — pale blue: upload/input; pale green: deterministic processing; pale orange: AI services (OpenAI primary, Anthropic fallback); pale purple: vision; pale yellow: Postgres + R2; lavender: PostHog. Layout left-to-right with branches going down. Stages in order: PDF uploaded → file validation (≤25 MB, MIME `application/pdf`, sanitize filename) → rate limit check (`pdfParse` per user, `pdfParseTenant` per tenant; platform admins bypass) → `pdf-parse` text extraction → deterministic parser produces structured lines → confidence scoring (`score`, `linesExtracted`, `unmatchedProductRatio`). Decision diamond: if (score ≥ 70 AND `linesExtracted` AND `unmatchedRatio` < 1) → use deterministic result; else → AI text extraction. AI text extraction subgraph: **primary = OpenAI** gpt-4o-mini in JSON mode, temperature 0, with text truncated to 30k chars and 75 product candidates; on hard failure cascade to **fallback = Anthropic Claude** (intended — currently a TODO; render as a slightly dashed box). After AI text: if (no lines OR totals don't reconcile OR mergedScore < 60) AND PDF bytes available → vision extraction (OpenAI gpt-4o on base64 PDF ≤20 MB, with `correctVisionColumnSwap` post-process; Anthropic vision fallback also dashed). Merge results → product matching pipeline (alias table → meat-signal scoring → AI fallback) with a callout showing the **hallucination guard** that silently nulls any `suggestedProductId` not in the candidate set. End at review UI. Draw failure arrows from each stage cascading to the prior stage's result. At the end, an event arrow fires PostHog `pdf.parsed` with properties `line_count, duration_ms, ai_used, vision_used, first_bill_mode`. Include a compact legend in the lower right.

---

## 24. Plaid Bank Linking & Sync

**Files**: [`modules/distribution/plaid/`](modules/distribution/plaid/), [`app/api/plaid/*`](app/api/plaid/).

**Tables**: `plaidConnections (id, tenantId, plaidItemId, encryptedAccessToken, institutionId, institutionName, status, transactionCursor, lastSyncAt)`, `bankAccounts`, `bankTransactions`, `plaidWebhookSeen`.

**Flow — connect**:
1. Client: `POST /api/plaid/link-token` → server calls Plaid `linkTokenCreate({ user.client_user_id, products: [Transactions], country_codes: [US], webhook: <our URL> })`.
2. Client embeds Link UI → user authenticates → receives `public_token`.
3. Client: `POST /api/plaid/exchange { public_token, institution_id?, institution_name? }`:
   - Plaid `itemPublicTokenExchange()` → `access_token`, `item_id`
   - Check `plaidConnections(tenantId, plaidItemId)`:
     - Exists → update `encryptedAccessToken`, status → `active`
     - New → insert
   - Audit `plaid.connection_added` (new only)
   - PostHog `bank.connect_succeeded`
   - Fire-and-forget background `initialSync(connectionId, access_token)`
   - Return `{ connection_id }`

**Flow — webhook** (`POST /api/plaid/webhook`):
1. **JWT signature verification** (ES256):
   - Header `Plaid-Verification`
   - Fetch verification key by `kid` via `webhookVerificationKeyGet()`; cache 24h
   - Validate `iat` within 5-minute replay window
   - Validate `request_body_sha256` matches SHA256(raw body)
   - Possible errors: `missing_header | malformed_header | unsupported_alg | key_fetch_failed | key_expired | signature_invalid | stale_jwt | body_hash_mismatch` → 401 + Sentry capture
2. **Idempotency**: SHA256(JWT) → `plaidWebhookSeen(webhookId)` unique constraint. Duplicate → 200 + `{ deduped: true }`.
3. **Dispatch**:
   - `TRANSACTIONS` (SYNC_UPDATES_AVAILABLE, DEFAULT_UPDATE, INITIAL_UPDATE, HISTORICAL_UPDATE) → find connection by `item_id` → background `syncConnection(connectionId)` if active
   - `ITEM` (ERROR, PENDING_EXPIRATION, USER_PERMISSION_REVOKED) → `plaidConnections.status = "requires_reauth"`

**Flow — sync** (`syncConnection(id)`):
1. Decrypt access token
2. Loop: `transactionsSync(access_token, cursor, count=500)`
   - Upsert `bankAccounts`
   - Delete `bankTransactions` for `removed[]`
   - Upsert `bankTransactions` for `added[] + modified[]` (onConflictDoUpdate)
3. Update cursor on `plaidConnections.transactionCursor`
4. `snapshotBalancesForConnection(id)` records balance history
5. `runMatchingForTransaction()` — links transactions to orders/invoices (TBD logic)

**Manual sync** (`POST /api/plaid/connections/[id]/sync`):
- Rate-limited per tenant: `rateLimiters.plaidSync` (6/h)
- Auth: tenant member; platform admins bypass rate limit
- Validates connection belongs to tenant, status=active

**Edge cases**:
- Item revoked / expired → status `requires_reauth`; UI prompts re-link
- Out-of-order webhooks: cursor advances are idempotent
- Background sync failure: Sentry capture; next webhook retries
- Plaid sandbox vs production: same endpoints, different costs (sandbox $0, prod ~$0.30–0.60/connection/mo)
- Replay attack: 5-minute iat window; body hash check

**Observability**:
- Console: `[plaid/link-token]`, `[plaid/exchange] initial sync failed`, `[plaid/webhook] verification rejected`
- Sentry: webhook verification errors (stage tags), background sync exceptions
- PostHog: `bank.connect_succeeded`

**Cron**: `/api/cron/plaid-webhook-cleanup` daily 02:00 UTC — purges `plaidWebhookSeen` older than 30 days. Pings Better Stack heartbeat (see §32).

**QA checklist**:
- [ ] Link token issues, user completes Plaid Link, exchange succeeds
- [ ] Re-exchanging same `item_id` updates existing connection (no duplicate)
- [ ] Webhook with valid signature → 200
- [ ] Webhook with tampered body → 401 + Sentry
- [ ] Webhook with stale JWT (>5 min) → 401
- [ ] Duplicate webhook (same JWT hash) → 200 + `deduped: true`
- [ ] ITEM error event → connection status flips to `requires_reauth`
- [ ] Manual sync rate-limited (7th in an hour fails)
- [ ] Cron daily run prunes old `plaidWebhookSeen` rows + pings heartbeat
- [ ] Connection delete cascades or leaves stale data appropriately (verify)

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's Plaid integration. Style: clean flat sequence-style diagram, white background, rounded rectangles for actors/services arranged in vertical lanes, labeled arrows for messages. Color palette — pale blue: Tenant Browser; pale orange: Plaid Link + Plaid API; pale green: Next.js App; pale yellow: Postgres; pale red: Sentry. Lanes left-to-right: Tenant Browser → Plaid Link → Next.js App → Plaid API → Postgres → Sentry. Show three labeled scenarios stacked vertically as horizontal swimlanes within one image. **Scenario 1 — Connect**: POST `/api/plaid/link-token` → `linkTokenCreate` → Plaid Link UI completes → `public_token` returned → POST `/api/plaid/exchange` → `itemPublicTokenExchange` → upsert `plaidConnections` → fire-and-forget background `initialSync` → PostHog `bank.connect_succeeded`. **Scenario 2 — Webhook**: Plaid POSTs to `/api/plaid/webhook` → verify ES256 JWT (kid lookup with 24h cache, 5-minute iat replay window, request_body_sha256 match) → idempotency dedupe via `plaidWebhookSeen` (unique SHA256(JWT)) → dispatch to TRANSACTIONS-sync OR ITEM-status-update (flips `plaidConnections.status` to `requires_reauth`). Show all 401 failure branches as dashed red arrows feeding Sentry capture. **Scenario 3 — Sync**: `transactionsSync` cursor loop (count=500) → upsert `bankAccounts` and `bankTransactions` (process `added/modified/removed`) → update cursor on `plaidConnections.transactionCursor` → `snapshotBalancesForConnection` → optional `runMatchingForTransaction`. Include a compact legend in the lower right.

---

## 25. Expenses

**Files**: [`modules/distribution/expenses/`](modules/distribution/expenses/), [`app/(app)/expenses/`](app/(app)/expenses/), [`lib/expenses/`](lib/expenses/).

**Schema**: `expenses(id, tenantId, category, amount, paymentMethod, note, expenseDate, createdByUserId, createdAt)`.

**Categories**: `fleet_maintenance | gas | rent | insurance | utilities | supplies | payroll | other`.

**Payment methods**: `cash | check | ach | zelle | credit_card`.

**Permissions**: `canManageExpenses(role)` = owner | admin | accounting. Enforced via `requireExpenseManager()`.

**Actions**: paginated list (sort: expenseDate | category | amount | createdAt; text search on category/note/creator); create / update / delete.

**Plaid link**: not wired today (per code scan). Expenses are pure manual entry.

**QA checklist**:
- [ ] List with sorting and search
- [ ] Create as accounting role → succeeds; as warehouse → forbidden
- [ ] Date in the future → allowed? (verify)
- [ ] Category enum strict
- [ ] Amount positive enforced

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora Expense management. Style: clean flat flow chart, white background, rounded rectangles, labeled arrows. Color palette — pale green: server actions; pale yellow: Postgres (`expenses`). Layout left-to-right. Show: paginated list with sort (expenseDate/category/amount/createdAt) and text search → create/update/delete operations gated by `canManageExpenses` role check (owner | admin | accounting); deny path dashed red for other roles → insert/update/delete `expenses` row with `category` (enum), `paymentMethod` (enum), `amount`, `note`, `expenseDate`, `createdByUserId`. Include a compact legend in the lower right.

---

## 26. Dashboard (KPIs)

**Files**: [`lib/dashboard/`](lib/dashboard/) (`visibility.ts`), [`app/(app)/(dashboard)/`](app/(app)/) (or similar).

**Sections** (role-aware): `sales | arAging | purchasing | apAging | inventory`.

**Metric cards** (11): `sales7d`, `sales30d`, `cogs30d`, `grossProfit30d`, `grossMargin30d`, `purchases30d`, `unpaidCustomerBalance`, `unpaidSupplierBalance`, `inventoryValue`, `expiringLots`, `expiredLots`.

**Visibility matrix**:
| Role | Sections shown |
|---|---|
| owner, admin | all sections, all cards |
| sales | sales, arAging, inventory |
| warehouse | purchasing, inventory (focus: inventoryValue, expiringLots, expiredLots) |
| accounting | sales, arAging, purchasing, apAging |

**Data**: computed across `salesInvoices`, `payments`, `supplierInvoices`, `inventoryItems`, `lots`. Exact aggregation in `modules/distribution/services/dashboard.ts` (not exhaustively scanned).

**QA checklist**:
- [ ] As each role, only assigned cards/sections visible
- [ ] sales7d / sales30d match raw query on `salesInvoices.totalAmount`
- [ ] inventoryValue ties to sum of (cases × costPerUnitSnapshot) for in_stock items
- [ ] expiringLots = lots with expiration within N days (verify N)
- [ ] expiredLots = lots past expiration

**Diagram prompt**:
> Generate a system-design image of Fluxora's dashboard as a radial mindmap. Style: clean flat design, white background, central node "Dashboard" with five colored branches radiating outward, one branch per top-level section. Color palette: green = sales, red = arAging, blue = purchasing, orange = apAging, purple = inventory. Under each section node, list its metric cards as smaller rounded rectangles: sales = (sales7d, sales30d, cogs30d, grossProfit30d, grossMargin30d); arAging = (unpaidCustomerBalance); purchasing = (purchases30d); apAging = (unpaidSupplierBalance); inventory = (inventoryValue, expiringLots, expiredLots). Beside each section node, draw small role-badge icons indicating which roles see it: owner/admin (all), sales (sales/arAging/inventory), warehouse (purchasing/inventory), accounting (sales/arAging/purchasing/apAging). Include a compact legend in the lower right.

---

## 27. Support Tickets

**Files**: [`lib/support/`](lib/support/), [`modules/core/platform-admin/support/`](modules/core/platform-admin/support/), [`app/api/support-tickets/*`](app/api/support-tickets/).

**Tenant-side create** (`POST /api/support-tickets`):
- Schema `supportFormSchema`: name, email, tenantName, `issueType` (`bug | question | feature_request | workflow_issue`), `priority` (`low | medium | high`), subject, message (≥10 chars), pageUrl.
- Inserts `supportTickets` row.
- `notifyPlatformAdminsOfNewTicket()` → email staff.

**Attachments**:
- Max 25 MB
- Allowed: pdf, png, jpg, jpeg, webp, heic, csv, txt, doc, docx, xls, xlsx
- Stored at `tenants/{tenantId}/support-tickets/{ticketId}/{fileId}.{ext}` in R2
- Row in `supportTicketAttachments`

**Updates** (`supportTicketUpdates`) — visibility `internal | tenant_visible`. Tenant-visible updates trigger email to submitter.

**Platform admin response** at `/admin/support/[id]`:
- Filter list (status, priority, issueType)
- Add update with visibility
- Mark resolved (`status: open | in_progress | resolved`)

**Permissions**: tenant member can create + view their own tickets; platform admins see all tenants.

**QA checklist**:
- [ ] Tenant create → platform admins notified
- [ ] Attach 26 MB file → rejected
- [ ] Internal update not visible to tenant
- [ ] Tenant-visible update emails submitter
- [ ] Resolve closes ticket; tenant cannot reopen (verify)

**Diagram prompt**:
> Generate a system-design diagram image for the Fluxora support ticket lifecycle. Style: clean flat sequence-style diagram, white background, rounded rectangles for actors, labeled arrows. Color palette — pale blue: Tenant Browser and Platform Admin Browser; pale green: Next.js App; pale yellow: Postgres (`supportTickets`, `supportTicketUpdates`, `supportTicketAttachments`); pale gray: Cloudflare R2; pale orange: Resend. Layout left-to-right. Show: Tenant Browser POSTs to `/api/support-tickets` with form schema (name, email, tenantName, issueType, priority, subject, message ≥10 chars, pageUrl) → Next.js inserts `supportTickets` row → optional attachments uploaded server-side to R2 at `tenants/{tenantId}/support-tickets/{ticketId}/{fileId}.{ext}` (≤25 MB, extension allowlist) → `notifyPlatformAdminsOfNewTicket` sends emails via Resend → Platform Admin Browser opens `/admin/support/[id]` → posts an update with visibility toggle `internal | tenant_visible` → on `tenant_visible`, Resend emails submitter; `internal` is silent → Platform Admin marks ticket `resolved`. Include a compact legend in the lower right.

---

## 28. Platform Admin

**Files**: [`app/admin/`](app/admin/), [`modules/core/platform-admin/`](modules/core/platform-admin/).

**Host**: `admin.<root>`. Access gated by `requirePlatformAdminHost()` + `requirePlatformUser()` against `platform_users.isActive`.

**Roles**: `platform_admin | support | qa`.

**Features**:
- `/admin` — dashboard
- `/admin/tenants` — cross-tenant list (activate/deactivate, edit subscription)
- `/admin/platform-users` — manage platform staff
- `/admin/stripe-catalog` — view + manually sync Stripe products/prices (calls `syncStripeCatalogAdminAction` → PostHog `stripe_catalog_synced`)
- `/admin/subscriptions` — cross-tenant subscription lifecycle
- `/admin/support` — support ticket queue

**Actions**:
- `setTenantActiveAction(id, isActive, reason?)`
- `updateTenantSubscriptionAction(tenantId, raw)`
- `startPlatformAdminStripeCheckoutAction(tenantId, plan)` (platform-initiated upgrade)
- `syncStripeCatalogAdminAction()` (full sync)

**QA checklist**:
- [ ] Non-platform user on `admin.<root>` → blocked
- [ ] Deactivate tenant → next tenant-user request blocked (subscription gate or 403)
- [ ] Subscription edit by admin reflected in tenant immediately
- [ ] Stripe catalog sync produces same result as webhook flow

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora Platform Admin. Style: clean flat hub-and-spoke architecture diagram, white background, rounded rectangles for pages, labeled arrows. Color palette — pale blue: Platform Admin Browser; pale green: middleware guards; pale yellow: Postgres (`platform_users`, `tenants`); orange spokes for feature pages. Layout: requests to `admin.<root>` flow through two sequential gates (`requirePlatformAdminHost`, `requirePlatformUser` checking `isActive`), then fan out as spokes to the feature pages: `/admin` dashboard, `/admin/tenants` (activate/deactivate, edit subscription, platform-initiated Checkout), `/admin/platform-users` (manage staff), `/admin/stripe-catalog` (sync — fires PostHog `stripe_catalog_synced`), `/admin/subscriptions` (cross-tenant subscription view), `/admin/support` (tenant ticket queue from §27). Include a compact legend in the lower right.

---

## 29. Workspace Settings & Tenant Branding

**Files**: [`modules/core/workspace-settings/`](modules/core/workspace-settings/), [`app/api/tenant/branding/*`](app/api/tenant/branding/).

**Logo upload** (`POST /api/tenant/branding/logo`):
1. Client `useUploadTenantLogo()` → multipart FormData
2. Server validates size ≤ 2 MB
3. `uploadTenantLogo(bytes, originalFilename, mimeType, sizeBytes)` → R2 PUT at `tenants/{tenantId}/branding/logo/{fileId}.{ext}`
4. Insert `files` row + set `tenants.logoFileId`

**Logo URL** (`GET /api/tenant/branding/logo-url`):
- `getSignedDownloadUrl(objectKey, expiresInSeconds=3600)` — presigned GET, 1h
- Client hook `useTenantLogoUrl()` caches with `staleTime: 50 min`

**Logo delete** (`DELETE /api/tenant/branding/logo`):
- Remove R2 object + clear `tenants.logoFileId`

**Other tenant settings**: tenantName, slug; additional metadata (timezone, currency) — not exhaustively mapped.

**Edge cases**:
- File >2 MB → reject
- Invalid MIME → reject
- Slug change → may break in-flight magic links pointing at old subdomain (verify)
- Presigned URL TTL vs cache staleTime: hook refreshes before expiry, but if device clock skew is large the URL may 403

**QA checklist**:
- [ ] Upload logo as admin → visible on invoices + login page
- [ ] Upload as non-admin → forbidden
- [ ] Delete logo → invoices render without logo
- [ ] Logo URL expires after 1h; hook refreshes ~50 min

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora tenant logo upload. Style: clean flat sequence-style diagram, white background, rounded rectangles for actors, labeled arrows. Color palette — pale blue: Admin Browser; pale green: Next.js App; pale gray: Cloudflare R2; pale yellow: Postgres (`files`, `tenants`). Show TWO flows. **Upload (top)**: POST multipart to `/api/tenant/branding/logo` → size validation (≤2 MB) → MIME validation (image/*) → server PUTs object to R2 at key `tenants/{tenantId}/branding/logo/{fileId}.{ext}` → insert `files` row with metadata → set `tenants.logoFileId`. **Read (bottom)**: GET `/api/tenant/branding/logo-url` → server calls `getSignedDownloadUrl` (1h TTL) → returns presigned URL → Admin Browser caches via `useTenantLogoUrl` for ~50 minutes (refreshes before expiry). Include a compact legend in the lower right.

---

## 30. File Uploads (Cloudflare R2)

**Pattern**: server-mediated upload (multipart → server → R2 PUT). Downloads via presigned GET (`getSignedDownloadUrl`).

**Uses**:
| Category | Key pattern | Max size | Validation |
|---|---|---|---|
| Tenant logo | `tenants/{tenantId}/branding/logo/{fileId}.{ext}` | 2 MB | MIME image |
| Sales order attachment | `tenants/{tenantId}/sales-orders/{salesOrderId}/{fileId}.{ext}` | TBD | TBD |
| Supplier invoice attachment | `tenants/{tenantId}/supplier-invoices/{supplierInvoiceId}/{fileId}.{ext}` | 25 MB (PDF) | PDF magic bytes |
| Support ticket attachment | `tenants/{tenantId}/support-tickets/{ticketId}/{fileId}.{ext}` | 25 MB | extension allowlist |
| Invoice PDF parse input | (held in memory) | 25 MB | PDF magic bytes |

**Validation** ([`lib/file-validation.ts`](lib/file-validation.ts)):
- `sanitizeFilename()` — NFC normalize, strip control chars, collapse `../`, truncate 255
- PDF magic bytes check (`%PDF-`)

**Env**: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (AWS SDK S3 client).

**QA checklist**:
- [ ] Path traversal in filename rejected
- [ ] Non-PDF uploaded to supplier invoice attachment → rejected
- [ ] Size cap honored per surface
- [ ] Tenant A cannot access tenant B's R2 objects (server scopes by tenantId)

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's general R2 upload pattern (applies to logos, sales-order attachments, supplier-invoice attachments, support-ticket attachments). Style: clean flat architecture diagram, white background, rounded rectangles, labeled arrows. Color palette — pale blue: client; pale green: Next.js server route; pale gray: Cloudflare R2; pale yellow: Postgres (`files`). Layout left-to-right. **Upload path**: client POSTs multipart → tenant-scoped server route validates (size cap per surface, MIME, filename sanitize via `sanitizeFilename`, magic-byte check for PDFs) → server PUTs to R2 at key pattern `tenants/{tenantId}/{surface}/{entityId}/{fileId}.{ext}` → insert `files` row. Add a small surface-vs-cap table inset: logo 2 MB, supplier invoice 25 MB PDF, support ticket 25 MB allowlist, sales order attachment TBD. **Download path** (below): client GETs a `*/url` server route → server returns presigned R2 GET URL (1h TTL) → client uses URL directly. Include a compact legend in the lower right.

---

## 31. Cron Jobs

**Config**: [`vercel.json`](vercel.json).

**Auth**: `Authorization: Bearer ${CRON_SECRET}` (Vercel sets this header automatically).

**Currently scheduled**:
| Path | Schedule | Purpose | Heartbeat env |
|---|---|---|---|
| `/api/cron/plaid-webhook-cleanup` | `0 2 * * *` (02:00 UTC daily) | Delete `plaidWebhookSeen` rows >30 days | `BETTER_STACK_HEARTBEAT_URL_WEBHOOK_DEDUPE_CLEANUP` |

**Mentioned but not yet wired** (env vars exist; no call sites):
- Plaid sync cron (`BETTER_STACK_HEARTBEAT_URL_PLAID_SYNC`)
- Balance snapshot cron (`BETTER_STACK_HEARTBEAT_URL_BALANCE_SNAPSHOT`)
- Audit cleanup cron (`BETTER_STACK_HEARTBEAT_URL_AUDIT_CLEANUP`)

**Heartbeat semantics**: `pingHeartbeat(url, label)` is no-op when env unset. Heartbeat failure does NOT fail the cron (logged to Sentry; Better Stack pages via missed-window detection).

**QA checklist**:
- [ ] Cron endpoint without auth → 401
- [ ] Cron endpoint with valid bearer → executes, returns `{ ok, deleted, cutoff }`
- [ ] After run, Better Stack heartbeat received (if configured)
- [ ] If R/W to DB fails, returns 500 (Vercel retries per its policy)

**Diagram prompt**:
> Generate a system-design diagram image for Fluxora's Plaid webhook cleanup cron. Style: clean flat flow chart, white background, rounded rectangles, labeled arrows. Color palette — lavender: Vercel Cron scheduler; pale green: Next.js cron route; pale yellow: Postgres (`plaidWebhookSeen`); pale orange: Better Stack. Layout top-down. Show: Vercel Cron fires daily at 02:00 UTC → GET `/api/cron/plaid-webhook-cleanup` with `Authorization: Bearer ${CRON_SECRET}` → bearer check (deny path dashed red, 401) → DELETE FROM `plaidWebhookSeen` WHERE `receivedAt < now() - 30 days` → ping Better Stack heartbeat URL `BETTER_STACK_HEARTBEAT_URL_WEBHOOK_DEDUPE_CLEANUP` (no-op if env unset; ping failure logged to Sentry but does NOT fail the cron) → return JSON `{ ok: true, deleted: N, cutoff: ISO8601 }`. Include a compact legend in the lower right.

---

## 32. Observability

### Sentry
**Files**: `sentry.server.config.ts`, `sentry.edge.config.ts`, `sentry.client.config.ts`, `next.config.ts` (`withSentryConfig`), [`lib/sentry-filter.ts`](lib/sentry-filter.ts).

**Env**: `SENTRY_DSN` (server/edge), `NEXT_PUBLIC_SENTRY_DSN` (client), `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (build-time source maps only).

**Settings**:
- Environment: `VERCEL_ENV` or `NODE_ENV`
- Release: `VERCEL_GIT_COMMIT_SHA`
- `tracesSampleRate: 0.1` (10%)
- `beforeSend` → `filterSensitiveData()`:
  - Strips request body, cookies, auth/cookie/x-vercel-id/x-better-auth-* headers
  - Redacts query params: token, code, state, access_token, refresh_token, secret, session, magic_link
  - Regex strips Plaid access tokens: `access-(sandbox|development|production)-*`
  - Removes user email, IP, username

**Capture points**: Plaid webhook verification errors (stage-tagged), background sync failures, heartbeat ping failures, generic uncaught.

### PostHog
**Files**: [`lib/posthog-server.ts`](lib/posthog-server.ts), [`lib/posthog-client.ts`](lib/posthog-client.ts).

**Env**: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` (default US Cloud), `POSTHOG_PROJECT_API_KEY`. No-op when unset.

**Server SDK**: `flushAt: 1, flushInterval: 0` (serverless-safe immediate flush).

**Server events** (closed union):
- `user.signed_up`
- `welcome.completed`, `welcome.skipped`
- `pdf.parsed`
- `first_bill.saved`, `bill.saved`, `bill.received`
- `bank.connect_succeeded`
- `payment_match.confirmed`, `payment_match.auto_applied`
- `markdown.applied`
- `supplier.switched_primary`
- `bill.forwarded`
- `stripe_catalog_synced`

**Client events**:
- `welcome.started`, `welcome.step_completed`
- `pdf.uploaded`
- `first_bill.viewed`, `first_bill.names_edited`
- `bank.connect_started`
- `feature.opened`

### Better Stack
**File**: [`lib/heartbeat.ts`](lib/heartbeat.ts).

`pingHeartbeat(url, label)` — POSTs on cron success, no-op when URL unset. Errors logged to Sentry; never fail the cron.

Currently wired: only `WEBHOOK_DEDUPE_CLEANUP_HEARTBEAT_URL`.

### Upstash Redis (rate limiting)
**File**: [`lib/rate-limit.ts`](lib/rate-limit.ts).

**Env**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. No-op when unset.

**Limiters** (all sliding-window):
| Name | Limit | Window | Key |
|---|---|---|---|
| pdfParse | 10 | 1h | per user |
| pdfParseTenant | 30 | 1h | per tenant |
| plaidSync | 6 | 1h | per tenant |
| emailForward | 50 | 1d | per tenant |
| magicLink | 5 | 1h | per email |
| genericApi | 100 | 1m | global per middleware (platform admins bypass) |

`applyRateLimit(limiter, identifier)` returns `{ success, limit, remaining, reset, retryAfterSeconds }`.

### Audit logs
`auditLogs` table — system actor on webhook syncs; user actor on destructive actions (customer.delete, supplier.delete, etc.). Schema includes `action, resourceType, resourceId, metadataJson`.

**QA checklist**:
- [ ] Sentry receives a deliberate error from server route
- [ ] Sentry payload contains no tokens, no cookies, no user PII
- [ ] PostHog receives `user.signed_up` immediately (flushAt:1)
- [ ] Rate limiter no-op in dev with no Upstash env; enforced when configured
- [ ] Heartbeat ping after successful cron; missed window pages on Better Stack
- [ ] All sensitive query strings (`token=…`) redacted in Sentry events

**Diagram prompt**:
> Generate a system-design hub-and-spoke diagram image for Fluxora observability. Style: clean flat architecture diagram, white background, rounded rectangles, labeled arrows. Color palette — pale green: Next.js App (center hub); pale red: Sentry; lavender: PostHog; pale orange: Better Stack; pale teal: Upstash Redis; pale yellow: Postgres `auditLogs`. Center the Next.js App node. Draw outbound spokes: (1) Sentry — labelled "errors + traces 10% sample, `beforeSend` filter strips PII, cookies, auth headers, Plaid access tokens"; (2) PostHog — labelled "server flushAt=1 + client SDK", with a sub-label listing key events (`user.signed_up`, `pdf.parsed`, `bill.received`, `bank.connect_succeeded`, `markdown.applied`, etc.); (3) Better Stack — labelled "cron heartbeats — only `WEBHOOK_DEDUPE_CLEANUP` wired today; 3 others env-only"; (4) Upstash Redis — labelled "rate limiting", with a sub-list of limiters and windows: `pdfParse 10/h user`, `pdfParseTenant 30/h tenant`, `plaidSync 6/h`, `emailForward 50/d`, `magicLink 5/h`, `genericApi 100/m`; (5) Postgres `auditLogs` — labelled "system + user destructive actions". Include a compact legend in the lower right.

---

## 33. Changelog page

**File**: [`lib/changelog.ts`](lib/changelog.ts), [`app/changelog/page.tsx`](app/changelog/page.tsx).

Public page (no auth). Data is a hardcoded `changelogReleases` array. Each release: `{ version, dateLabel, title, summary, sections: { added[], improved[], fixed[], security[] } }`. New releases prepended.

**QA checklist**:
- [ ] Reachable unauthenticated at `/changelog`
- [ ] Cards color-coded per section type
- [ ] Renders on all host classes

**Diagram prompt**: trivial — skip.

---

## Appendix A — All PostHog events

| Event | Side | Properties | Fired by |
|---|---|---|---|
| `user.signed_up` | server | — | Better Auth user.create hook (`lib/auth.ts:170`) |
| `welcome.started` | client | — | onboarding component |
| `welcome.step_completed` | client | step | onboarding |
| `welcome.completed` | server | — | onboarding service |
| `welcome.skipped` | server | — | onboarding service |
| `pdf.uploaded` | client | filename, size | supplier-invoice upload UI |
| `pdf.parsed` | server | line_count, duration_ms, ai_used, vision_used, first_bill_mode | `parseSupplierInvoicePdfAction` |
| `first_bill.viewed` | client | — | FirstBillPanel mount |
| `first_bill.names_edited` | client | — | FirstBillPanel field edits |
| `first_bill.saved` | server | — | `saveFirstBillAction` |
| `bill.saved` | server | line_count | `createSupplierInvoiceAction` |
| `bill.received` | server | bill_id, line_override_count | `completeSupplierInvoiceAction` |
| `bill.forwarded` | server | — | bill-forward path (email→PDF) |
| `bank.connect_started` | client | — | Plaid Link launch |
| `bank.connect_succeeded` | server | — | `/api/plaid/exchange` |
| `payment_match.confirmed` | server | — | bank txn matching |
| `payment_match.auto_applied` | server | — | bank txn matching |
| `markdown.applied` | server | — | lot disposition |
| `supplier.switched_primary` | server | — | price chart |
| `feature.opened` | client | feature | analytics nav |
| `stripe_catalog_synced` | server | — | `syncStripeCatalogAdminAction` |

---

## Appendix B — All cron jobs

| Path | Schedule | Heartbeat | Wired? |
|---|---|---|---|
| `/api/cron/plaid-webhook-cleanup` | `0 2 * * *` daily | `WEBHOOK_DEDUPE_CLEANUP_HEARTBEAT_URL` | ✔ |
| (Plaid sync) | — | `BETTER_STACK_HEARTBEAT_URL_PLAID_SYNC` | ✗ (heartbeat env exists; no call site) |
| (Balance snapshot) | — | `BETTER_STACK_HEARTBEAT_URL_BALANCE_SNAPSHOT` | ✗ |
| (Audit cleanup) | — | `BETTER_STACK_HEARTBEAT_URL_AUDIT_CLEANUP` | ✗ |

---

## Appendix C — All external services

| Service | Purpose | Auth | Webhook? |
|---|---|---|---|
| Neon Postgres | Primary DB | DATABASE_URL (pooled), DATABASE_URL_UNPOOLED (migrations) | — |
| Better Auth (in-app) | Sessions, OAuth, magic links | local | — |
| Google OAuth | Identity | OAuth | — |
| Stripe | Subscription billing | API key + signing secret | `/api/stripe/webhook` (HMAC-SHA256 sig) |
| Resend | Email | API key | — |
| Cloudflare R2 | Object storage | S3-compat creds | — |
| OpenAI | AI invoice extraction — **primary** | `OPENAI_API_KEY` | — |
| Anthropic | AI invoice extraction — **fallback** (planned, not yet wired) | `ANTHROPIC_API_KEY` (TBD) | — |
| Plaid | Bank linking + sync | client id + secret | `/api/plaid/webhook` (ES256 JWT) |
| Sentry | Errors + traces | DSN | — |
| PostHog | Product analytics | project token / API key | — |
| Better Stack | Uptime heartbeats | per-job URLs | — |
| Upstash Redis | Rate limiting | REST URL + token | — |
| Vercel | Hosting + Cron | platform | Cron via `CRON_SECRET` |

---

## Appendix D — Master "whole system" diagram prompt

Use this when you want one big container diagram (paste exactly into ChatGPT with image generation, or Claude Chat):

> Generate a system architecture image (a single high-resolution diagram) for **Fluxora — multi-tenant ERP for food/wholesale distribution**. Style: clean flat C4-style container diagram, professional, white background, rounded rectangles for components, parallelograms/cylinders for data stores, distinct group containers (subgraph boxes) with soft-tinted fills, labeled arrows for every edge. No 3D, no skeuomorphism, no emojis. Crisp text labels at consistent size.
>
> Color palette:
> - pale blue for clients/browsers
> - pale green for the Next.js application internals
> - pale yellow for data stores (Postgres, R2)
> - pale orange for third-party SaaS
> - lavender for scheduled jobs / cron
> - dashed red arrows for failure / 401 / blocked paths
>
> **Layout**: clients on the left, Next.js application in the center (large subgraph divided into stacked smaller subgraphs), data stores below the application, third-party SaaS on the right grouped by purpose. Annotate every arrow with the protocol + intent — examples: `HTTPS · session cookie`, `Postgres wire · Drizzle`, `S3 API · presigned PUT/GET`, `Webhook POST · HMAC-SHA256`, `Webhook POST · ES256 JWT`, `REST · rate-limit check`, `HTTPS · capture event`, `HTTPS · heartbeat ping`, `Chat Completions · JSON mode`.
>
> **Clients on the left**: Tenant Users (browser), Platform Admins (browser), Stripe (webhook source), Plaid (webhook source), Vercel Cron (scheduled trigger).
>
> **Next.js application — center subgraph divided into four stacked subgraphs**:
> 1. **Proxy / Middleware (`proxy.ts`)** — host resolution (root / `<tenant>.root` / `admin.root`), tenant header injection, session check, subscription gate
> 2. **Pages** — marketing (`/`, `/features`, `/pricing`), auth (`/login`, `/signup`, `/onboarding`, `/select-destination`, `/google/*`), tenant `(app)` shell (customers, suppliers, products, inventory, lots, orders, invoices, payments, expenses, price-chart, supplier-invoices, dashboard, account/billing), platform admin (`admin/*`)
> 3. **API routes** — `auth/[...all]`, `stripe/webhook`, `plaid/{link-token, exchange, connections, webhook}`, `cron/plaid-webhook-cleanup`, `invitations/*`, `user-invitations/*`, `invoices/*`, `supplier-invoices/*`, `sales-orders/*`, `support-tickets/*`, `tenant/branding/*`
> 4. **Server modules** — `modules/core` (billing, feature-flags, platform-admin, tenants, workspace-settings) and `modules/distribution` (customers, suppliers, products, lots, inventory, price-chart, orders, invoices, payments, supplier-invoices including AI pipeline, plaid, expenses), `modules/shared`
>
> **Data layer (below the app)**:
> - Neon Postgres (Drizzle ORM; pooled + unpooled connection URLs)
> - Cloudflare R2 (presigned PUT/GET for tenant logos, sales-order attachments, supplier-invoice attachments, support-ticket attachments)
>
> **Third-party SaaS on the right, grouped by purpose** (each group is its own tinted subgraph):
> - **Auth**: Better Auth (drawn inside the Next.js app — it is a library, not a service), Google OAuth (external)
> - **Billing**: Stripe (Checkout, Customer Portal, webhooks, catalog sync)
> - **Comms**: Resend (magic links, invitations, support emails)
> - **Banking**: Plaid (Link token issuance, public→access token exchange, transactions sync, webhooks via ES256 JWT)
> - **AI**: OpenAI (**primary** — gpt-4o-mini text + gpt-4o vision for supplier-invoice extraction and product matching). Anthropic Claude (**fallback** — intended, currently a TODO at `ai-provider.ts:216`; render as a slightly dashed/faded box to indicate "planned").
> - **Observability**: Sentry (errors + traces 10% sample + PII filter), PostHog (US Cloud, server flushAt:1), Better Stack (cron heartbeats — only one wired today), Upstash Redis (rate limiting — pdfParse, pdfParseTenant, plaidSync, emailForward, magicLink, genericApi)
>
> **Scheduled jobs**: Vercel Cron daily 02:00 UTC → `/api/cron/plaid-webhook-cleanup` (authenticated via `Authorization: Bearer ${CRON_SECRET}`).
>
> Include a compact legend in the lower right showing each color's meaning and edge-style conventions (solid = primary path, dashed red = failure/blocked).
