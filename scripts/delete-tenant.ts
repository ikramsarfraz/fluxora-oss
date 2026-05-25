/**
 * Tenant-deletion runner. Mirrors scripts/delete-tenant.sql but runs via
 * node-postgres so it works without a local `psql` install. All deletes run
 * inside a single transaction; any failure rolls everything back.
 *
 * Usage:
 *   node --import tsx scripts/delete-tenant.ts <tenant-uuid> [--dry-run]
 */
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { resolveDatabaseUrlForApp, resolvePgSslConfig } from "@/db/database-url";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const TENANT_ID = process.argv[2];
const DRY_RUN = process.argv.includes("--dry-run");
if (!TENANT_ID || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(TENANT_ID)) {
  console.error("usage: tsx scripts/delete-tenant.ts <tenant-uuid> [--dry-run]");
  process.exit(2);
}

// Mirrors the order in scripts/delete-tenant.sql section-for-section.
// Each entry: [label, SQL]. `$1` = tenant id (uuid; text on `session`).
const STEPS: Array<[string, string]> = [
  // 1. Junction / leaf attachment tables
  ["support_ticket_attachments",   `DELETE FROM support_ticket_attachments WHERE ticket_id IN (SELECT id FROM support_tickets WHERE tenant_id = $1)`],
  ["support_ticket_updates",       `DELETE FROM support_ticket_updates     WHERE ticket_id IN (SELECT id FROM support_tickets WHERE tenant_id = $1)`],
  ["sales_invoice_files",          `DELETE FROM sales_invoice_files        WHERE sales_invoice_id IN (SELECT id FROM sales_invoices WHERE tenant_id = $1)`],
  ["sales_invoice_lines",          `DELETE FROM sales_invoice_lines        WHERE sales_invoice_id IN (SELECT id FROM sales_invoices WHERE tenant_id = $1)`],
  ["sales_order_attachments",      `DELETE FROM sales_order_attachments    WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = $1)`],
  ["sales_order_fulfillments",     `DELETE FROM sales_order_fulfillments   WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = $1)`],
  ["sales_order_line_allocations", `DELETE FROM sales_order_line_allocations WHERE sales_order_line_id IN (SELECT id FROM sales_order_lines WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = $1))`],
  ["sales_order_lines",            `DELETE FROM sales_order_lines          WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = $1)`],
  ["supplier_invoice_attachments", `DELETE FROM supplier_invoice_attachments WHERE supplier_invoice_id IN (SELECT id FROM supplier_invoices WHERE tenant_id = $1)`],
  ["supplier_invoice_charges",     `DELETE FROM supplier_invoice_charges   WHERE supplier_invoice_id IN (SELECT id FROM supplier_invoices WHERE tenant_id = $1)`],
  ["supplier_invoice_payments",    `DELETE FROM supplier_invoice_payments  WHERE tenant_id = $1`],
  ["supplier_invoice_lines",       `DELETE FROM supplier_invoice_lines     WHERE supplier_invoice_id IN (SELECT id FROM supplier_invoices WHERE tenant_id = $1)`],

  // 2. Banking / payments
  ["payment_matches",              `DELETE FROM payment_matches            WHERE tenant_id = $1`],
  ["bill_forwards",                `DELETE FROM bill_forwards              WHERE tenant_id = $1`],
  ["payee_aliases",                `DELETE FROM payee_aliases              WHERE tenant_id = $1`],
  ["bank_account_balance_snapshots", `DELETE FROM bank_account_balance_snapshots WHERE tenant_id = $1`],
  ["bank_transactions",            `DELETE FROM bank_transactions          WHERE tenant_id = $1`],
  ["bank_accounts",                `DELETE FROM bank_accounts              WHERE tenant_id = $1`],
  ["plaid_connections",            `DELETE FROM plaid_connections          WHERE tenant_id = $1`],

  // 3. Inventory / lots
  ["inventory_adjustments",        `DELETE FROM inventory_adjustments      WHERE tenant_id = $1`],
  ["lot_receipts",                 `DELETE FROM lot_receipts               WHERE lot_id IN (SELECT id FROM lots WHERE tenant_id = $1)`],
  ["inventory_items",              `DELETE FROM inventory_items            WHERE lot_id IN (SELECT id FROM lots WHERE tenant_id = $1)`],

  // 4. Lot disposition
  ["markdown_histories",           `DELETE FROM markdown_histories         WHERE tenant_id = $1`],
  ["disposition_decisions",        `DELETE FROM disposition_decisions      WHERE tenant_id = $1`],

  // 5. Money documents
  ["payments",                     `DELETE FROM payments                   WHERE tenant_id = $1`],
  ["expenses",                     `DELETE FROM expenses                   WHERE tenant_id = $1`],
  ["sales_invoices",               `DELETE FROM sales_invoices             WHERE tenant_id = $1`],
  ["sales_orders",                 `DELETE FROM sales_orders               WHERE tenant_id = $1`],
  ["supplier_invoices",            `DELETE FROM supplier_invoices          WHERE tenant_id = $1`],
  ["lots",                         `DELETE FROM lots                       WHERE tenant_id = $1`],

  // 6. Master data
  ["customer_product_prices",      `DELETE FROM customer_product_prices    WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = $1) OR product_id IN (SELECT id FROM products WHERE tenant_id = $1) OR supplier_id IN (SELECT id FROM suppliers WHERE tenant_id = $1)`],
  ["product_supplier_costs",       `DELETE FROM product_supplier_costs     WHERE product_id IN (SELECT id FROM products WHERE tenant_id = $1) OR supplier_id IN (SELECT id FROM suppliers WHERE tenant_id = $1)`],
  ["product_units",                `DELETE FROM product_units              WHERE product_id IN (SELECT id FROM products WHERE tenant_id = $1)`],
  ["product_categories",           `DELETE FROM product_categories         WHERE product_id IN (SELECT id FROM products WHERE tenant_id = $1) OR category_id IN (SELECT id FROM categories WHERE tenant_id = $1)`],
  ["customer_addresses",           `DELETE FROM customer_addresses         WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = $1)`],
  ["supplier_product_aliases",     `DELETE FROM supplier_product_aliases   WHERE tenant_id = $1`],
  ["supplier_import_profiles",     `DELETE FROM supplier_import_profiles   WHERE tenant_id = $1`],
  ["products",                     `DELETE FROM products                   WHERE tenant_id = $1`],
  ["categories",                   `DELETE FROM categories                 WHERE tenant_id = $1`],
  ["customers",                    `DELETE FROM customers                  WHERE tenant_id = $1`],
  ["suppliers",                    `DELETE FROM suppliers                  WHERE tenant_id = $1`],

  // 7. Support, invitations, branding, features, audit
  ["support_tickets",              `DELETE FROM support_tickets            WHERE tenant_id = $1`],
  ["user_invitations",             `DELETE FROM user_invitations           WHERE tenant_id = $1`],
  ["tenant_join_requests",         `DELETE FROM tenant_join_requests       WHERE tenant_id = $1`],
  ["tenant_branding",              `DELETE FROM tenant_branding            WHERE tenant_id = $1`],
  ["tenant_features",              `DELETE FROM tenant_features            WHERE tenant_id = $1`],
  ["audit_logs",                   `DELETE FROM audit_logs                 WHERE tenant_id = $1`],
  ["audit_log",                    `DELETE FROM audit_log                  WHERE tenant_id = $1`],

  // 8. Auth — sessions and memberships
  ["session",                      `DELETE FROM session                    WHERE tenant_id = $1`],
  ["portal_users",                 `DELETE FROM portal_users               WHERE tenant_id = $1`],

  // 9. Files
  ["files",                        `DELETE FROM files                      WHERE tenant_id = $1`],

  // 10. The tenant row
  ["tenants",                      `DELETE FROM tenants                    WHERE id = $1`],
];

