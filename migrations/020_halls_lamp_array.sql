-- 020 馆内多人合馆「长明灯阵」—— docs/13 §7
-- halls：馆级实体；memorials 语义 = 馆内人物（一行一位逝者）

CREATE TABLE IF NOT EXISTS halls (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  motto TEXT NOT NULL DEFAULT '',          -- 馆训
  skin TEXT NOT NULL DEFAULT 'lanterns',   -- lanterns 灯阵（默认）| ancestral 祠堂牌位墙（备选）
  visibility TEXT NOT NULL DEFAULT 'public',
  owner_user_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- @add-column memorials hall_id TEXT DEFAULT ''
-- @add-column memorials lamp_x REAL
-- @add-column memorials lamp_y REAL

-- 存量回填：每个 memorials 行生成同名 halls 行（一馆一人特例，对外行为不变）
INSERT OR IGNORE INTO halls (id, name, visibility, owner_user_id)
SELECT 'hall_' || id, name, COALESCE(NULLIF(visibility, ''), 'public'), user_id FROM memorials;
UPDATE memorials SET hall_id = 'hall_' || id WHERE hall_id = '';
