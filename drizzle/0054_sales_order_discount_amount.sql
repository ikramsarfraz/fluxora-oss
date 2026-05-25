-- Carry the per-order discount on the sales order itself so it survives
-- from new-order entry → invoice generation. The new-order UI has had a
-- discount input for a while, but the server never accepted it and the
-- value was silently dropped at submit. Storing it here means the same
-- amount the user typed flows through to the invoice via
-- `generateInvoiceForSalesOrder`.
--
-- Additive, defaults to 0 for existing rows. No backfill needed —
-- discounts on already-invoiced orders are already captured on the
-- invoice row, and pre-existing draft/confirmed orders never had a
-- discount value to preserve.

ALTER TABLE "sales_orders"
  ADD COLUMN "discount_amount" numeric(12, 2) NOT NULL DEFAULT '0';
