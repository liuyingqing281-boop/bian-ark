-- M4–M7：《11-建馆向导与我的板块方案》R5 配套迁移
-- 通知中心 + 帮助反馈 + 用户设置 + 纪念馆软删

-- M4 通知中心
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'system', -- review | collab | system
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read);

-- M5 帮助与反馈
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- M6 用户设置（通知/隐私开关 JSON 串）
-- @add-column users settings TEXT DEFAULT '{}'

-- M7 纪念馆软删标记（空串 = 未删除）
-- @add-column memorials deleted_at TEXT DEFAULT ''
