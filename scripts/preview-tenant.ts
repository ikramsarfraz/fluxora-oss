import { config as loadEnv } from "dotenv";
import pg from "pg";
import { resolveDatabaseUrlForApp, resolvePgSslConfig } from "@/db/database-url";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const TENANT_ID = process.argv[2];
if (!TENANT_ID) {
  console.error("usage: tsx scripts/preview-tenant.ts <tenant-uuid>");
  process.exit(2);
}

async function main() {
  const url = resolveDatabaseUrlForApp();
  const pool = new pg.Pool({ connectionString: url, ssl: resolvePgSslConfig(url), max: 2 });

  const tables = [
    "portal_users", "user_invitations", "tenant_join_requests", "tenant_branding", "tenant_features",
    "files", "customers", "suppliers", "products", "categories", "lots",
    "supplier_invoices", "supplier_invoice_payments", "sales_orders", "sales_invoices",
    "payments", "expenses", "inventory_adjustments", "support_tickets",
    "plaid_connections", "bank_accounts", "bank_transactions", "payment_matches",
    "payee_aliases", "bill_forwards", "disposition_decisions", "markdown_histories",
    "supplier_import_profiles", "supplier_product_aliases", "audit_logs", "audit_log",
  ];

  const t = await pool.query(
    "SELECT id, name, slug, tenant_type, is_active, created_at, subscription_plan, subscription_status FROM tenants WHERE id = $1",
    [TENANT_ID],
  );
  console.log("=== Tenant row ===");
  console.log(t.rows[0] ?? "(NOT FOUND)");

  if (!t.rows[0]) { await pool.end(); return; }

  const sessions = await pool.query("SELECT count(*)::int FROM session WHERE tenant_id = $1", [TENANT_ID]);
  console.log(`\n=== Row counts for tenant ${TENANT_ID} ===`);
  console.log(`session\t${sessions.rows[0].count}`);
  for (const tbl of tables) {
    const r = await pool.query(`SELECT count(*)::int FROM ${tbl} WHERE tenant_id = $1`, [TENANT_ID]);
    console.log(`${tbl}\t${r.rows[0].count}`);
  }
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
