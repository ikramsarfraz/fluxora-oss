import assert from "node:assert/strict";
import test from "node:test";

import { getRequestTenantHostContextFromHeaders } from "./tenant-host";

function hdrs(host: string, extra: Record<string, string> = {}): Headers {
  const h = new Headers({ host });
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

test.beforeEach(() => {
  process.env.ROOT_DOMAIN = "fluxora.com";
});

test("tenant host: slug comes from hostname, forged x-tenant-slug is ignored", () => {
  const ctx = getRequestTenantHostContextFromHeaders(
    hdrs("acme.fluxora.com", { "x-tenant-slug": "victim" }),
  );
  assert.equal(ctx.tenantSlug, "acme");
  assert.equal(ctx.isTenantHost, true);
  assert.equal(ctx.isPlatformAdminHost, false);
});

test("tenant host: root domain with forged x-tenant-slug stays root, not tenant", () => {
  const ctx = getRequestTenantHostContextFromHeaders(
    hdrs("fluxora.com", { "x-tenant-slug": "victim" }),
  );
  assert.equal(ctx.tenantSlug, null);
  assert.equal(ctx.isRootHost, true);
  assert.equal(ctx.isTenantHost, false);
});

test("tenant host: platform-admin host is never a tenant host regardless of forged header", () => {
  const ctx = getRequestTenantHostContextFromHeaders(
    hdrs("admin.fluxora.com", { "x-tenant-slug": "victim" }),
  );
  assert.equal(ctx.tenantSlug, null);
  assert.equal(ctx.isPlatformAdminHost, true);
  assert.equal(ctx.isTenantHost, false);
});

test("tenant host: legitimate tenant host with no forged header works correctly", () => {
  const ctx = getRequestTenantHostContextFromHeaders(
    hdrs("beta.fluxora.com"),
  );
  assert.equal(ctx.tenantSlug, "beta");
  assert.equal(ctx.isTenantHost, true);
});
