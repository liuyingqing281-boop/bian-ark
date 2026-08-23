import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { generateOfferingImages, activeProvider } from "../../../../lib/imagegen";
import { trackEvent } from "../../../../lib/events";
import { moderateText } from "../../../../lib/moderation";
import { v4 as uuid } from "uuid";

const FREE_MONTHLY_QUOTA = 3;
const IMAGE_COUNT = 4;

function jobView(job: {
  id: string; status: string; candidates: string; error: string; provider: string;
  completed: number; total: number;
}) {
  return {
    jobId: job.id,
    status: job.status,
    completed: job.completed ?? 0,
    total: job.total ?? IMAGE_COUNT,
    candidates: JSON.parse(job.candidates || "[]"),
    error: job.error || null,
    provider: job.provider,
  };
}

// GET /api/items/generate?jobId= —— 轮询生成进度（W6：真实百分比）
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const jobId = String(req.nextUrl.searchParams.get("jobId") || "");
  const job = getDb()
    .prepare(
      "SELECT id, status, candidates, error, provider, completed, total FROM ai_generation_jobs WHERE id = ? AND user_id = ?"
    )
    .get(jobId, user.id) as
    | { id: string; status: string; candidates: string; error: string; provider: string; completed: number; total: number }
    | undefined;
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: job.status === "done", ...jobView(job) });
}

// POST /api/items/generate —— 创建异步生图任务，立即返回 jobId；
// 后台逐张生成，每完成一张 completed+1（前端轮询 GET 拿真实进度）。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = String(body?.prompt || "").trim().slice(0, 100);
  const idempotencyKey = req.headers.get("idempotency-key") || String(body?.idempotency_key || "");
  if (prompt.length < 2) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "idempotency_key_required" }, { status: 400 });
  }
  const moderation = await moderateText(prompt);
  if (!moderation.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

  const db = getDb();
  const existing = db
    .prepare("SELECT id, status, candidates, error, provider, completed, total FROM ai_generation_jobs WHERE user_id = ? AND idempotency_key = ?")
    .get(user.id, idempotencyKey) as
    | { id: string; status: string; candidates: string; error: string; provider: string; completed: number; total: number }
    | undefined;
  if (existing) {
    // 幂等重放：未完成返进度，已完成返结果
    return NextResponse.json({ ok: existing.status === "done", ...jobView(existing), replayed: true });
  }
  const month = new Date().toISOString().slice(0, 7);
  if (user.membership_tier !== "premium") {
    const quota = db
      .prepare("SELECT used FROM ai_quotas WHERE user_id = ? AND month = ?")
      .get(user.id, month) as { used: number } | undefined;
    if ((quota?.used ?? 0) >= FREE_MONTHLY_QUOTA) {
      return NextResponse.json({ error: "quota_exceeded", quota: FREE_MONTHLY_QUOTA }, { status: 429 });
    }
  }

  const jobId = uuid();
  db.prepare(
    "INSERT INTO ai_generation_jobs (id, user_id, idempotency_key, provider, status, prompt, total, completed) VALUES (?, ?, ?, ?, 'processing', ?, ?, 0)"
  ).run(jobId, user.id, idempotencyKey, activeProvider(), prompt, IMAGE_COUNT);

  // 后台执行（长驻 Node 进程，fire-and-forget；每张完成即更新进度）
  void (async () => {
    const startedAt = Date.now();
    const done: string[] = [];
    try {
      // 逐张生成：progressive——generateOfferingImages 内部是循环，这里改为自管循环拿进度
      for (let i = 0; i < IMAGE_COUNT; i++) {
        const urls = await generateOfferingImages(prompt, 1);
        done.push(...urls);
        db.prepare("UPDATE ai_generation_jobs SET completed = ?, candidates = ? WHERE id = ?")
          .run(done.length, JSON.stringify(done), jobId);
      }
      const durationMs = Date.now() - startedAt;
      db.transaction(() => {
        db.prepare("INSERT INTO ai_quotas (user_id, month, used) VALUES (?, ?, 1) ON CONFLICT(user_id, month) DO UPDATE SET used = used + 1").run(user.id, month);
        db.prepare("UPDATE ai_generation_jobs SET status = 'done', candidates = ?, duration_ms = ? WHERE id = ?").run(JSON.stringify(done), durationMs, jobId);
      })();
      trackEvent("ai_generate", { provider: activeProvider(), ok: true, count: done.length, durationMs }, user.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "generate_failed";
      db.prepare("UPDATE ai_generation_jobs SET status = 'failed', error = ?, duration_ms = ?, candidates = ? WHERE id = ?")
        .run(message, Date.now() - startedAt, JSON.stringify(done), jobId);
      trackEvent("ai_generate", { provider: activeProvider(), ok: false, error: message }, user.id);
    }
  })();

  return NextResponse.json({ ok: false, jobId, status: "processing", completed: 0, total: IMAGE_COUNT, provider: activeProvider() });
}
