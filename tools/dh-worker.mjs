import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(root, "data", "bian.db"));
const db = new Database(dbPath);
const timeoutMinutes = Math.max(5, Number(process.env.DH_JOB_TIMEOUT_MINUTES || 60));
const timedOutRows = db.prepare(`SELECT id FROM digital_humans
  WHERE status = 'processing' AND updated_at < datetime('now', '-' || ? || ' minutes')`).all(timeoutMinutes);
if (timedOutRows.length > 0) {
  const markFailed = db.prepare(`UPDATE digital_humans SET status = 'failed', error = 'worker_timeout', updated_at = datetime('now')
    WHERE id = ?`);
  const refund = db.prepare(`UPDATE dh_redo_credits SET used = 0 WHERE id = (
     SELECT id FROM dh_redo_credits c JOIN digital_humans d ON d.memorial_id = c.memorial_id AND d.user_id = c.user_id
     WHERE d.id = ? AND c.used = 1 ORDER BY c.created_at DESC LIMIT 1)`);
  for (const row of timedOutRows) {
    markFailed.run(row.id);
    // 超时失败退还已消费的重做额度（PRD F3.6，与 lib/digitalhuman.ts 的 refundRedoCredit 同逻辑）
    refund.run(row.id);
  }
}
const processing = db.prepare("SELECT id, provider_job_id, updated_at FROM digital_humans WHERE status = 'processing' ORDER BY updated_at").all();
console.log(JSON.stringify({ dbPath, timedOut: timedOutRows.length, processing }, null, 2));
db.close();
