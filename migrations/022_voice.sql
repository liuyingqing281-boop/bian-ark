-- 022 语音能力（docs/09 B18 / M10，docs/14 语音方案，FR-13/14）
-- 角色音色档案（人物级）：''=未配置 / preset / design / clone
-- @add-column memorials voice_mode TEXT DEFAULT ''
-- @add-column memorials voice_handle TEXT DEFAULT ''
-- @add-column memorials voice_desc TEXT DEFAULT ''
-- @add-column memorials voice_updated_at TEXT DEFAULT ''
CREATE TABLE IF NOT EXISTS voice_clones (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sample_url TEXT NOT NULL,
  consent_accepted INTEGER NOT NULL DEFAULT 0,
  review_status TEXT DEFAULT 'pending',
  review_reason TEXT DEFAULT '',
  reviewed_by TEXT DEFAULT '',
  reviewed_at TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_voice_clones_memorial ON voice_clones (memorial_id, review_status);
