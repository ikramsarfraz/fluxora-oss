ALTER TABLE "sales_order_fulfillments"
ADD COLUMN "reversed_at" timestamp with time zone;

ALTER TABLE "sales_order_fulfillments"
ADD COLUMN "reversed_by_user_id" uuid;

ALTER TABLE "sales_order_fulfillments"
ADD COLUMN "reversal_reason" text;

DO $$ BEGIN
 ALTER TABLE "sales_order_fulfillments"
 ADD CONSTRAINT "sales_order_fulfillments_reversed_by_user_id_portal_users_id_fk"
 FOREIGN KEY ("reversed_by_user_id") REFERENCES "public"."portal_users"("id")
 ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX "sales_order_fulfillments_reversed_at_idx"
ON "sales_order_fulfillments" USING btree ("reversed_at");

CREATE INDEX "sales_order_fulfillments_reversed_by_user_id_idx"
ON "sales_order_fulfillments" USING btree ("reversed_by_user_id");
