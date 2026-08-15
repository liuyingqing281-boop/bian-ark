-- @add-column users phone TEXT
-- @add-column users wechat_openid TEXT
-- @add-column users wechat_unionid TEXT
-- @add-column users avatar_url TEXT DEFAULT ''

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone) WHERE phone IS NOT NULL AND phone != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_openid
  ON users(wechat_openid) WHERE wechat_openid IS NOT NULL AND wechat_openid != '';

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_codes (
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS memorial_groups (
  memorial_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  PRIMARY KEY (memorial_id, group_id)
);
