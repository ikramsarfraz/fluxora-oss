-- bank_transactions: inferred payment method, check number, mystery outflow
ALTER TABLE bank_transactions
  ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'other',
  ADD COLUMN check_number INTEGER,
  ADD COLUMN is_mystery_outflow BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN mystery_dismissed_at TIMESTAMPTZ;

CREATE INDEX bank_transactions_mystery_idx
  ON bank_transactions (tenant_id, is_mystery_outflow)
  WHERE is_mystery_outflow = TRUE;

-- payee_aliases: channel-scoped matching
ALTER TABLE payee_aliases
  ADD COLUMN channel VARCHAR(20) NOT NULL DEFAULT 'ach';

DROP INDEX payee_aliases_tenant_normalized_unique;

CREATE UNIQUE INDEX payee_aliases_tenant_channel_normalized_unique
  ON payee_aliases (tenant_id, channel, normalized_text);
