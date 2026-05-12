-- plaid_webhook_seen: idempotency table for inbound Plaid webhooks.
-- Primary key is the SHA-256 hex digest of the Plaid-Verification JWT
-- (computed only after signature verification), so attacker spam can never
-- bloat this table.

CREATE TABLE plaid_webhook_seen (
  webhook_id VARCHAR(64) PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX plaid_webhook_seen_received_at_idx ON plaid_webhook_seen(received_at);
