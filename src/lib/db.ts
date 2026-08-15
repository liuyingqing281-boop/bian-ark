import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrateUp } from "./migrations.mjs";

let db: Database.Database | null = null;

export function resolveDatabasePath(): string {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.SMOKE_DB_PATH || process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bian.db")
  );
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = resolveDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrateUp(db);
  seedItems(db);
  return db;
}

function seedItems(database: Database.Database): void {
  const count = database.prepare("SELECT COUNT(*) AS count FROM items").get() as { count: number };
  if (count.count !== 0) return;

  const items: Array<[string, string, string, string, number, number]> = [
    ["flower_white", "白菊", "flower", "🌸", 0, 0],
    ["flower_rose", "玫瑰", "flower", "🌹", 0, 0],
    ["flower_lily", "百合", "flower", "💐", 0, 0],
    ["candle", "蜡烛", "light", "🕯️", 0, 0],
    ["incense", "香火", "ritual", "🪔", 0, 0],
    ["joss_paper", "纸钱", "ritual", "💰", 0, 0],
    ["fruit", "水果", "food", "🍎", 0, 0],
    ["wine", "酒", "food", "🍶", 0, 0],
    ["teddy", "玩具熊", "toy", "🧸", 0, 0],
    ["letter", "信", "message", "💌", 0, 0],
    ["premium_custom_statue", "定制雕像", "premium", "🗿", 0, 1],
    ["premium_gold_ingot", "金元宝", "premium", "🪙", 0, 1],
    ["premium_virtual_home", "虚拟宅院", "premium", "🏯", 0, 1],
    ["premium_music", "专属音乐", "premium", "🎵", 0, 1],
    ["premium_sky_lantern", "孔明灯", "premium", "🏮", 0, 1],
  ];
  const insert = database.prepare(
    "INSERT INTO items (id, name, category, icon, price_cents, is_premium) VALUES (?, ?, ?, ?, ?, ?)"
  );
  database.transaction(() => {
    for (const item of items) insert.run(...item);
  })();
}
