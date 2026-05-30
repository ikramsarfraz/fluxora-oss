# Enterprise SSO (SAML 2.0 + OIDC)

Enterprise tenants can let their team sign in through their own identity provider. Built on the official **`@better-auth/sso`** plugin (`lib/auth.ts`).

## Gating

- **Plan capability** `sso` — enterprise only (`lib/subscription-plan-capabilities.ts`; comped → enterprise).
- **Feature flag** `core.sso` — per-tenant kill switch (default on), `modules/core/feature-flags/`.

Both must pass. Tenant admins configure SSO at **Settings → Team → Single Sign-On** (`/settings/team/sso`).

## Model

- One SSO provider per tenant, keyed by **`providerId = tenant.slug`**. Sign-in happens on the tenant subdomain, so the slug is known from the host — no email-domain discovery.
- Auth-critical provider config lives in the Better-Auth-owned **`sso_provider`** table (`db/auth-schema.ts`). App policy (protocol, default role, enforce-SSO, label, status) lives in **`tenant_sso_settings`** (`db/schema.ts`).
- **JIT provisioning:** first SSO login auto-creates a `portal_users` row with the configured default role. This runs in the `session.create.before` hook (which fires before the plugin's `provisionUser`), gated strictly to SSO callback paths so magic-link/Google can never auto-join a tenant. Helper: `modules/shared/services/sso-jit.ts`.

## IdP setup (admin)

The settings card displays the per-tenant URLs to paste into the IdP:

- **OIDC redirect/callback:** `https://<slug>.<root>/api/auth/sso/callback/<slug>`
- **SAML ACS:** `https://<slug>.<root>/api/auth/sso/saml2/sp/acs/<slug>`
- **SAML SP metadata:** `https://<slug>.<root>/api/auth/sso/saml2/sp/metadata?providerId=<slug>`

OIDC inputs: issuer, client ID, client secret, (optional) scopes — discovery is derived from the issuer. SAML inputs: IdP EntityID/issuer, IdP SSO URL, IdP signing certificate.

`Require SSO` hides magic-link/Google for that tenant. Platform admins retain a recovery path (the `admin.` host uses platform auth, not tenant SSO).

## Deployment

1. Apply migration **0075** (`pnpm db:migrate`) — adds `sso_provider` + `tenant_sso_settings`.
2. No new env vars. SSO endpoints live under `/api/auth/**`, already rate-limit-exempt + served on all hosts in `proxy.ts`; cross-subdomain cookies + wildcard `trustedOrigins` already configured.

## Testing notes

- Pure validation + URL mapping are unit-tested (`sso-settings.schema.test.ts`).
- A real handshake needs an IdP: OIDC against an Okta/Auth0/Entra dev app; SAML against a mock IdP (`saml-idp`, SimpleSAMLphp, samltest.id). Verify the callback lands on the tenant subdomain, a `portal_users` row is auto-created with the default role, and the session binds the correct `tenantId`. Sign in twice → no duplicate user. Configure on a second tenant → confirm isolation.

## Known limitations

- Coupons/discounts are unrelated; n/a here.
- Profile attributes are not re-synced on every login (provisioning is first-login only).
- SAML uses redirect binding with the IdP signing cert; advanced options (encrypted assertions, custom signature algorithms) are available in the plugin but not yet surfaced in the admin UI.
