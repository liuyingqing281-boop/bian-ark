-- 记忆档案（G1）：5 分区存储 + source 标记对话闭环补充
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT DEFAULT '',
  section TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT '',
  review_status TEXT DEFAULT 'approved',
  review_reason TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_memories_memorial_section ON memories(memorial_id, section, created_at);
