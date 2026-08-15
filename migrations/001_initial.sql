CREATE TABLE IF NOT EXISTS memorials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'person',
  avatar_url TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  birth_date TEXT DEFAULT '',
  death_date TEXT DEFAULT '',
  epitaph TEXT DEFAULT '',
  biography TEXT DEFAULT '',
  is_featured INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  user_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'flower',
  icon TEXT DEFAULT '',
  price_cents INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tributes (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  item_id TEXT DEFAULT '',
  message TEXT DEFAULT '',
  sender_name TEXT DEFAULT 'Anonymous',
  is_burning INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (memorial_id) REFERENCES memorials(id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT DEFAULT '',
  membership_tier TEXT DEFAULT 'free',
  membership_expires_at TEXT DEFAULT '',
  stripe_customer_id TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customizations (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (memorial_id) REFERENCES memorials(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
