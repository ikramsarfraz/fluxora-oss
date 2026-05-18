import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { resolveDatabaseUrlForApp, resolvePgSslConfig } from "@/db/database-url";
import { auditLogs, tenants } from "@/db/schema";
import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";
import {
  diffSubscriptionKeys,
  subscriptionSnapshotFromRow,
} from "@/lib/tenant-subscription-audit";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const VALID_PLANS = ["free", "starter", "growth", "enterprise"] as const;
const VALID_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "comped",
] as const;

const tenantArg = process.argv[2];
const planArg = (process.argv[3] ?? "enterprise") as TenantSubscriptionPlan;
const statusArg = (process.argv[4] ?? "comped") as TenantSubscriptionStatus;

if (!tenantArg) {
  console.error(
    "usage: tsx scripts/upgrade-tenant-plan.ts <tenant-uuid-or-slug> [plan=enterprise] [status=comped]",
  );
  console.error(`  plan   ∈ ${VALID_PLANS.join(" | ")}`);
  console.error(`  status ∈ ${VALID_STATUSES.join(" | ")}`);
  process.exit(2);
}

if (!VALID_PLANS.includes(planArg)) {
  console.error(`invalid plan: ${planArg}`);
  process.exit(2);
}
if (!VALID_STATUSES.includes(statusArg)) {
  console.error(`invalid status: ${statusArg}`);
  process.exit(2);
}

async function main() {
  const url = resolveDatabaseUrlForApp();
  const pool = new pg.Pool({
    connectionString: url,
    ssl: resolvePgSslConfig(url),
    max: 2,
  });
  const db = drizzle(pool, { schema: { tenants, auditLogs } });

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    tenantArg,
  );

  const tenant = await db.query.tenants.findFirst({
    where: isUuid ? eq(tenants.id, tenantArg) : eq(tenants.slug, tenantArg),
  });

  if (!tenant) {
    console.error(`tenant not found: ${tenantArg}`);
    await pool.end();
    process.exit(1);
  }

  const beforeSnap = subscriptionSnapshotFromRow(tenant);

  await db.transaction(async tx => {
    const [updated] = await tx
      .update(tenants)
      .set({
        subscriptionPlan: planArg,
        subscriptionStatus: statusArg,
        trialEndsAt: null,
        currentPeriodEndsAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.id))
      .returning();

    if (!updated) throw new Error("update returned no row");

    const afterSnap = subscriptionSnapshotFromRow(updated);
    const changed = diffSubscriptionKeys(beforeSnap, afterSnap);

    if (changed.length > 0) {
      await tx.insert(auditLogs).values({
        tenantId: updated.id,
        actorType: "system",
        action: "update",
        entityTable: "tenants",
        entityId: updated.id,
        entityLabel: updated.name,
        changedFieldsJson: JSON.stringify(changed),
        beforeJson: JSON.stringify(beforeSnap),
        afterJson: JSON.stringify(afterSnap),
        contextJson: JSON.stringify({
          action: "update_tenant_subscription",
          source: "scripts/upgrade-tenant-plan.ts",
        }),
      });
    }

    console.log(
      `upgraded ${updated.name} (${updated.slug}) → plan=${updated.subscriptionPlan} status=${updated.subscriptionStatus}`,
    );
  });

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
