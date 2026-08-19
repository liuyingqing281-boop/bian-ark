CREATE TABLE IF NOT EXISTS prompt_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,                -- '2026-08-19'
  used INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
