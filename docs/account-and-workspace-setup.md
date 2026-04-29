# Account signup and workspace onboarding

Acme Distribution distinguishes **credentials** (Better Auth identity) from **ERP access** (`portal_users` rows scoped to tenants). This separation keeps subdomain routing predictable and aligns with invite-only workspaces.

## Account signup (`/sign-up` on root host)

- Creates an **authentication user** only.
- Redirects toward **login**, then **`/onboarding`** on your root (`ROOT_DOMAIN`) host to create or join a tenant.
- Signing up via **Google** behaves the same: after auth, net-new identities go to onboarding when they have nowhere to land.

Signup on a **tenant subdomain** (`acme.${ROOT_DOMAIN}`) does **not** create workspaces. It verifies the subdomain context and directs people to invitation or tenant sign-in flows so host-based routing stays correct.

## Workspace onboarding (`/onboarding`)

- Available only on the **root** application host (`isRootHost`), not tenant subdomains.
- Collects a **workspace name** plus a URL slug (shown as **Workspace URL** in the UI — the persisted model is still `tenants.slug` in Postgres).
- The slug drives `https://{slug}.${ROOT_DOMAIN}` (or localhost / localtest patterns per `docs/local-development.md`).
- Names are normalized and checked for collisions. Reserved subdomain labels (for example **`admin`**, **`app`**, **`api`**, **`onboarding`**, **`select-destination`**) cannot be tenant slugs so they never collide with global routes or infra.

## Invite-only tenant access by default

Except for onboarding on the root host:

- ERP access is mediated by **`portal_users`** memberships.
- Invitation emails link users to **`/invite/[token]`** on the issuing tenant host. Accepting attaches the authenticated user to **that tenant** when the invite is valid — new and existing identities are supported (`buildRootHostHeadersForAuth` is used when Better Auth requires a tenant session bootstrap before portal rows exist).
- Users discovered only through **email/Google destination selection** routes may see **`/select-destination`** whenever they have more than one membership or combine tenant access with optional platform-admin access.

Without a tenant membership **and** without platform-admin access (for internal operations), authenticated users hitting the marketing app settle on onboarding until someone invites them — which matches “invite-only unless you bootstrap your own company workspace from the root UI.”

## Related code

| Area | Paths |
| ---- | ----- |
| Onboarding routes | `app/onboarding/page.tsx`, `app/onboarding/onboarding-form.tsx` |
| Tenant slug policy | `lib/tenant-slug-policy.ts`, `lib/tenant-host.ts`, `services/auth.ts` (`completeUserOnboarding`) |
| Account-only signup service | `signUpAccountOnly` in `services/auth.ts` |

See also **`docs/local-development.md`** for `ROOT_DOMAIN`, `admin.${ROOT_DOMAIN}`, and local tenant host patterns.
