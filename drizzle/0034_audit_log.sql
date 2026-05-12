-- audit_log: append-only record of destructive / sensitive tenant actions.

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL,
  actor_email TEXT,
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_log_tenant_idx
  ON audit_log (tenant_id, occurred_at DESC);
CREATE INDEX audit_log_actor_idx
  ON audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX audit_log_resource_idx
  ON audit_log (resource_type, resource_id);
CREATE INDEX audit_log_action_idx
  ON audit_log (tenant_id, action, occurred_at DESC);

-- Append-only enforcement at the DB layer. Revoking from PUBLIC blocks any
-- role that hasn't been explicitly granted UPDATE/DELETE (i.e., every role
-- in normal operation). The app role typically owns the table on Neon/
-- Supabase, in which case the owner still implicitly retains all rights;
-- the REVOKE protects against accidental writes via psql or a less-
-- privileged role.
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
