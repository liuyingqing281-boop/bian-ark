// 方舟对话模型客户端（Issue #7）：无 ARK_API_KEY 时 mock 回落
import crypto from "crypto";

export function llmProvider(): string {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER;
  return process.env.ARK_API_KEY ? "ark" : "mock";
}

export interface ChatOptions { maxTokens?: number; temperature?: number; timeoutMs?: number }

export async function chat(system: string, user: string, opts: ChatOptions = {}): Promise<{ text: string; provider: string; durationMs: number }> {
  const started = Date.now();
  const provider = llmProvider();
  const text = provider === "ark" ? await chatArk(system, user, opts) : mockChat(system, user);
  return { text, provider, durationMs: Date.now() - started };
}

async function chatArk(system: string, user: string, opts: ChatOptions): Promise<string> {
  const key = process.env.ARK_API_KEY;
  if (!key) throw new Error("llm_key_missing");
  const resp = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.ARK_LLM_MODEL || "doubao-seed-2-1-turbo-260628",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 512,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = body as { error?: { code?: string; message?: string } } | null;
    throw new Error(`llm_http_${resp.status}${err?.error?.code ? `: ${err.error.code}` : ""}`);
  }
  interface ArkChatResponse {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  }
  const text = (body as ArkChatResponse)?.choices?.[0]?.message?.content;
  const out = typeof text === "string" ? text : Array.isArray(text) ? text.map((p) => p.text || "").join("") : "";
  if (!out.trim()) throw new Error("llm_empty");
  return out.trim();
}

function mockChat(_system: string, user: string): string {
  // 确定性模拟：以【模拟扩写】开头，E2E 以此断言；不 sleep（测试要快）
  const seed = crypto.createHash("md5").update(user).digest("hex").slice(0, 4);
  return `【模拟扩写】${user}，写实摄影风格，柔光，深色背景，居中构图（种子 ${seed}）`;
}
