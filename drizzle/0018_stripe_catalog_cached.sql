CREATE TABLE "stripe_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_product_id" varchar(255) NOT NULL,
	"name" varchar(512) NOT NULL,
	"description" text,
	"active" boolean NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stripe_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_products_stripe_product_id_unique" ON "stripe_products" USING btree ("stripe_product_id");
--> statement-breakpoint
CREATE INDEX "stripe_products_active_idx" ON "stripe_products" USING btree ("active");
--> statement-breakpoint
CREATE TABLE "stripe_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_price_id" varchar(255) NOT NULL,
	"stripe_product_id" varchar(255) NOT NULL,
	"lookup_key" varchar(255),
	"billing_plan_key" varchar(32),
	"currency" varchar(16) NOT NULL,
	"unit_amount" integer,
	"recurring_interval" varchar(32),
	"recurring_interval_count" integer,
	"active" boolean NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stripe_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_prices_stripe_price_id_unique" ON "stripe_prices" USING btree ("stripe_price_id");
--> statement-breakpoint
CREATE INDEX "stripe_prices_stripe_product_id_idx" ON "stripe_prices" USING btree ("stripe_product_id");
--> statement-breakpoint
CREATE INDEX "stripe_prices_billing_plan_key_active_idx" ON "stripe_prices" USING btree ("billing_plan_key","active");
--> statement-breakpoint
ALTER TABLE "stripe_prices" ADD CONSTRAINT "stripe_prices_stripe_product_id_stripe_products_stripe_product_id_fk" FOREIGN KEY ("stripe_product_id") REFERENCES "public"."stripe_products"("stripe_product_id") ON DELETE cascade ON UPDATE no action;
