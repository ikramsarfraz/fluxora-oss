/**
 * Cross-tenant isolation integration test (#241).
 *
 * Seeds two tenants in a disposable Postgres (see docker-compose.test.yml +
 * scripts/test-integration.sh), creates A's data, then drives service-layer
 * reads and writes from a "tenant B session" context and asserts every
 * cross-tenant path denies.
 *
 * What this test proves
 * ─────────────────────
 *  - Service-layer reads scoped via `getCurrentTenant()` return `null` /
 *    empty when the tenantId on the row doesn't match the session's tenant.
 *  - Service-layer writes throw rather than silently mutate a row from
 *    a different tenant.
 *  - The auth boundary in `getCurrentTenant()` rejects a session whose
 *    `tenantId` doesn't match the host's tenant slug — the "stolen cookie
 *    pivoted to another tenant" attack vector.
 *
 * What this test does NOT prove (out of scope, would require a real
 * Next.js HTTP context + Better Auth cookie flow):
 *  - Cookie issuance, session token format, or rotation behavior.
 *  - Middleware-level tenant routing in `proxy.ts`.
 *  - That every service function calls `getCurrentTenant()` at all —
 *    a service that forgot to scope by tenantId would not be caught by
 *    this test unless we add a probe for it (we cover three modules so
 *    a missing scope in a covered service would surface; the rest is
 *    by code review and the `check:boundaries` script).
 *
 * Mocks
 * ─────
 * `next/headers` and `@/lib/auth` are stubbed via node:test's
 * `mock.module()` so service functions can run outside a Next.js HTTP
 * context. The DB layer is the real Postgres from docker-compose.test.yml;
 * the WHERE clauses we're asserting on are exercised against a live
 * connection.
 */

import { mock, test, before, after } from "node:test";
import { strict as assert } from "node:assert";

// ── Hard guard: this test seeds rows directly via Drizzle, so if the
//    resolved DATABASE_URL is anything other than localhost, those
//    rows would land in whatever DB the URL points at (likely the
//    user's Neon dev/prod). Dotenv's `override: true` loaders inside
//    db/index.ts can silently re-target a shell-exported URL, so we
//    re-check the resolved value here BEFORE importing the db module.
//
//    The script (scripts/test-integration.sh) swaps .env.local out of
//    the way to prevent the override; this guard catches anyone who
//    invokes the test file directly, bypassing the script.
{
  // We have to read the same way db/database-url.ts does — dotenv loads
  // .env then .env.local with override:true, then the resolver picks
  // DATABASE_URL or falls back to DATABASE_URL_UNPOOLED. Doing the same
  // load order here lets us see exactly what db/index.ts will see.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { config: loadEnv } = await import("dotenv");
  loadEnv({ path: ".env" });
  loadEnv({ path: ".env.local", override: true });
  const resolved =
    process.env.DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim();
  if (!resolved) {
    throw new Error(
      "[#241] DATABASE_URL is unset — refusing to run. Use pnpm test:integration.",
    );
  }
  const url = new URL(
    resolved.startsWith("postgres") ? resolved : `postgres://${resolved}`,
  );
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(
      `[#241] tenant-isolation test resolved DATABASE_URL host="${url.hostname}" ` +
        `— refusing to run. The test seeds rows directly into the DB; ` +
        `it must only ever target a disposable local Postgres. Use ` +
        `pnpm test:integration (which boots docker-compose.test.yml).`,
    );
  }
}

// ── Mocks must be declared BEFORE any imports that transitively pull
//    `next/headers` or `@/lib/auth`. The test runtime hits these
//    statements first; subsequent dynamic imports below see the stubs.
type TestCtx = {
  authUserId: string;
  /** What the (stubbed) session row claims its tenant is. */
  sessionTenantId: string | null;
  /** What the (stubbed) request host classifies into. */
  hostTenantSlug: string;
} | null;

let testCtx: TestCtx = null;
function setCtx(ctx: TestCtx) {
  testCtx = ctx;
}

