import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { ssoProvider } from "@/db/auth-schema";
import { tenantSsoSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertTenantCanUseFeature } from "@/lib/subscription-plan-capabilities";
import { buildTenantAppUrl, type RequestTenantHostContext } from "@/lib/tenant-host";
import { requireAdminPortalUser } from "@/modules/shared/services/portal-users";
import {
  getCurrentRequestTenant,
  getCurrentTenant,
} from "@/modules/core/tenants/services/tenants";

import {
  oidcDiscoveryEndpoint,
  parseOidcScopes,
  ssoAcsPath,
  ssoSettingsInputSchema,
  type SsoProtocol,
  type SsoProvisionRole,
} from "./sso-settings.schema";

export type TenantSsoConnection = {
  configured: boolean;
  protocol: SsoProtocol | null;
  defaultRole: SsoProvisionRole;
  enforceSsoOnly: boolean;
  displayLabel: string | null;
  status: "active" | "disabled" | null;
  /** IdP-facing URLs the admin pastes into their identity provider. */
  endpoints: {
    /** SAML Assertion Consumer Service (ACS). */
    acsUrl: string;
    /** SAML SP metadata. */
    spMetadataUrl: string;
    /** OIDC redirect / callback URL. */
    oidcRedirectUrl: string;
  };
};

function tenantUrl(
  slug: string,
  pathname: string,
  context: RequestTenantHostContext,
): string {
  return buildTenantAppUrl({ slug, pathname, context });
}

/**
 * Current SSO connection state for the active tenant + the IdP-facing URLs to
 * display. Requires an admin and the `sso` capability.
 */
export async function getTenantSsoConnection(): Promise<TenantSsoConnection> {
  await requireAdminPortalUser();
  const tenant = await getCurrentTenant();
  assertTenantCanUseFeature(tenant, "sso");

  const { hostContext } = await resolveTenantHostContext();
  const slug = tenant.slug;
  const endpoints = {
    acsUrl: tenantUrl(slug, ssoAcsPath(slug), hostContext),
    spMetadataUrl: `${tenantUrl(slug, "/api/auth/sso/saml2/sp/metadata", hostContext)}?providerId=${encodeURIComponent(slug)}`,
    oidcRedirectUrl: tenantUrl(
      slug,
      `/api/auth/sso/callback/${encodeURIComponent(slug)}`,
      hostContext,
    ),
  };

  const settings = await db.query.tenantSsoSettings.findFirst({
    where: eq(tenantSsoSettings.tenantId, tenant.id),
  });

  if (!settings) {
    return {
      configured: false,
      protocol: null,
      defaultRole: "sales",
      enforceSsoOnly: false,
      displayLabel: null,
      status: null,
      endpoints,
    };
  }

  return {
    configured: true,
    protocol: settings.protocol,
    defaultRole: settings.defaultRole as SsoProvisionRole,
    enforceSsoOnly: settings.enforceSsoOnly,
    displayLabel: settings.displayLabel,
    status: settings.status,
    endpoints,
  };
}

async function resolveTenantHostContext(): Promise<{
  hostContext: RequestTenantHostContext;
}> {
  const requestTenant = await getCurrentRequestTenant();
  return { hostContext: requestTenant };
}

/**
 * Create or replace the active tenant's SSO provider (idempotent upsert).
 * Validates input, registers the provider with `@better-auth/sso`
 * (`providerId = tenant.slug`), and upserts the app-side policy row. Gated to
 * admins + the `sso` capability.
 */
export async function upsertTenantSsoProvider(rawInput: unknown): Promise<void> {
  const input = ssoSettingsInputSchema.parse(rawInput);
  const admin = await requireAdminPortalUser();
  const tenant = await getCurrentTenant();
  assertTenantCanUseFeature(tenant, "sso");

  const { hostContext } = await resolveTenantHostContext();
  const providerId = tenant.slug;
  const domain = emailDomain(admin.email) ?? `${tenant.slug}.sso`;
  const requestHeaders = await headers();

  // Clean re-register: drop any existing provider row for this providerId so a
  // fresh registration replaces it (the plugin has no delete endpoint).
  await db.delete(ssoProvider).where(eq(ssoProvider.providerId, providerId));

  if (input.protocol === "oidc") {
    await auth.api.registerSSOProvider({
      headers: requestHeaders,
      body: {
        providerId,
        issuer: input.issuer,
        domain,
        oidcConfig: {
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          discoveryEndpoint: oidcDiscoveryEndpoint(input.issuer),
          scopes: parseOidcScopes(input.scopes),
          pkce: true,
        },
      },
    });
  } else {
    const acsUrl = tenantUrl(tenant.slug, ssoAcsPath(providerId), hostContext);
    await auth.api.registerSSOProvider({
      headers: requestHeaders,
      body: {
        providerId,
        issuer: input.idpIssuer,
        domain,
        samlConfig: {
          entryPoint: input.idpSsoUrl,
          cert: input.idpCertificate,
          callbackUrl: acsUrl,
          spMetadata: {
            metadata: "",
          },
          wantAssertionsSigned: true,
        },
      },
    });
  }

  await db
    .insert(tenantSsoSettings)
    .values({
      tenantId: tenant.id,
      providerId,
      protocol: input.protocol,
      defaultRole: input.defaultRole,
      enforceSsoOnly: input.enforceSsoOnly,
      displayLabel: input.displayLabel ?? null,
      status: "active",
    })
    .onConflictDoUpdate({
      target: tenantSsoSettings.tenantId,
      set: {
        providerId,
        protocol: input.protocol,
        defaultRole: input.defaultRole,
        enforceSsoOnly: input.enforceSsoOnly,
        displayLabel: input.displayLabel ?? null,
        status: "active",
        updatedAt: new Date(),
      },
    });
}

/** Remove the active tenant's SSO connection (provider + policy row). */
export async function deleteTenantSsoProvider(): Promise<void> {
  await requireAdminPortalUser();
  const tenant = await getCurrentTenant();
  assertTenantCanUseFeature(tenant, "sso");

  await db
    .delete(ssoProvider)
    .where(eq(ssoProvider.providerId, tenant.slug));
  await db
    .delete(tenantSsoSettings)
    .where(eq(tenantSsoSettings.tenantId, tenant.id));
}

function emailDomain(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  if (!email || at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}
