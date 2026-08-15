CREATE TABLE IF NOT EXISTS auth_oauth_states (
  state TEXT PRIMARY KEY,
  user_id TEXT DEFAULT '',
  provider TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memorial_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memorial_id TEXT NOT NULL,
  actor_user_id TEXT DEFAULT '',
  action TEXT NOT NULL,
  detail TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_memorial_audit_memorial ON memorial_audit_logs(memorial_id, created_at);

-- @add-column media is_cover INTEGER DEFAULT 0
-- @add-column media review_reason TEXT DEFAULT ''
-- @add-column media reviewed_by TEXT DEFAULT ''
-- @add-column media reviewed_at TEXT DEFAULT ''
-- @add-column items review_reason TEXT DEFAULT ''
-- @add-column items reviewed_by TEXT DEFAULT ''
-- @add-column items reviewed_at TEXT DEFAULT ''
-- @add-column digital_humans review_reason TEXT DEFAULT ''
-- @add-column digital_humans reviewed_by TEXT DEFAULT ''
-- @add-column digital_humans reviewed_at TEXT DEFAULT ''

CREATE TABLE IF NOT EXISTS moderation_appeals (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  admin_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'cny',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_events (
  provider_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  processed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS membership_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  source TEXT NOT NULL,
  expires_at TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_task_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  prompt TEXT NOT NULL,
  candidates TEXT DEFAULT '[]',
  error TEXT DEFAULT '',
  duration_ms INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS data_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  admin_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT DEFAULT ''
);