// node:test renamed `namedExports` → `exports` in v22.3+ (the runtime
// logs a one-time deprecation but still accepts both). @types/node
// only types `namedExports` for now, so we use that — swap to
// `exports` when the types catch up.
mock.module("next/headers", {
  namedExports: {
    headers: async () =>
      new Headers({
        host: testCtx?.hostTenantSlug
          ? `${testCtx.hostTenantSlug}.localtest.me:3000`
          : "localtest.me:3000",
      }),
    cookies: async () => ({
      get: () => undefined,
      getAll: () => [],
      has: () => false,
      set: () => undefined,
      delete: () => undefined,
    }),
  },
});

mock.module("@/lib/auth", {
  namedExports: {
    auth: {
      api: {
        getSession: async () =>
          testCtx
            ? {
                user: {
                  id: testCtx.authUserId,
                  email: `${testCtx.authUserId}@test.local`,
                },
                session: {
                  id: `test-session-${testCtx.authUserId}`,
                  userId: testCtx.authUserId,
                  tenantId: testCtx.sessionTenantId,
                  token: `test-token-${testCtx.authUserId}`,
                  expiresAt: new Date(Date.now() + 86_400_000),
                },
              }
            : null,
      },
    },
  },
});

// Now the real imports. tsx + node's module-mock loader resolve these
// against the stubs above.
const { db } = await import("@/db");
const { tenants, portalUsers, customers, categories } = await import(
  "@/db/schema"
);
const { user } = await import("@/db/auth-schema");
const { eq, inArray } = await import("drizzle-orm");
const { getCurrentTenant } = await import(
  "@/modules/core/tenants/services/tenants"
);
const { getCustomerById, getCustomers, updateCustomer } = await import(
  "@/modules/distribution/customers/services/customers"
);
const { getCategories, getCategoryById } = await import(
  "@/modules/distribution/categories/services/categories"
);

// Fixture handles populated in before() and referenced by every probe.
let tenantA!: { id: string; slug: string };
let tenantB!: { id: string; slug: string };
let userAId = "test-user-a-" + Math.random().toString(36).slice(2, 10);
let userBId = "test-user-b-" + Math.random().toString(36).slice(2, 10);
let customerAId!: string;
let categoryAId!: string;

before(async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[#241] tenant-isolation test refuses to run with NODE_ENV=production",
    );
  }

  // Two distinct tenants. Slugs are random so reruns in a non-tmpfs DB
  // can't collide on the (tenant_slug) unique index.
  const slugA = "tenant-a-" + Math.random().toString(36).slice(2, 8);
  const slugB = "tenant-b-" + Math.random().toString(36).slice(2, 8);
  const [tA] = await db
    .insert(tenants)
    .values({ name: "Tenant A", slug: slugA })
    .returning();
  const [tB] = await db
    .insert(tenants)
    .values({ name: "Tenant B", slug: slugB })
    .returning();
  tenantA = { id: tA.id, slug: tA.slug };
  tenantB = { id: tB.id, slug: tB.slug };

  // Better Auth user rows. We don't insert sessions because
  // `auth.api.getSession` is fully mocked above.
  await db.insert(user).values({
    id: userAId,
    name: "Alice",
    fullName: "Alice",
    email: `${userAId}@test.local`,
    emailVerified: false,
  });
  await db.insert(user).values({
    id: userBId,
    name: "Bob",
    fullName: "Bob",
    email: `${userBId}@test.local`,
    emailVerified: false,
  });

  // Portal users — one per tenant. The role is "admin" so probes that
  // touch `requireAdminPortalUser` (e.g. tenant settings writes) would
  // pass the role check; the relevant denial here is the tenantId
  // boundary, not the role boundary.
  await db.insert(portalUsers).values({
    tenantId: tenantA.id,
    authUserId: userAId,
    email: `${userAId}@test.local`,
    fullName: "Alice",
    role: "admin",
  });
  await db.insert(portalUsers).values({
    tenantId: tenantB.id,
    authUserId: userBId,
    email: `${userBId}@test.local`,
    fullName: "Bob",
    role: "admin",
  });

  // Tenant A's data. We don't seed anything for B intentionally — the
  // probes assert B sees zero of A's rows, which is stronger evidence
  // than "B sees only B's rows".
  const [cA] = await db
    .insert(customers)
    .values({ tenantId: tenantA.id, name: "Acme Foods (owned by A)" })
    .returning();
  customerAId = cA.id;

  const [catA] = await db
    .insert(categories)
    .values({
      tenantId: tenantA.id,
      name: "Produce (owned by A)",
      slug: "produce-a-" + Math.random().toString(36).slice(2, 8),
    })
    .returning();
  categoryAId = catA.id;
});

