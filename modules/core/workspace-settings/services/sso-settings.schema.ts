import { z } from "zod";

/**
 * App-facing SSO connection input collected from the tenant-admin form, kept
 * pure (no DB / Better Auth imports) so it backs both the client form
 * (zodResolver) and the server action. The service translates this into the
 * `@better-auth/sso` register payload.
 */

/** Roles a JIT-provisioned SSO user may receive (never `owner`). */
export const SSO_PROVISION_ROLES = [
  "admin",
  "sales",
  "warehouse",
  "accounting",
] as const;
export type SsoProvisionRole = (typeof SSO_PROVISION_ROLES)[number];

export const SSO_PROTOCOLS = ["oidc", "saml"] as const;
export type SsoProtocol = (typeof SSO_PROTOCOLS)[number];

const sharedFields = {
  defaultRole: z.enum(SSO_PROVISION_ROLES).default("sales"),
  enforceSsoOnly: z.boolean().default(false),
  displayLabel: z
    .string()
    .trim()
    .max(120, "Keep the label under 120 characters.")
    .optional(),
};

const trimmed = (label: string) =>
  z.string().trim().min(1, `${label} is required.`);

export const oidcSsoInputSchema = z.object({
  protocol: z.literal("oidc"),
  /** IdP issuer, e.g. https://acme.okta.com */
  issuer: z.url("Enter a valid issuer URL (https://…)."),
  clientId: trimmed("Client ID"),
  clientSecret: trimmed("Client secret"),
  /** Optional space/comma-separated scopes; defaults applied in the service. */
  scopes: z.string().trim().optional(),
  ...sharedFields,
});

export const samlSsoInputSchema = z.object({
  protocol: z.literal("saml"),
  /** IdP EntityID / issuer. */
  idpIssuer: trimmed("IdP issuer / EntityID"),
  /** IdP Single Sign-On URL (redirect binding). */
  idpSsoUrl: z.url("Enter a valid IdP SSO URL (https://…)."),
  /** IdP signing certificate (PEM or base64 body). */
  idpCertificate: trimmed("IdP signing certificate"),
  ...sharedFields,
});

export const ssoSettingsInputSchema = z.discriminatedUnion("protocol", [
  oidcSsoInputSchema,
  samlSsoInputSchema,
]);

export type SsoSettingsInput = z.infer<typeof ssoSettingsInputSchema>;
export type OidcSsoInput = z.infer<typeof oidcSsoInputSchema>;
export type SamlSsoInput = z.infer<typeof samlSsoInputSchema>;

/** OIDC discovery document URL derived from an issuer. */
export function oidcDiscoveryEndpoint(issuer: string): string {
  return `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
}

/**
 * Path (on the tenant's own host) the IdP posts SAML assertions to. The full
 * URL is this path on the tenant subdomain so the post-callback session binds
 * the correct tenant.
 */
export function ssoAcsPath(providerId: string): string {
  return `/api/auth/sso/saml2/sp/acs/${encodeURIComponent(providerId)}`;
}

/** Parse a free-form scopes string into a normalized list (default openid set). */
export function parseOidcScopes(raw: string | undefined): string[] {
  const fallback = ["openid", "email", "profile"];
  if (!raw || !raw.trim()) return fallback;
  const parts = raw
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const withOpenId = parts.includes("openid") ? parts : ["openid", ...parts];
  return Array.from(new Set(withOpenId));
}
