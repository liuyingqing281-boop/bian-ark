CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unionid
  ON users(wechat_unionid) WHERE wechat_unionid IS NOT NULL AND wechat_unionid != '';

-- @add-column media object_key TEXT DEFAULT ''
-- @add-column media mime TEXT DEFAULT ''
-- @add-column media size_bytes INTEGER DEFAULT 0
-- @add-column media sha256 TEXT DEFAULT ''
-- @add-column digital_humans callback_payload TEXT DEFAULT '{}'
-- @add-column orders provider_payment_id TEXT DEFAULT ''
-- @add-column orders error TEXT DEFAULT ''
-- @add-column orders refunded_at TEXT DEFAULT ''

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_generation_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_data_requests_user_created ON data_requests(user_id, created_at);
