-- =============================================================================
-- Fully and safely delete a tenant and all its data.
--
-- Usage (psql):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v tenant_id="'00000000-0000-0000-0000-000000000000'" -f scripts/delete-tenant.sql
--
-- The script:
--   * Runs in a single transaction — nothing is committed if any step fails.
--   * Aborts up front if the tenant does not exist.
--   * Deletes leaf rows first, then parents, then the tenant row itself.
--     Most tenant-scoped FKs are ON DELETE RESTRICT, so order matters.
--   * Does NOT delete global tables (user, account, verification, platform_users,
--     stripe_products, stripe_prices, stripe_webhook_events, plaid_webhook_seen,
--     units_of_measure). Global users keep their identity; only their portal_users
--     membership for this tenant is removed.
--   * Does NOT touch external object storage. The `files` table for this tenant
--     is captured into a temp table at the top so you can read its rows back
--     before COMMIT (see "OBJECT STORAGE CLEANUP" note near the end) and use the
--     `bucket` / `object_key` to delete blobs from R2/S3 separately.
--
-- To dry-run: replace the final `COMMIT;` with `ROLLBACK;` and inspect the
-- output of the verification SELECTs at the bottom.
-- =============================================================================

\if :{?tenant_id}
\else
  \echo 'ERROR: tenant_id is not set. Pass with -v tenant_id="''<uuid>''"'
  \quit
\endif

BEGIN;

-- Lock the tenant row so concurrent writes can't add new data underneath us.
-- Abort if it doesn't exist.
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM tenants WHERE id = :'tenant_id'::uuid FOR UPDATE;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Tenant % does not exist; aborting.', :'tenant_id';
  END IF;
END $$;

-- Capture file storage references for out-of-band blob cleanup.
-- This temp table is dropped at COMMIT but you can SELECT from it before then.
CREATE TEMP TABLE _tenant_files_to_purge ON COMMIT DROP AS
SELECT id, bucket, object_key FROM files WHERE tenant_id = :'tenant_id'::uuid;

\echo 'Files queued for object-storage purge:'
SELECT count(*) AS file_count FROM _tenant_files_to_purge;

-- -----------------------------------------------------------------------------
-- 1. Junction / leaf attachment tables (cascade-safe but deleted explicitly
--    so the script is self-documenting and survives schema drift).
-- -----------------------------------------------------------------------------

