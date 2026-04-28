DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_subscription_plan') THEN
    CREATE TYPE tenant_subscription_plan AS ENUM ('free', 'starter', 'growth', 'enterprise');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_subscription_status') THEN
    CREATE TYPE tenant_subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'comped');
  END IF;
END $$;

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscription_plan" tenant_subscription_plan NOT NULL DEFAULT 'free';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscription_status" tenant_subscription_status NOT NULL DEFAULT 'active';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "current_period_ends_at" timestamp with time zone;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripe_customer_id" character varying(255);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" character varying(255);

CREATE INDEX IF NOT EXISTS "tenants_subscription_status_idx" ON "tenants" ("subscription_status");
CREATE INDEX IF NOT EXISTS "tenants_subscription_plan_idx" ON "tenants" ("subscription_plan");
