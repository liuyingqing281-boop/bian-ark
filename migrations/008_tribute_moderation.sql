-- @add-column tributes user_id TEXT DEFAULT ''
-- @add-column tributes review_status TEXT DEFAULT 'approved'
-- @add-column tributes review_reason TEXT DEFAULT ''
-- @add-column tributes reviewed_by TEXT DEFAULT ''
-- @add-column tributes reviewed_at TEXT DEFAULT ''
CREATE INDEX IF NOT EXISTS idx_tributes_memorial_review ON tributes(memorial_id, review_status, created_at);
