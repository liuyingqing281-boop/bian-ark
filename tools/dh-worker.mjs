import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(root, "data", "bian.db"));
const db = new Database(dbPath);
const timeoutMinutes = Math.max(5, Number(process.env.DH_JOB_TIMEOUT_MINUTES || 60));
const timedOut = db.prepare(`UPDATE digital_humans SET status = 'failed', error = 'worker_timeout', updated_at = datetime('now')
  WHERE status = 'processing' AND updated_at < datetime('now', '-' || ? || ' minutes')`).run(timeoutMinutes).changes;
const processing = db.prepare("SELECT id, provider_job_id, updated_at FROM digital_humans WHERE status = 'processing' ORDER BY updated_at").all();
console.log(JSON.stringify({ dbPath, timedOut, processing }, null, 2));
db.close();
