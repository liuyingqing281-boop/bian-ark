import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { canViewMemorial, MemorialAccessRow } from "../../../../lib/permissions";
import { moderateText } from "../../../../lib/moderation";
import { chat } from "../../../../lib/llm";
import { trackEvent } from "../../../../lib/events";
import { buildChatSystemPrompt, buildRoleplaySystemPrompt, buildMemoryExtractPrompt, ChatMemory, RecentMessage } from "../../../../lib/chat-prompt";
interface MemorialRow extends MemorialAccessRow { name: string; birth_date: string; death_date: string; epitaph: string; biography: string }
interface ModelReply { text: string; evidence_memory_id: string | null; ask_memory: boolean; followup_question: string | null }
function parseReply(raw: string): ModelReply { try { const p = JSON.parse(raw) as Partial<ModelReply>; if (typeof p.text === "string") return { text: p.text, evidence_memory_id: typeof p.evidence_memory_id === "string" ? p.evidence_memory_id : null, ask_memory: p.ask_memory === true, followup_question: typeof p.followup_question === "string" ? p.followup_question : null }; } catch {} return { text: raw, evidence_memory_id: null, ask_memory: false, followup_question: null }; }

/* W4：从用户消息中抽取关于 TA 的新事实，沉淀为记忆（异步，不阻塞对话） */
async function settleMemory(db: ReturnType<typeof getDb>, memorialId: string, userId: string, userMessage: string): Promise<void> {
  try {
    const row = db.prepare("SELECT settings FROM users WHERE id = ?").get(userId) as { settings: string } | undefined;
    const settings = JSON.parse(row?.settings || "{}");
    if (settings.chatMemory === false) return;
    const { text } = await chat(buildMemoryExtractPrompt(), userMessage, { maxTokens: 120, temperature: 0.2, timeoutMs: 20_000 });
    const parsed = JSON.parse(text) as { memory?: string | null };
    const fact = typeof parsed.memory === "string" ? parsed.memory.trim().slice(0, 200) : "";
    if (!fact) return;
    const check = await moderateText(fact);
    if (!check.pass) return;
    db.prepare("INSERT INTO memories (id, memorial_id, user_id, section, content, source) VALUES (?, ?, ?, 'chat', ?, 'chat')")
      .run(randomUUID(), memorialId, userId, fact);
  } catch { /* 沉淀失败静默跳过，不影响对话 */ }
}

export async function POST(req: NextRequest) {
  let body: { memorial_id?: string; memorialId?: string; message?: string; mode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const memorialId = (body.memorialId || body.memorial_id || "").trim();
  const message = (body.message || "").trim().slice(0, 500);
  // W3：双模式；缺省 companion（向后兼容）
  const mode = body.mode === "roleplay" ? "roleplay" : "companion";
  if (!memorialId || !message) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const check = await moderateText(message); if (!check.pass) return NextResponse.json({ error: "blocked" }, { status: 422 });
  const db = getDb();
  const memorial = db.prepare("SELECT id, user_id, visibility, name, birth_date, death_date, epitaph, biography FROM memorials WHERE id = ? AND is_published = 1").get(memorialId) as MemorialRow | undefined;
  const user = await getSessionUser();
  if (!memorial || !canViewMemorial(memorial, user?.id ?? null)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // W3 拍板②：模仿模式仅登录用户
  if (mode === "roleplay" && !user) return NextResponse.json({ error: "roleplay_requires_login" }, { status: 401 });

  let memories: ChatMemory[] = []; try { memories = db.prepare("SELECT id, section, content, created_at FROM memories WHERE memorial_id = ? AND (review_status = 'approved' OR review_status = '') ORDER BY created_at ASC LIMIT 100").all(memorialId) as ChatMemory[]; } catch {}
  const events = db.prepare("SELECT year, title FROM life_events WHERE memorial_id = ? ORDER BY year ASC LIMIT 20").all(memorialId) as { year: number; title: string }[];
  // W4：近期对话注入（本馆本人最近 20 条，正序）
  let recent: RecentMessage[] = [];
  if (user) {
    recent = (db.prepare("SELECT role, content FROM chat_messages WHERE memorial_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 20").all(memorialId, user.id) as RecentMessage[]).reverse();
  }
  const system = mode === "roleplay"
    ? buildRoleplaySystemPrompt(memorial, memories, events, recent)
    : buildChatSystemPrompt(memorial, memories, events, recent);

  try {
    const result = await chat(system, message, { maxTokens: 220, temperature: 0.7, timeoutMs: 30_000 });
    const reply = parseReply(result.text);
    const m = reply.evidence_memory_id ? memories.find(x => x.id === reply.evidence_memory_id) : undefined;
    const evidence = m ? { memory_id: m.id, quote: m.content, created_at: m.created_at } : null;
    if (user?.id) {
      const ins = db.prepare("INSERT INTO chat_messages (id, memorial_id, user_id, role, content, evidence_memory_id, mode) VALUES (?, ?, ?, ?, ?, ?, ?)");
      ins.run(randomUUID(), memorialId, user.id, "user", message, null, mode);
      ins.run(randomUUID(), memorialId, user.id, "ta", reply.text, evidence?.memory_id ?? null, mode);
      // W4：异步沉淀（fire-and-forget）
      void settleMemory(db, memorialId, user.id, message);
    }
    trackEvent("hall_chat_reply", { memorial_id: memorialId, mode, provider: result.provider, platform: req.headers.get("x-client-platform") === "web-pc" ? "web-pc" : "web-mobile" }, user?.id || "");
    return NextResponse.json({ text: reply.text, mode, evidence, inferred: true, askMemory: reply.ask_memory, followupQuestion: reply.followup_question });
  } catch (e) { console.error("hall_chat_error", String(e)); return NextResponse.json({ error: "llm_unavailable" }, { status: 503 }); }
}
