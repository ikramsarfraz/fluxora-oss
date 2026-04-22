ALTER TABLE "sales_order_lines"
ADD COLUMN "short_shipped_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sales_order_lines"
ADD COLUMN "short_shipped_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "sales_order_lines"
ADD COLUMN "short_ship_notes" text;
--> statement-breakpoint
ALTER TABLE "sales_order_lines"
ADD CONSTRAINT "sales_order_lines_short_shipped_by_user_id_portal_users_id_fk"
FOREIGN KEY ("short_shipped_by_user_id") REFERENCES "public"."portal_users"("id")
ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sales_order_lines_short_shipped_at_idx"
ON "sales_order_lines" USING btree ("short_shipped_at");
--> statement-breakpoint
CREATE INDEX "sales_order_lines_short_shipped_by_user_id_idx"
ON "sales_order_lines" USING btree ("short_shipped_by_user_id");
