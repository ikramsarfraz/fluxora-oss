import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTenantHostnamePreview,
  isReservedTenantSlug,
  slugifyTenantName,
} from "./tenant-slug-policy";

test("slugifyTenantName normalizes casing and separators", () => {
  assert.equal(slugifyTenantName("  Acme Foods LLC  "), "acme-foods-llc");
});

test("slugifyTenantName fills empty slug", () => {
  assert.equal(slugifyTenantName("!!!"), "tenant");
});

test("isReservedTenantSlug blocks infra and route names", () => {
  assert.equal(isReservedTenantSlug("admin"), true);
  assert.equal(isReservedTenantSlug("select-destination"), true);
  assert.equal(isReservedTenantSlug("WWW"), true);
});

test("isReservedTenantSlug allows workspace slugs", () => {
  assert.equal(isReservedTenantSlug("acme-distro"), false);
});

test("buildTenantHostnamePreview uses localhost style on localhost", () => {
  assert.equal(
    buildTenantHostnamePreview({
      slug: "acme",
      hostname: "localhost",
      rootDomain: "localhost",
      port: "3100",
    }),
    "acme.localhost:3100",
  );
});

test("buildTenantHostnamePreview uses ROOT_DOMAIN for app hosts", () => {
  assert.equal(
    buildTenantHostnamePreview({
      slug: "acme",
      hostname: "app.example.com",
      rootDomain: "example.com",
      port: null,
    }),
    "acme.example.com",
  );
});
