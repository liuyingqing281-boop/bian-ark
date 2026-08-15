import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const source = process.argv[2];
if (!source || !fs.existsSync(source)) throw new Error("usage: node tools/restore-check.mjs <backup.db>");
const temp = path.join(os.tmpdir(), `bian-restore-${Date.now()}.db`);
fs.copyFileSync(source, temp);
try {
  const db = new Database(temp, { readonly: true });
  const integrity = db.pragma("integrity_check", { simple: true });
  const foreignKeys = db.pragma("foreign_key_check");
  const migrations = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get();
  db.close();
  if (integrity !== "ok" || foreignKeys.length) throw new Error("restore_verification_failed");
  console.log(JSON.stringify({ ok: true, integrity, foreignKeyErrors: foreignKeys.length, migrations }, null, 2));
} finally { fs.rmSync(temp, { force: true }); }
