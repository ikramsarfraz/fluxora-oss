# Account signup and workspace onboarding

Acme Distribution distinguishes **identity** (Better Auth `user` rows, including `first_name` / `last_name` / `full_name`) from **ERP access** (`portal_users` rows scoped to tenants). This separation keeps subdomain routing predictable and aligns with invite-only workspaces.

## Authentication

- **Email:** users request a **magic sign-in link** with **email only**. New users are created when they first complete the link (when sign-up is enabled).
- **Google:** optional OAuth; after sign-in, routing matches the email flow (destination chooser, onboarding, or dashboards).
- Password-based sign-up and sign-in are **disabled**.

## Account signup (`/sign-up` on root host)

- Collects **email only**. Submitting sends the magic link; **`first_name` / `last_name`** are captured later on **`/onboarding`** with workspace creation.
- The magic link may land straight on **`/onboarding`** (new-user callback) once the user verifies.
- After submit, the UI asks the user to **check email** for the sign-in link rather than redirecting to password login.
- **Google:** same routing-wise: net-new identities without a destination go to **`/onboarding`** when appropriate.

Signup on a **tenant subdomain** (`acme.${ROOT_DOMAIN}`) does **not** create workspaces. It verifies the subdomain context and directs people to invitation or tenant sign-in flows so host-based routing stays correct.

## Workspace onboarding (`/onboarding`)

- Available only on the **root** application host (`isRootHost`), not tenant subdomains.
- Collects **first name**, **last name**, **workspace name**, and a **workspace URL slug** (shown as **Workspace URL**; persisted as `tenants.slug` in Postgres). Submitting creates the tenant, owner **`portal_users`** row, sets the tenant on the Better Auth session, and syncs `user.full_name` / `user.name` from first + last.
- The slug drives `https://{slug}.${ROOT_DOMAIN}` (or localhost / localtest patterns per `docs/local-development.md`).
- Names are normalized and checked for collisions. Reserved subdomain labels (for example **`admin`**, **`app`**, **`api`**, **`onboarding`**, **`select-destination`**) cannot be tenant slugs so they never collide with global routes or infra.

## Invite-only tenant access by default

Except for onboarding on the root host:

- ERP access is mediated by **`portal_users`** memberships.
- Invitation emails link users to **`/invite/[token]`** on the issuing tenant host. The recipient **requests a magic sign-in email** for the invited address if they are not signed in; when signed in as that email, **Join workspace** attaches the account to the tenant and marks the invite accepted.
- Users discovered only through **email/Google destination selection** routes may see **`/select-destination`** whenever they have more than one membership or combine tenant access with optional platform-admin access.

**Invited** users already belong to an organization (**no self-serve workspace creation**); they do not go through `/onboarding`. If their Better Auth profile is incomplete, onboarding-style name collection stays **out** of invite acceptance—they are routed by membership, not workspace bootstrap.

Without a tenant membership **and** without platform-admin access (for internal operations), authenticated users hitting the marketing home (**`/`**) on the root host are routed to onboarding or **`/select-destination`** depending on memberships—matching invite-only ERP access unless someone bootstraps a company workspace from root.

## Related code

| Area | Paths |
| ---- | ------ |
| Onboarding routes | `app/onboarding/page.tsx`, `app/onboarding/onboarding-form.tsx` |
| Tenant slug policy | `lib/tenant-slug-policy.ts`, `lib/tenant-host.ts`, `services/auth.ts` (`completeUserOnboarding`) |
| Root signup magic link | `sendRootSignupMagicLink` in `services/auth.ts`; initial display fields via `bootstrapAuthUserIdentityOnCreate` in `services/signup-profile.ts` |

See also **`docs/local-development.md`** for `ROOT_DOMAIN`, `admin.${ROOT_DOMAIN}`, and local tenant host patterns.