DELETE FROM support_ticket_attachments
 WHERE ticket_id IN (SELECT id FROM support_tickets WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM support_ticket_updates
 WHERE ticket_id IN (SELECT id FROM support_tickets WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM sales_invoice_files
 WHERE sales_invoice_id IN (SELECT id FROM sales_invoices WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM sales_invoice_lines
 WHERE sales_invoice_id IN (SELECT id FROM sales_invoices WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM sales_order_attachments
 WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM sales_order_fulfillments
 WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM sales_order_line_allocations
 WHERE sales_order_line_id IN (
   SELECT id FROM sales_order_lines
    WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = :'tenant_id'::uuid)
 );

DELETE FROM sales_order_lines
 WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM supplier_invoice_attachments
 WHERE supplier_invoice_id IN (SELECT id FROM supplier_invoices WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM supplier_invoice_charges
 WHERE supplier_invoice_id IN (SELECT id FROM supplier_invoices WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM supplier_invoice_payments  WHERE tenant_id = :'tenant_id'::uuid;

DELETE FROM supplier_invoice_lines
 WHERE supplier_invoice_id IN (SELECT id FROM supplier_invoices WHERE tenant_id = :'tenant_id'::uuid);

-- -----------------------------------------------------------------------------
-- 2. Banking / payments — must drop matches before transactions and invoices,
--    transactions/snapshots before bank_accounts, bank_accounts before
--    plaid_connections.
-- -----------------------------------------------------------------------------

DELETE FROM payment_matches              WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM bill_forwards                WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM payee_aliases                WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM bank_account_balance_snapshots WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM bank_transactions            WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM bank_accounts                WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM plaid_connections            WHERE tenant_id = :'tenant_id'::uuid;

-- -----------------------------------------------------------------------------
-- 3. Inventory / lots — adjustments and items (RESTRICT on lots & products)
--    before lot_receipts and the lots/products themselves.
-- -----------------------------------------------------------------------------

DELETE FROM inventory_adjustments        WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM lot_receipts
 WHERE lot_id IN (SELECT id FROM lots WHERE tenant_id = :'tenant_id'::uuid);
DELETE FROM inventory_items
 WHERE lot_id IN (SELECT id FROM lots WHERE tenant_id = :'tenant_id'::uuid);

-- -----------------------------------------------------------------------------
-- 4. Lot disposition (markdown_histories has set-null FKs to lots, but RESTRICT
--    on tenants — delete by tenant_id directly).
-- -----------------------------------------------------------------------------

DELETE FROM markdown_histories           WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM disposition_decisions        WHERE tenant_id = :'tenant_id'::uuid;

-- -----------------------------------------------------------------------------
-- 5. Money documents — payments and expenses before sales_invoices/orders.
-- -----------------------------------------------------------------------------

DELETE FROM payments                     WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM expenses                     WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM sales_invoices               WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM sales_orders                 WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM supplier_invoices            WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM lots                         WHERE tenant_id = :'tenant_id'::uuid;

-- -----------------------------------------------------------------------------
-- 6. Master data — products, categories, customers, suppliers, and their
--    cascading children (the cascades fire on delete; explicit child deletes
--    cover any rows the schema later changes to RESTRICT).
-- -----------------------------------------------------------------------------

DELETE FROM customer_product_prices
 WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = :'tenant_id'::uuid)
    OR product_id  IN (SELECT id FROM products  WHERE tenant_id = :'tenant_id'::uuid)
    OR supplier_id IN (SELECT id FROM suppliers WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM product_supplier_costs
 WHERE product_id  IN (SELECT id FROM products  WHERE tenant_id = :'tenant_id'::uuid)
    OR supplier_id IN (SELECT id FROM suppliers WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM product_units
 WHERE product_id IN (SELECT id FROM products WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM product_categories
 WHERE product_id  IN (SELECT id FROM products   WHERE tenant_id = :'tenant_id'::uuid)
    OR category_id IN (SELECT id FROM categories WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM customer_addresses
 WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = :'tenant_id'::uuid);

DELETE FROM supplier_product_aliases     WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM supplier_import_profiles     WHERE tenant_id = :'tenant_id'::uuid;

DELETE FROM products                     WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM categories                   WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM customers                    WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM suppliers                    WHERE tenant_id = :'tenant_id'::uuid;

-- -----------------------------------------------------------------------------
-- 7. Support, invitations, branding, features, audit.
-- -----------------------------------------------------------------------------

DELETE FROM support_tickets              WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM user_invitations             WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM tenant_join_requests         WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM tenant_branding              WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM tenant_features              WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM audit_logs                   WHERE tenant_id = :'tenant_id'::uuid;
DELETE FROM audit_log                    WHERE tenant_id = :'tenant_id'::uuid;

-- -----------------------------------------------------------------------------
-- 8. Auth — invalidate sessions scoped to this tenant, then drop memberships.
--    The global `user`, `account`, and `verification` rows are intentionally
--    preserved so those identities can still belong to other tenants.
-- -----------------------------------------------------------------------------

DELETE FROM session                      WHERE tenant_id = :'tenant_id';
DELETE FROM portal_users                 WHERE tenant_id = :'tenant_id'::uuid;

-- -----------------------------------------------------------------------------
-- 9. Files (cascades to any remaining attachment rows). Run last so anything
--    upstream that referenced a file_id has already gone.
-- -----------------------------------------------------------------------------

DELETE FROM files                        WHERE tenant_id = :'tenant_id'::uuid;

-- -----------------------------------------------------------------------------
-- 10. The tenant row itself.
-- -----------------------------------------------------------------------------

DELETE FROM tenants                      WHERE id = :'tenant_id'::uuid;

-- -----------------------------------------------------------------------------
-- Verification — every count below MUST be 0 before we commit.
-- -----------------------------------------------------------------------------

\echo 'Post-delete row counts (all should be 0):'
SELECT 'tenants'                  AS table_name, count(*) FROM tenants                  WHERE id = :'tenant_id'::uuid
UNION ALL SELECT 'portal_users',              count(*) FROM portal_users              WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'user_invitations',          count(*) FROM user_invitations          WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'tenant_join_requests',      count(*) FROM tenant_join_requests      WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'tenant_branding',           count(*) FROM tenant_branding           WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'tenant_features',           count(*) FROM tenant_features           WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'files',                     count(*) FROM files                     WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'customers',                 count(*) FROM customers                 WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'suppliers',                 count(*) FROM suppliers                 WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'products',                  count(*) FROM products                  WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'categories',                count(*) FROM categories                WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'lots',                      count(*) FROM lots                      WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'supplier_invoices',         count(*) FROM supplier_invoices         WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'supplier_invoice_payments', count(*) FROM supplier_invoice_payments WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'sales_orders',              count(*) FROM sales_orders              WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'sales_invoices',            count(*) FROM sales_invoices            WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'payments',                  count(*) FROM payments                  WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'expenses',                  count(*) FROM expenses                  WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'inventory_adjustments',     count(*) FROM inventory_adjustments     WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'support_tickets',           count(*) FROM support_tickets           WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'plaid_connections',         count(*) FROM plaid_connections         WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'bank_accounts',             count(*) FROM bank_accounts             WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'bank_transactions',         count(*) FROM bank_transactions         WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'payment_matches',           count(*) FROM payment_matches           WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'payee_aliases',             count(*) FROM payee_aliases             WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'bill_forwards',             count(*) FROM bill_forwards             WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'disposition_decisions',     count(*) FROM disposition_decisions     WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'markdown_histories',        count(*) FROM markdown_histories        WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'supplier_import_profiles',  count(*) FROM supplier_import_profiles  WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'supplier_product_aliases',  count(*) FROM supplier_product_aliases  WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'audit_logs',                count(*) FROM audit_logs                WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'audit_log',                 count(*) FROM audit_log                 WHERE tenant_id = :'tenant_id'::uuid
UNION ALL SELECT 'session',                   count(*) FROM session                   WHERE tenant_id = :'tenant_id';

-- -----------------------------------------------------------------------------
-- OBJECT STORAGE CLEANUP
-- Before COMMIT (or after, from another session if you held onto the rows),
-- iterate over `_tenant_files_to_purge` to delete the actual blobs from R2/S3.
-- Example to dump them as JSON for a downstream worker:
--   COPY (SELECT row_to_json(t) FROM _tenant_files_to_purge t)
--     TO '/tmp/tenant-files-to-purge.json';
-- -----------------------------------------------------------------------------

COMMIT;
