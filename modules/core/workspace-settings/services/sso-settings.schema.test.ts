import test from "node:test";
import assert from "node:assert/strict";

import {
  oidcDiscoveryEndpoint,
  parseOidcScopes,
  ssoAcsPath,
  ssoSettingsInputSchema,
} from "@/modules/core/workspace-settings/services/sso-settings.schema";

test("valid OIDC input parses with defaults", () => {
  const result = ssoSettingsInputSchema.safeParse({
    protocol: "oidc",
    issuer: "https://acme.okta.com",
    clientId: "abc",
    clientSecret: "shh",
  });
  assert.ok(result.success);
  if (result.success && result.data.protocol === "oidc") {
    assert.equal(result.data.defaultRole, "sales");
    assert.equal(result.data.enforceSsoOnly, false);
  }
});

test("OIDC rejects a non-URL issuer", () => {
  const result = ssoSettingsInputSchema.safeParse({
    protocol: "oidc",
    issuer: "not-a-url",
    clientId: "abc",
    clientSecret: "shh",
  });
  assert.equal(result.success, false);
});

test("OIDC rejects an empty client secret", () => {
  const result = ssoSettingsInputSchema.safeParse({
    protocol: "oidc",
    issuer: "https://acme.okta.com",
    clientId: "abc",
    clientSecret: "   ",
  });
  assert.equal(result.success, false);
});

test("valid SAML input parses", () => {
  const result = ssoSettingsInputSchema.safeParse({
    protocol: "saml",
    idpIssuer: "https://idp.example.com/entity",
    idpSsoUrl: "https://idp.example.com/sso",
    idpCertificate: "MIIC...cert...",
    defaultRole: "warehouse",
  });
  assert.ok(result.success);
  if (result.success && result.data.protocol === "saml") {
    assert.equal(result.data.defaultRole, "warehouse");
  }
});

test("SAML rejects a missing certificate", () => {
  const result = ssoSettingsInputSchema.safeParse({
    protocol: "saml",
    idpIssuer: "https://idp.example.com/entity",
    idpSsoUrl: "https://idp.example.com/sso",
    idpCertificate: "",
  });
  assert.equal(result.success, false);
});

test("discriminated union rejects an unknown protocol", () => {
  const result = ssoSettingsInputSchema.safeParse({
    protocol: "ldap",
    issuer: "https://acme.okta.com",
  });
  assert.equal(result.success, false);
});

test("owner is not an allowed JIT default role", () => {
  const result = ssoSettingsInputSchema.safeParse({
    protocol: "oidc",
    issuer: "https://acme.okta.com",
    clientId: "abc",
    clientSecret: "shh",
    defaultRole: "owner",
  });
  assert.equal(result.success, false);
});

test("oidcDiscoveryEndpoint appends well-known and strips trailing slash", () => {
  assert.equal(
    oidcDiscoveryEndpoint("https://acme.okta.com"),
    "https://acme.okta.com/.well-known/openid-configuration",
  );
  assert.equal(
    oidcDiscoveryEndpoint("https://acme.okta.com/"),
    "https://acme.okta.com/.well-known/openid-configuration",
  );
});

test("ssoAcsPath is the tenant-host ACS path for the provider", () => {
  assert.equal(
    ssoAcsPath("acme"),
    "/api/auth/sso/saml2/sp/acs/acme",
  );
});

test("parseOidcScopes defaults and always includes openid", () => {
  assert.deepEqual(parseOidcScopes(undefined), ["openid", "email", "profile"]);
  assert.deepEqual(parseOidcScopes(""), ["openid", "email", "profile"]);
  assert.deepEqual(parseOidcScopes("email groups"), [
    "openid",
    "email",
    "groups",
  ]);
  assert.deepEqual(parseOidcScopes("openid, email"), ["openid", "email"]);
});
