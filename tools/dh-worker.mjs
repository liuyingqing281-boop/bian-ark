// 数字人任务 worker（cron 每 5 分钟）：
// 1) 恢复停滞的 ark 任务：查询方舟任务状态 → 成功下载转存置 reviewing / 失败退额
// 2) 超时清理：processing 超过 DH_JOB_TIMEOUT_MINUTES 的任务置 failed + 退额（含 mock）
// 幂等：所有状态变更都以 status='processing' 为条件；与进程内轮询并存不冲突
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(root, "data", "bian.db"));
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

const ARK_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const ARK_KEY = process.env.ARK_API_KEY || "";
const UPLOAD_SUBDIR = "digitalhuman";
// 进程内轮询周期 10s；停滞超过该窗口的任务视为「重启孤儿」，交由本 worker 接管
const STALE_SECONDS = Number(process.env.DH_WORKER_STALE_SECONDS || 180);

function extractVideoUrl(t) {
  return t?.content?.video_url || t?.video_url || t?.data?.[0]?.url || null;
}

async function recoverArkTask(task) {
  const resp = await fetch(`${ARK_BASE}/contents/generations/tasks/${task.provider_job_id}`, {
    headers: { Authorization: `Bearer ${ARK_KEY}` },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await resp.json().catch(() => ({}));
  if (resp.status === 404) {
    // 任务号不存在：终态失败（不可恢复），退额
    db.prepare(
      "UPDATE digital_humans SET status='failed', error=?, updated_at=datetime('now') WHERE id=? AND status='processing'"
    ).run("ark_job_not_found", task.id);
    refund(task.id);
    return "failed(not_found)";
  }
  if (!resp.ok) throw new Error(`ark_http_${resp.status}`); // 5xx/限流：下轮重试

  const status = body?.status;
  if (status === "succeeded") {
    const url = extractVideoUrl(body);
    if (!url) throw new Error("ark_empty_video");
    const dir = path.join(root, "data", "uploads", UPLOAD_SUBDIR);
    fs.mkdirSync(dir, { recursive: true });
    const file = `${crypto.randomUUID()}.mp4`;
    const dl = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!dl.ok) throw new Error(`download_failed_${dl.status}`);
    fs.writeFileSync(path.join(dir, file), Buffer.from(await dl.arrayBuffer()));
    const localUrl = `/uploads/${UPLOAD_SUBDIR}/${file}`;
    const changed = db
      .prepare(
        "UPDATE digital_humans SET status='reviewing', result_video_url=?, updated_at=datetime('now') WHERE id=? AND status='processing'"
      )
      .run(localUrl, task.id).changes;
    return changed ? "recovered->reviewing" : "skipped(already_done)";
  }
  if (status === "failed" || status === "cancelled") {
    const msg = body?.error?.message || "ark_task_failed";
    const changed = db
      .prepare("UPDATE digital_humans SET status='failed', error=?, updated_at=datetime('now') WHERE id=? AND status='processing'")
      .run(msg, task.id).changes;
    if (changed) refund(task.id);
    return changed ? "failed(refunded)" : "skipped(already_done)";
  }
  return `still_${status || "unknown"}`;
}

function refund(taskId) {
  const task = db.prepare("SELECT memorial_id, user_id FROM digital_humans WHERE id = ?").get(taskId);
  if (!task) return;
  db.prepare(
    `UPDATE dh_redo_credits SET used = 0 WHERE id = (
       SELECT id FROM dh_redo_credits WHERE memorial_id = ? AND user_id = ? AND used = 1
       ORDER BY created_at DESC LIMIT 1)`
  ).run(task.memorial_id, task.user_id);
}

// ---- 1) 停滞 ark 任务恢复 ----
const recoverable = ARK_KEY
  ? db
      .prepare(
        `SELECT id, provider_job_id FROM digital_humans
         WHERE status='processing' AND provider='ark'
           AND provider_job_id <> 'ark-' || id        -- 排除尚未回填真实任务号的占位符
           AND updated_at < datetime('now', '-' || ? || ' seconds')`,
      )
      .all(STALE_SECONDS)
  : [];
const results = [];
for (const task of recoverable) {
  try {
    results.push(`${task.id.slice(0, 8)}: ${await recoverArkTask(task)}`);
  } catch (err) {
    results.push(`${task.id.slice(0, 8)}: retry_next_run(${err.message})`);
  }
}

// ---- 2) 超时清理（含 mock 与无法恢复的任务）----
const timeoutMinutes = Math.max(5, Number(process.env.DH_JOB_TIMEOUT_MINUTES || 60));
const timedOutRows = db
  .prepare(`SELECT id FROM digital_humans
    WHERE status='processing' AND updated_at < datetime('now', '-' || ? || ' minutes')`)
  .all(timeoutMinutes);
if (timedOutRows.length > 0) {
  const markFailed = db.prepare(
    `UPDATE digital_humans SET status = 'failed', error = 'worker_timeout', updated_at = datetime('now') WHERE id = ?`
  );
  for (const row of timedOutRows) {
    markFailed.run(row.id);
    refund(row.id); // 超时失败退还已消费的重做额度（PRD F3.6）
  }
}

const processing = db.prepare("SELECT id, provider_job_id, updated_at FROM digital_humans WHERE status='processing' ORDER BY updated_at").all();
console.log(JSON.stringify({ dbPath, recovered: results, timedOut: timedOutRows.length, processing }, null, 2));
db.close();
