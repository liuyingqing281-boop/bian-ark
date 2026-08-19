import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { moderateText } from "../../../../lib/moderation";
import { trackEvent } from "../../../../lib/events";
import { chat } from "../../../../lib/llm";

const DAILY_LIMIT = 10;

const SYSTEM_PROMPT = `你是祭品生图提示词专家。把用户的简短想法扩写为一条高质量中文生图提示词，要求：
写实静物摄影风格、庄重克制、适合纪念场合；只描写物品本身与光线构图，禁止出现人物、
文字、水印；长度不超过 120 字；直接输出提示词本身，不要任何解释或引号。`;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const idea = String(body?.idea || "").trim().slice(0, 60);
  if (idea.length < 2) return NextResponse.json({ error: "idea_required" }, { status: 400 });

  // 输入审核
  const inputCheck = await moderateText(idea);
  if (!inputCheck.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

  // 限频：每用户每日 10 次（先检查后计数，事务内 upsert）
  const db = getDb();
  const day = new Date().toISOString().slice(0, 10);
  const counted = db.transaction(() => {
    db.prepare(
      "INSERT INTO prompt_usage (user_id, day, used) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET used = used + 1"
    ).run(user.id, day);
    return (db.prepare("SELECT used FROM prompt_usage WHERE user_id = ? AND day = ?").get(user.id, day) as { used: number }).used;
  })();
  if (counted > DAILY_LIMIT) return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });

  try {
        const { text, provider, durationMs } = await chat(SYSTEM_PROMPT, idea, { maxTokens: 256, temperature: 0.8, timeoutMs: 90_000 });

    // 输出审核
    const outputCheck = await moderateText(text);
    if (!outputCheck.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

    trackEvent("prompt_generated", { scene: "offering", provider, durationMs, ok: true }, user.id);
    return NextResponse.json({ ok: true, prompt: text, provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : "llm_failed";
    trackEvent("prompt_generated", { scene: "offering", ok: false, error: message }, user.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
