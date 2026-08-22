// 方舟对话模型客户端（Issue #7）：无 ARK_API_KEY 时 mock 回落
// 注意：用 node:https 直连而非全局 fetch——Next dev 对 fetch 打补丁后
// 调用 chat/completions 会无限滞塞（实测 2026-08-19），https 模块不受影响
import https from "https";
import crypto from "crypto";

export function llmProvider(): string {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER;
  return process.env.ARK_API_KEY ? "ark" : "mock";
}

export interface ChatOptions { maxTokens?: number; temperature?: number; timeoutMs?: number; thinking?: "enabled" | "disabled" }

export async function chat(system: string, user: string, opts: ChatOptions = {}): Promise<{ text: string; provider: string; durationMs: number }> {
  const started = Date.now();
  const provider = llmProvider();
  const text = provider === "ark" ? await chatArk(system, user, opts) : mockChat(system, user);
  return { text, provider, durationMs: Date.now() - started };
}

function httpsPostJson(host: string, path: string, headers: Record<string, string>, payload: unknown, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      { host, path, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(body) }, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = {};
          try { parsed = JSON.parse(text); } catch { parsed = {}; }
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else {
            const err = parsed as { error?: { code?: string } };
            reject(new Error(`llm_http_${res.statusCode}${err?.error?.code ? `: ${err.error.code}` : ""}`));
          }
        });
      }
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("llm_timeout")); });
    req.on("error", (e: Error & { code?: string }) =>
      reject(e.code === "ECONNRESET" || e.message.includes("socket hang up") ? new Error("llm_timeout") : e)
    );
    req.end(body);
  });
}

async function chatArk(system: string, user: string, opts: ChatOptions): Promise<string> {
  const key = process.env.ARK_API_KEY;
  if (!key) throw new Error("llm_key_missing");
  const body = await httpsPostJson(
    "ark.cn-beijing.volces.com",
    "/api/v3/chat/completions",
    { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    {
      model: process.env.ARK_LLM_MODEL || "doubao-seed-2-1-turbo-260628",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 512,
      thinking: { type: opts.thinking ?? "disabled" }, // 推理模型默认关思考：扩写场景 31s→4.5s
    },
    opts.timeoutMs ?? 30_000
  ) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const text = body?.choices?.[0]?.message?.content;
  const out = typeof text === "string" ? text : Array.isArray(text) ? text.map((p) => p.text || "").join("") : "";
  if (!out.trim()) throw new Error("llm_empty");
  return out.trim();
}

function mockChat(system: string, user: string): string {
  // 确定性模拟：以【模拟扩写】开头，E2E 以此断言；不 sleep（测试要快）
  const seed = crypto.createHash("md5").update(user).digest("hex").slice(0, 4);
  const id = system.match(/\[memory_id=([^\]]+)\]/)?.[1] || null;
  const ask = /哪种颜色|什么颜色|不知道|没有记录/.test(user) || !id;
  return JSON.stringify({ text: ask ? "我还没有找到关于这件事的具体记录。你愿意补充一段关于 TA 的记忆吗？" : `根据记录，关于「${user}」可以这样理解（基于 TA 的资料推测）。`, evidence_memory_id: ask ? null : id, ask_memory: ask, followup_question: ask ? "你愿意补充一段关于 TA 的记忆吗？" : null });
}
