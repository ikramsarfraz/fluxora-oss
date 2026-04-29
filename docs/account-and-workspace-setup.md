# Account signup and workspace onboarding

Acme Distribution distinguishes **identity** (Better Auth `user` rows, including `first_name` / `last_name` / `full_name`) from **ERP access** (`portal_users` rows scoped to tenants). This separation keeps subdomain routing predictable and aligns with invite-only workspaces.

## Authentication

- **Email:** users request a **magic sign-in link**. New users are created when they first complete the link (when sign-up is enabled).
- **Google:** optional OAuth; after sign-in, routing matches the email flow (destination chooser, onboarding, or dashboards).
- Password-based sign-up and sign-in are **disabled**.

## Account signup (`/sign-up` on root host)

- Collects **first name**, **last name**, and **email**. A pending profile (`signup_profile_pending`) holds the split name until Better Auth creates the user; `full_name` is derived and written to `user.full_name`, `user.name`, etc.
- After submit, the UI asks the user to **check email** for the sign-in link rather than redirecting to password login.
- **Google** behaves the same routing-wise: after auth, net-new identities without a destination go to **`/onboarding`** when appropriate.

Signup on a **tenant subdomain** (`acme.${ROOT_DOMAIN}`) does **not** create workspaces. It verifies the subdomain context and directs people to invitation or tenant sign-in flows so host-based routing stays correct.

## Workspace onboarding (`/onboarding`)

- Available only on the **root** application host (`isRootHost`), not tenant subdomains.
- **Set up your workspace:** collects a **workspace name** plus a URL slug (shown as **Workspace URL** in the UI — the persisted model is still `tenants.slug` in Postgres). Personal name was already collected at sign-up.
- The slug drives `https://{slug}.${ROOT_DOMAIN}` (or localhost / localtest patterns per `docs/local-development.md`).
- Names are normalized and checked for collisions. Reserved subdomain labels (for example **`admin`**, **`app`**, **`api`**, **`onboarding`**, **`select-destination`**) cannot be tenant slugs so they never collide with global routes or infra.

## Invite-only tenant access by default

Except for onboarding on the root host:

- ERP access is mediated by **`portal_users`** memberships.
- Invitation emails link users to **`/invite/[token]`** on the issuing tenant host. The recipient **requests a magic sign-in email** for the invited address if they are not signed in; when signed in as that email, **Join workspace** attaches the account to the tenant and marks the invite accepted.
- Users discovered only through **email/Google destination selection** routes may see **`/select-destination`** whenever they have more than one membership or combine tenant access with optional platform-admin access.

Without a tenant membership **and** without platform-admin access (for internal operations), authenticated users hitting the marketing app settle on onboarding until someone invites them — which matches “invite-only unless you bootstrap your own company workspace from the root UI.”

## Related code

| Area | Paths |
| ---- | ----- |
| Onboarding routes | `app/onboarding/page.tsx`, `app/onboarding/onboarding-form.tsx` |
| Tenant slug policy | `lib/tenant-slug-policy.ts`, `lib/tenant-host.ts`, `services/auth.ts` (`completeUserOnboarding`) |
| Root signup magic link | `sendRootSignupMagicLink` in `services/auth.ts`; pending names in `services/signup-profile.ts` |

See also **`docs/local-development.md`** for `ROOT_DOMAIN`, `admin.${ROOT_DOMAIN}`, and local tenant host patterns.
