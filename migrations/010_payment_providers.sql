-- @add-column orders provider_order_id TEXT DEFAULT ''
-- @add-column orders payment_method TEXT DEFAULT ''
CREATE TABLE IF NOT EXISTS payment_order_meta (
  order_id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider ON payment_events(provider_event_id);
