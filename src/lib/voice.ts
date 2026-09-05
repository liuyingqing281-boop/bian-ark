/**
 * lib/voice.ts —— MiMo 语音能力唯一出口（docs/14 §4，FR-13/14）
 * - 语音识别 mimo-v2.5-asr / 合成 mimo-v2.5-tts（流式）
 * - 音色设计 mimo-v2.5-tts-voicedesign / 复刻 mimo-v2.5-tts-voiceclone（非流式，一次性返回）
 * - key 只在环境变量：OPENAI_API_KEY / OPENAI_BASE_URL（OpenAI 兼容接口），前端永远不可见
 * - 识别音频与朗读音频均不落库；B 档复刻样本落对象存储（voice_clones.sample_url）
 */
import { getDb } from "./db";

const DEFAULT_BASE = "https://api.xiaomimimo.com/v1";

/** 预置音色（A 档可选；与 14 号方案 §2.3 对齐） */
export const PRESET_VOICES = ["冰糖", "茉莉", "苏打", "白桦", "Mia", "Chloe"] as const;
export const DEFAULT_VOICE = "白桦";

/** 试听固定文案（preview 只接受这三句，防绕过审核） */
export const PREVIEW_LINES = [
  "慢慢来，不着急。",
  "想我的时候，就来看看我。",
  "你要好好吃饭，好好睡觉。",
] as const;

/** 限频口径（按用户+日；游客按匿名 IP 键） */
export const VOICE_LIMITS = { asr: 100, ttsUser: 200, ttsGuest: 30, preview: 50 } as const;

export type VoiceMode = "" | "preset" | "design" | "clone";
export interface VoiceProfile {
  mode: VoiceMode;
  voiceHandle: string; // preset=音色名；design=描述原文；clone=voice_clones.id
  voiceDesc: string;
}

export function voiceConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

function mimoBase(): string {
  return (process.env.OPENAI_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

function mimoKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("voice_key_missing");
  return key;
}

async function mimoChat(payload: Record<string, unknown>): Promise<Response> {
  const resp = await fetch(`${mimoBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mimoKey()}`,
      "api-key": mimoKey(),
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok || !resp.body) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`mimo_http_${resp.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return resp;
}

/** ASR：音频 data URL（mp3/wav）→ 上游 SSE 流 */
export async function mimoAsrStream(audioDataUrl: string): Promise<Response> {
  return mimoChat({
    model: "mimo-v2.5-asr",
    messages: [
      { role: "user", content: [{ type: "input_audio", input_audio: { data: audioDataUrl } }] },
    ],
    asr_options: { language: "auto" },
    stream: true,
  });
}

/** TTS：按音色档案组请求 → 上游 SSE 流（clone 档需传样本 data URL） */
export async function mimoTtsStream(
  text: string,
  profile: VoiceProfile,
  sampleDataUrl?: string
): Promise<Response> {
  if (profile.mode === "clone" && sampleDataUrl) {
    return mimoChat({
      model: "mimo-v2.5-tts-voiceclone",
      messages: [{ role: "user", content: "" }, { role: "assistant", content: text }],
      audio: { format: "pcm16", voice: sampleDataUrl },
      stream: true,
    });
  }
  if (profile.mode === "design" && profile.voiceDesc) {
    return mimoChat({
      model: "mimo-v2.5-tts-voicedesign",
      messages: [
        { role: "user", content: profile.voiceDesc },
        { role: "assistant", content: text },
      ],
      audio: { format: "pcm16", optimize_text_preview: false },
      stream: true,
    });
  }
  // preset / 未配置：mimo-v2.5-tts 预置音色（低延迟流式）
  const voice = profile.mode === "preset" && profile.voiceHandle ? profile.voiceHandle : DEFAULT_VOICE;
  return mimoChat({
    model: "mimo-v2.5-tts",
    messages: [{ role: "assistant", content: text }],
    audio: { format: "pcm16", voice },
    stream: true,
  });
}

/**
 * 上游 MiMo SSE → 本站 SSE 合约（与 provider 解耦）：
 *   ASR：data: {"delta":"…"}     TTS：data: {"audio":"<base64 pcm16>"}
 * 结束统一发 data: {"done":true}；上游错误发 data: {"error":"upstream"}。
 */
export function transformMimoSse(
  upstream: Response,
  pick: (chunk: unknown) => string | null
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const raw of events) {
            const line = raw.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const out = pick(JSON.parse(payload));
              if (out) controller.enqueue(encoder.encode(`data: ${out}\n\n`));
            } catch {
              /* 跳过无法解析的上游分片 */
            }
          }
        }
        controller.enqueue(encoder.encode(`data: {"done":true}\n\n`));
        controller.close();
      } catch {
        try {
          controller.enqueue(encoder.encode(`data: {"error":"upstream"}\n\n`));
          controller.close();
        } catch {
          /* 流已被消费方取消 */
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

/** 从 OpenAI 兼容 chunk 里取 ASR 文字增量 */
export function pickAsrDelta(chunk: unknown): string | null {
  const delta = (chunk as { choices?: Array<{ delta?: { content?: string } }> })?.choices?.[0]?.delta;
  return typeof delta?.content === "string" && delta.content
    ? JSON.stringify({ delta: delta.content })
    : null;
}

/** 从 OpenAI 兼容 chunk 里取 TTS 音频分片（base64 pcm16） */
export function pickTtsAudio(chunk: unknown): string | null {
  const audio = (chunk as { choices?: Array<{ delta?: { audio?: { data?: string } } }> })?.choices?.[0]
    ?.delta?.audio;
  return typeof audio?.data === "string" && audio.data
    ? JSON.stringify({ audio: audio.data })
    : null;
}

/** 限频：events 表计数（key=用户 id 或 anon:<ip>），当日窗口 */
export function voiceDailyUsed(type: string, key: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM events WHERE type = ? AND user_id = ? AND created_at > datetime('now', '-1 day')")
    .get(type, key) as { c: number } | undefined;
  return row?.c ?? 0;
}

/** SSE 响应头 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
} as const;
