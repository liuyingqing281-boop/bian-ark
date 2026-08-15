import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { migrateUp, migrationStatus, verifyDatabase } from "../src/lib/migrations.mjs";

const command = process.argv[2] || "status";
const dbPath = path.resolve(process.env.SMOKE_DB_PATH || process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bian.db"));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

try {
  if (command === "up") {
    const applied = migrateUp(db);
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database already up to date");
  } else if (command === "status") {
    for (const migration of migrationStatus(db)) console.log(`${String(migration.version).padStart(3, "0")} ${migration.state} ${migration.name}`);
  } else if (command === "verify") {
    const result = verifyDatabase(db);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    console.log(`Database verified: ${result.migrations} migrations, integrity ok, foreign keys ok`);
  } else if (command === "backup") {
    const backupDir = path.resolve(process.env.DB_BACKUP_DIR || path.join(process.cwd(), "data", "backups"));
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const target = path.join(backupDir, `${path.basename(dbPath, path.extname(dbPath))}-${stamp}.db`);
    await db.backup(target);
    console.log(`Backup created: ${target}`);
  } else {
    throw new Error("usage: node tools/db-migrate.mjs up|status|verify|backup");
  }
} finally {
  db.close();
}