after(async () => {
  // tmpfs Postgres + `docker compose down -v` in the runner script
  // makes this technically unnecessary, but keeping the explicit
  // teardown means the suite is also safe against a developer's
  // local DB if they ever decide to point the script at one.
  await db
    .delete(categories)
    .where(inArray(categories.tenantId, [tenantA.id, tenantB.id]));
  await db
    .delete(customers)
    .where(inArray(customers.tenantId, [tenantA.id, tenantB.id]));
  await db
    .delete(portalUsers)
    .where(inArray(portalUsers.tenantId, [tenantA.id, tenantB.id]));
  await db.delete(user).where(inArray(user.id, [userAId, userBId]));
  await db.delete(tenants).where(inArray(tenants.id, [tenantA.id, tenantB.id]));
});

// ── Helpers ────────────────────────────────────────────────────────────

/** Drive subsequent service calls "as if signed in to tenantA". */
function asTenantA() {
  setCtx({
    authUserId: userAId,
    sessionTenantId: tenantA.id,
    hostTenantSlug: tenantA.slug,
  });
}

/** Drive subsequent service calls "as if signed in to tenantB". */
function asTenantB() {
  setCtx({
    authUserId: userBId,
    sessionTenantId: tenantB.id,
    hostTenantSlug: tenantB.slug,
  });
}

// ── Probes ─────────────────────────────────────────────────────────────

test("baseline: tenant A reads its own customer", async () => {
  asTenantA();
  const row = await getCustomerById(customerAId);
  assert.ok(row, "tenant A should see its own customer");
  assert.equal(row?.id, customerAId);
});

test("read denial: tenant B can't fetch tenant A's customer by id", async () => {
  asTenantB();
  const row = await getCustomerById(customerAId);
  assert.equal(
    row,
    null,
    "cross-tenant read must return null, not throw or leak",
  );
});

test("list denial: tenant B's customers list does not include tenant A's row", async () => {
  asTenantB();
  const rows = await getCustomers();
  const ids = rows.map(r => r.id);
  assert.ok(
    !ids.includes(customerAId),
    "tenant B must not see tenant A's customer in the list",
  );
});

test("write denial: tenant B can't update tenant A's customer", async () => {
  asTenantB();
  await assert.rejects(
    updateCustomer({ id: customerAId, name: "pwned" }),
    /Customer not found/,
    "cross-tenant update must throw rather than silently mutate",
  );
  // Confirm the row really did not change.
  asTenantA();
  const row = await getCustomerById(customerAId);
  assert.equal(
    row?.name,
    "Acme Foods (owned by A)",
    "the original name must be intact",
  );
});

test("second-domain read denial: tenant B can't fetch tenant A's category", async () => {
  asTenantB();
  const row = await getCategoryById(categoryAId);
  assert.equal(row, null);
});

test("second-domain list denial: tenant B's categories list is empty", async () => {
  asTenantB();
  const rows = await getCategories();
  assert.equal(
    rows.length,
    0,
    "tenant B has no categories of its own and must not see A's",
  );
});

test("auth boundary: session.tenantId mismatch with host tenant throws", async () => {
  // The session row claims tenant B, but the request host classifies
  // into tenant A — exactly the "stolen cookie pivoted to another
  // tenant" attack vector that `getCurrentTenant` defends against.
  setCtx({
    authUserId: userBId,
    sessionTenantId: tenantB.id,
    hostTenantSlug: tenantA.slug,
  });
  await assert.rejects(
    getCurrentTenant(),
    /Tenant session mismatch/,
    "session/host tenant mismatch must throw, not silently resolve",
  );
});
