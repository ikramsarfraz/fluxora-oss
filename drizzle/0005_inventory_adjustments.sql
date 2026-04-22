CREATE TYPE "public"."inventory_adjustment_type" AS ENUM('status_change', 'correction', 'bulk_lot_action');

CREATE TABLE "inventory_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "inventory_item_id" uuid NOT NULL,
  "lot_id" uuid,
  "adjustment_type" "inventory_adjustment_type" DEFAULT 'status_change' NOT NULL,
  "reason" varchar(128) NOT NULL,
  "notes" text,
  "status_before" "inventory_item_status",
  "status_after" "inventory_item_status",
  "cases_before" integer,
  "cases_after" integer,
  "weight_lbs_before" numeric(10, 4),
  "weight_lbs_after" numeric(10, 4),
  "created_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_inventory_item_id_inventory_items_id_fk"
  FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_lot_id_lots_id_fk"
  FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_created_by_user_id_portal_users_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "public"."portal_users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "inventory_adjustments_tenant_id_idx" ON "inventory_adjustments" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "inventory_adjustments_inventory_item_id_idx" ON "inventory_adjustments" USING btree ("inventory_item_id");
--> statement-breakpoint
CREATE INDEX "inventory_adjustments_lot_id_idx" ON "inventory_adjustments" USING btree ("lot_id");
--> statement-breakpoint
CREATE INDEX "inventory_adjustments_created_at_idx" ON "inventory_adjustments" USING btree ("created_at");
