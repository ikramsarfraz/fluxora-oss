-- Round out the customer record with two long-asked-for fields:
--
--   notes        — free-text memo, visible only to the workspace. Lives
--                  alongside name/email/phone for per-customer reminders
--                  ("delivery only at the back dock", "ask for Maria",
--                  "card on file expires 12/26", etc.). Mirrors the
--                  suppliers.notes column.
--
--   credit_limit — soft AR cap. Display-only for v1: the detail page
--                  and the new-order form show current balance vs.
--                  this number so ops can see when a customer is at
--                  risk of going over before the order goes out. No
--                  hard enforcement yet — we'll wire that into the
--                  order-submit path once the workflow is settled.
--
-- Both additive; no backfill needed.

ALTER TABLE "customers"
  ADD COLUMN "notes" text,
  ADD COLUMN "credit_limit" numeric(12, 2);