async function main() {
  const url = resolveDatabaseUrlForApp();
  const pool = new pg.Pool({ connectionString: url, ssl: resolvePgSslConfig(url), max: 2 });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      "SELECT id, name, slug FROM tenants WHERE id = $1 FOR UPDATE",
      [TENANT_ID],
    );
    if (lookup.rowCount === 0) {
      throw new Error(`Tenant ${TENANT_ID} does not exist; aborting.`);
    }
    console.log(`Locked tenant: ${lookup.rows[0].name} (${lookup.rows[0].slug}) [${lookup.rows[0].id}]`);

    // Capture file references for downstream object-storage cleanup.
    const files = await client.query(
      "SELECT id, bucket, object_key FROM files WHERE tenant_id = $1",
      [TENANT_ID],
    );
    if (files.rowCount && files.rowCount > 0) {
      const out = `/tmp/tenant-${TENANT_ID}-files.json`;
      const fs = await import("node:fs/promises");
      await fs.writeFile(out, JSON.stringify(files.rows, null, 2));
      console.log(`Captured ${files.rowCount} file refs → ${out} (purge from R2/S3 separately)`);
    } else {
      console.log("No files for this tenant; no object-storage cleanup needed.");
    }

    let total = 0;
    for (const [label, sql] of STEPS) {
      const r = await client.query(sql, [TENANT_ID]);
      const n = r.rowCount ?? 0;
      total += n;
      if (n > 0) console.log(`  - ${label}\t${n}`);
    }
    console.log(`Total rows deleted: ${total}`);

    if (DRY_RUN) {
      await client.query("ROLLBACK");
      console.log("\n[DRY RUN] Rolled back. No changes committed.");
    } else {
      await client.query("COMMIT");
      console.log("\nCommitted. Tenant deletion complete.");
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
