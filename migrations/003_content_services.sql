-- @add-column memorials visibility TEXT DEFAULT 'public'
-- @add-column memorials in_garden INTEGER DEFAULT 0
-- @add-column memorials garden_section TEXT DEFAULT ''
-- @add-column memorials garden_slot INTEGER DEFAULT 0
-- @add-column items image_url TEXT DEFAULT ''
-- @add-column items style TEXT DEFAULT 'emoji'
-- @add-column items owner_user_id TEXT DEFAULT ''
-- @add-column items source TEXT DEFAULT 'official'
-- @add-column items prompt TEXT DEFAULT ''
-- @add-column items review_status TEXT DEFAULT 'approved'

CREATE TABLE IF NOT EXISTS ai_quotas (
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  thumb_url TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  review_status TEXT DEFAULT 'approved',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS life_events (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  meta TEXT DEFAULT '{}',
  user_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(type, created_at);

CREATE TABLE IF NOT EXISTS dh_redo_credits (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  stripe_session_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS digital_humans (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  photo_url TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  script TEXT DEFAULT '',
  result_video_url TEXT DEFAULT '',
  provider TEXT DEFAULT '',
  provider_job_id TEXT DEFAULT '',
  error TEXT DEFAULT '',
  consent_accepted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
