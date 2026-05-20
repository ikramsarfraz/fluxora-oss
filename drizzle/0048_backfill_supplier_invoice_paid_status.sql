-- Backfill supplier_invoices.status = "paid" for bills where the sum of
-- recorded payments already covers the total. Pre-fix, recordSupplierInvoicePayment
-- never updated the parent bill's status column — so bills that ops paid
-- in full sat stuck on "completed", and surfaces like the detail page's
-- "fully paid" banner, PDF download CTA, and Plaid-match button never
-- showed up.
--
-- This is a one-shot data fix. Going forward, record / update / void
-- explicitly flip status between "completed" and "paid" inside the
-- same transaction as the payment row write.

UPDATE "supplier_invoices"
SET "status" = 'paid', "updated_at" = NOW()
WHERE "status" = 'completed'
  AND "total_amount"::numeric > 0
  AND (
    SELECT COALESCE(SUM("amount"::numeric), 0)
    FROM "supplier_invoice_payments"
    WHERE "supplier_invoice_id" = "supplier_invoices"."id"
  ) >= "total_amount"::numeric - 0.005;
