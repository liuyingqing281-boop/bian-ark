-- 想念页消息（G3）：留言/悄悄话/悼文，服务端强制可见性
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT DEFAULT '',
  msg_type TEXT NOT NULL,
  content TEXT NOT NULL,
  review_status TEXT DEFAULT 'approved',
  review_reason TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_memorial_type ON messages(memorial_id, msg_type, created_at);
