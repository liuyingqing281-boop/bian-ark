import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { refundRedoCredit } from "../../../../lib/digitalhuman";

// Vendor webhook: flips a submitted job to reviewing (success) or failed.
// Guarded by a shared secret; configure DH_CALLBACK_SECRET in production.
export async function POST(req: NextRequest) {
  const secret = process.env.DH_CALLBACK_SECRET;
  if (!secret || req.headers.get("x-callback-token") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const jobId = String(body?.provider_job_id || "");
  if (!jobId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const db = getDb();
  const succeeded = body?.status === "succeeded";
  const changes = succeeded
    ? db
        .prepare(
          "UPDATE digital_humans SET status = 'reviewing', result_video_url = ?, updated_at = datetime('now') WHERE provider_job_id = ? AND status IN ('pending', 'processing')"
        )
        .run(String(body?.result_url || ""), jobId).changes
    : db
        .prepare(
          "UPDATE digital_humans SET status = 'failed', error = ?, updated_at = datetime('now') WHERE provider_job_id = ? AND status IN ('pending', 'processing')"
        )
        .run(String(body?.error || "provider_failed"), jobId).changes;

  if (!changes) {
    const existing = db.prepare("SELECT status FROM digital_humans WHERE provider_job_id = ?").get(jobId) as { status: string } | undefined;
    if (existing) return NextResponse.json({ ok: true, duplicate: true, status: existing.status });
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }
  if (!succeeded) {
    // 失败必须退还已消费的重做额度（PRD F3.6）
    const task = db.prepare("SELECT id FROM digital_humans WHERE provider_job_id = ?").get(jobId) as
      | { id: string }
      | undefined;
    if (task) refundRedoCredit(task.id);
  }
  db.prepare("UPDATE digital_humans SET callback_payload = ? WHERE provider_job_id = ?")
    .run(JSON.stringify(body).slice(0, 100000), jobId);
  return NextResponse.json({ ok: true });
}
