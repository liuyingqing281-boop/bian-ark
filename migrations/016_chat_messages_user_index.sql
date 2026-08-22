-- M2: 对话历史按本人查询的索引（GET/DELETE /api/hall/chat/history）
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(memorial_id, user_id, created_at);
