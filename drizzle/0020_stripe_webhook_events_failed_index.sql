-- Debug failed deliveries: ORDER BY processed_at DESC WHERE processing_status = 'failed'.
CREATE INDEX "stripe_webhook_events_failed_processed_at_idx" ON "stripe_webhook_events" USING btree ("processed_at" DESC) WHERE processing_status = 'failed';
