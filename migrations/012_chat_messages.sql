CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, memorial_id TEXT NOT NULL, user_id TEXT, role TEXT NOT NULL CHECK (role IN ('user', 'ta')), content TEXT NOT NULL, evidence_memory_id TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_chat_messages_memorial_created ON chat_messages(memorial_id, created_at);
