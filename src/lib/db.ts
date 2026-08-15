import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "bian.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
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
  `);

  // v2 (P1) column migrations; try/catch keeps them idempotent
  const columnAlters = [
    "ALTER TABLE users ADD COLUMN phone TEXT",
    "ALTER TABLE users ADD COLUMN wechat_openid TEXT",
    "ALTER TABLE users ADD COLUMN wechat_unionid TEXT",
    "ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''",
    // existing rows stay public; user-created rows set 'private' explicitly at insert
    "ALTER TABLE memorials ADD COLUMN visibility TEXT DEFAULT 'public'",
    // P2: custom / AI offerings
    "ALTER TABLE items ADD COLUMN image_url TEXT DEFAULT ''",
    "ALTER TABLE items ADD COLUMN style TEXT DEFAULT 'emoji'",
    "ALTER TABLE items ADD COLUMN owner_user_id TEXT DEFAULT ''",
    "ALTER TABLE items ADD COLUMN source TEXT DEFAULT 'official'",
    "ALTER TABLE items ADD COLUMN prompt TEXT DEFAULT ''",
    "ALTER TABLE items ADD COLUMN review_status TEXT DEFAULT 'approved'",
    // P3: public garden
    "ALTER TABLE memorials ADD COLUMN in_garden INTEGER DEFAULT 0",
    "ALTER TABLE memorials ADD COLUMN garden_section TEXT DEFAULT ''",
    "ALTER TABLE memorials ADD COLUMN garden_slot INTEGER DEFAULT 0",
  ];
  for (const sql of columnAlters) {
    try {
      db.exec(sql);
    } catch {
      // column already exists
    }
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone
      ON users(phone) WHERE phone IS NOT NULL AND phone != '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_openid
      ON users(wechat_openid) WHERE wechat_openid IS NOT NULL AND wechat_openid != '';

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      invite_code TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS memorial_groups (
      memorial_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      PRIMARY KEY (memorial_id, group_id)
    );

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
  `);

  // seed default items if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM items").get() as { c: number };
  if (count.c === 0) {
    seedItems(db);
  }
}

function seedItems(db: Database.Database) {
  const items = [
    { id: "flower_white", name: "白菊", category: "flower", icon: "🌸", price_cents: 0, is_premium: 0 },
    { id: "flower_rose", name: "玫瑰", category: "flower", icon: "🌹", price_cents: 0, is_premium: 0 },
    { id: "flower_lily", name: "百合", category: "flower", icon: "💐", price_cents: 0, is_premium: 0 },
    { id: "candle", name: "蜡烛", category: "light", icon: "🕯️", price_cents: 0, is_premium: 0 },
    { id: "incense", name: "香火", category: "ritual", icon: "🪔", price_cents: 0, is_premium: 0 },
    { id: "joss_paper", name: "纸钱", category: "ritual", icon: "💰", price_cents: 0, is_premium: 0 },
    { id: "fruit", name: "水果", category: "food", icon: "🍎", price_cents: 0, is_premium: 0 },
    { id: "wine", name: "酒", category: "food", icon: "🍶", price_cents: 0, is_premium: 0 },
    { id: "teddy", name: "玩具熊", category: "toy", icon: "🧸", price_cents: 0, is_premium: 0 },
    { id: "letter", name: "信", category: "message", icon: "💌", price_cents: 0, is_premium: 0 },
    { id: "premium_custom_statue", name: "定制雕像", category: "premium", icon: "🗿", price_cents: 0, is_premium: 1 },
    { id: "premium_gold_ingot", name: "金元宝", category: "premium", icon: "🪙", price_cents: 0, is_premium: 1 },
    { id: "premium_virtual_home", name: "虚拟宅院", category: "premium", icon: "🏯", price_cents: 0, is_premium: 1 },
    { id: "premium_music", name: "专属音乐", category: "premium", icon: "🎵", price_cents: 0, is_premium: 1 },
    { id: "premium_sky_lantern", name: "孔明灯", category: "premium", icon: "🏮", price_cents: 0, is_premium: 1 },
  ];
  const stmt = db.prepare(
    "INSERT INTO items (id, name, category, icon, price_cents, is_premium) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const item of items) {
    stmt.run(item.id, item.name, item.category, item.icon, item.price_cents, item.is_premium);
  }
}