import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { generateOfferingImages, activeProvider } from "../../../../lib/imagegen";
import { trackEvent } from "../../../../lib/events";
import { moderateText } from "../../../../lib/moderation";
import { v4 as uuid } from "uuid";

const FREE_MONTHLY_QUOTA = 3;

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
  const existing = db.prepare("SELECT id, status, candidates, error, provider FROM ai_generation_jobs WHERE user_id = ? AND idempotency_key = ?").get(user.id, idempotencyKey) as
    | { id: string; status: string; candidates: string; error: string; provider: string }
    | undefined;
  if (existing) {
    return NextResponse.json({ ok: existing.status === "done", jobId: existing.id, status: existing.status, candidates: JSON.parse(existing.candidates || "[]"), error: existing.error, provider: existing.provider, replayed: true });
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
  const startedAt = Date.now();
  db.prepare("INSERT INTO ai_generation_jobs (id, user_id, idempotency_key, provider, status, prompt) VALUES (?, ?, ?, ?, 'processing', ?)")
    .run(jobId, user.id, idempotencyKey, activeProvider(), prompt);
  try {
    const candidates = await generateOfferingImages(prompt, 4);
    const durationMs = Date.now() - startedAt;
    db.transaction(() => {
      db.prepare("INSERT INTO ai_quotas (user_id, month, used) VALUES (?, ?, 1) ON CONFLICT(user_id, month) DO UPDATE SET used = used + 1").run(user.id, month);
      db.prepare("UPDATE ai_generation_jobs SET status = 'done', candidates = ?, duration_ms = ? WHERE id = ?").run(JSON.stringify(candidates), durationMs, jobId);
    })();
    trackEvent("ai_generate", { provider: activeProvider(), ok: true, count: candidates.length, durationMs }, user.id);
    return NextResponse.json({ ok: true, jobId, candidates, provider: activeProvider() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generate_failed";
    db.prepare("UPDATE ai_generation_jobs SET status = 'failed', error = ?, duration_ms = ? WHERE id = ?").run(message, Date.now() - startedAt, jobId);
    trackEvent("ai_generate", { provider: activeProvider(), ok: false, error: message }, user.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
