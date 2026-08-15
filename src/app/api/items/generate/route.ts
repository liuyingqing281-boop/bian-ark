import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { generateOfferingImages, activeProvider } from "../../../../lib/imagegen";
import { trackEvent } from "../../../../lib/events";
import { moderateText } from "../../../../lib/moderation";

const FREE_MONTHLY_QUOTA = 3;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = String(body?.prompt || "").trim().slice(0, 100);
  if (prompt.length < 2) return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  const moderation = await moderateText(prompt);
  if (!moderation.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

  const db = getDb();
  const month = new Date().toISOString().slice(0, 7);
  if (user.membership_tier !== "premium") {
    const quota = db
      .prepare("SELECT used FROM ai_quotas WHERE user_id = ? AND month = ?")
      .get(user.id, month) as { used: number } | undefined;
    if ((quota?.used ?? 0) >= FREE_MONTHLY_QUOTA) {
      return NextResponse.json({ error: "quota_exceeded", quota: FREE_MONTHLY_QUOTA }, { status: 429 });
    }
  }

  try {
    const candidates = await generateOfferingImages(prompt, 4);
    db.prepare(
      "INSERT INTO ai_quotas (user_id, month, used) VALUES (?, ?, 1) ON CONFLICT(user_id, month) DO UPDATE SET used = used + 1"
    ).run(user.id, month);
    trackEvent("ai_generate", { provider: activeProvider(), ok: true, count: candidates.length }, user.id);
    return NextResponse.json({ ok: true, candidates, provider: activeProvider() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generate_failed";
    trackEvent("ai_generate", { provider: activeProvider(), ok: false, error: message }, user.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}