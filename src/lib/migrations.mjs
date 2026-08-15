import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const MIGRATION_PATTERN = /^(\d{3})_[a-z0-9_-]+\.sql$/;

export function resolveMigrationDir() {
  return path.resolve(process.cwd(), "migrations");
}

export function loadMigrations(migrationDir = resolveMigrationDir()) {
  const names = fs.readdirSync(migrationDir).filter((name) => MIGRATION_PATTERN.test(name)).sort();
  const seen = new Set();
  return names.map((name) => {
    const version = Number(name.match(MIGRATION_PATTERN)[1]);
    if (seen.has(version)) throw new Error(`duplicate migration version: ${version}`);
    seen.add(version);
    const sql = fs.readFileSync(path.join(migrationDir, name), "utf8");
    return { version, name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
  });
}

function ensureMigrationTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

function applyAddColumnDirectives(db, sql) {
  const directives = [];
  const executable = sql.replace(/^-- @add-column ([a-z0-9_]+) ([a-z0-9_]+) (.+)$/gmi, (_line, table, column, definition) => {
    directives.push({ table, column, definition });
    return "";
  });
  for (const directive of directives) {
    const columns = db.prepare(`PRAGMA table_info(${directive.table})`).all();
    if (!columns.some((column) => column.name === directive.column)) {
      db.exec(`ALTER TABLE ${directive.table} ADD COLUMN ${directive.column} ${directive.definition}`);
    }
  }
  db.exec(executable);
}

export function migrateUp(db, { migrationDir } = {}) {
  ensureMigrationTable(db);
  const migrations = loadMigrations(migrationDir);
  const applied = new Map(db.prepare("SELECT version, checksum FROM schema_migrations").all().map((row) => [row.version, row.checksum]));
  const completed = [];
  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      if (applied.get(migration.version) !== migration.checksum) throw new Error(`migration checksum mismatch: ${migration.name}`);
      continue;
    }
    db.transaction(() => {
      applyAddColumnDirectives(db, migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)")
        .run(migration.version, migration.name, migration.checksum);
    })();
    completed.push(migration.name);
  }
  return completed;
}

export function migrationStatus(db, { migrationDir } = {}) {
  ensureMigrationTable(db);
  const applied = new Map(db.prepare("SELECT version, name, checksum, applied_at FROM schema_migrations").all().map((row) => [row.version, row]));
  return loadMigrations(migrationDir).map((migration) => ({
    ...migration,
    sql: undefined,
    state: !applied.has(migration.version) ? "pending" : applied.get(migration.version).checksum === migration.checksum ? "applied" : "checksum_mismatch",
    appliedAt: applied.get(migration.version)?.applied_at || null,
  }));
}

const REQUIRED_SCHEMA = {
  users: ["id", "email", "phone", "wechat_openid", "wechat_unionid", "avatar_url"],
  memorials: ["id", "user_id", "visibility", "in_garden", "garden_section", "garden_slot"],
  items: ["id", "image_url", "owner_user_id", "source", "review_status"],
  sessions: ["token", "user_id", "expires_at"],
  login_codes: ["channel", "target", "code", "attempts", "used"],
  groups: ["id", "owner_user_id", "invite_code"],
  media: ["id", "memorial_id", "url", "thumb_url", "is_cover", "review_status", "object_key", "mime", "size_bytes", "sha256"],
  digital_humans: ["id", "memorial_id", "status", "provider_job_id", "callback_payload"],
  orders: ["id", "user_id", "status", "provider_session_id", "provider_payment_id"],
  ai_generation_jobs: ["id", "user_id", "idempotency_key", "status", "candidates"],
  data_requests: ["id", "user_id", "kind", "status"],
  tributes: ["id", "memorial_id", "user_id", "review_status", "review_reason"],
};

export function verifyDatabase(db, options = {}) {
  const errors = [];
  const status = migrationStatus(db, options);
  for (const migration of status) if (migration.state !== "applied") errors.push(`${migration.name}: ${migration.state}`);
  for (const [table, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
    const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
    if (!columns.size) errors.push(`missing table: ${table}`);
    for (const column of requiredColumns) if (!columns.has(column)) errors.push(`missing column: ${table}.${column}`);
  }
  const integrity = db.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") errors.push(`integrity_check: ${integrity}`);
  for (const row of db.pragma("foreign_key_check")) errors.push(`foreign key violation: ${JSON.stringify(row)}`);
  return { ok: errors.length === 0, errors, migrations: status.length };
}
