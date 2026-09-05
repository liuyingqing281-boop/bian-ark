import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { trackEvent } from "../../../../lib/events";
import {
  voiceConfigured,
  mimoAsrStream,
  transformMimoSse,
  pickAsrDelta,
  voiceDailyUsed,
  VOICE_LIMITS,
  SSE_HEADERS,
} from "../../../../lib/voice";

// docs/14 §2.1 / 08 §3.14：语音输入 → 文字（SSE 流式）。识别结果不落库。
export const maxDuration = 60;

const MAX_AUDIO_B64_CHARS = 4_000_000; // base64 字符上限 ≈ 3MB 音频（16kHz 16bit 单声道约 90s）

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const audio = typeof body?.audio === "string" ? body.audio : "";
  if (!audio) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!voiceConfigured()) return NextResponse.json({ error: "voice_unavailable" }, { status: 503 });
  if (!/^data:audio\/(wav|x-wav|mpeg|mp3);base64,/.test(audio)) {
    return NextResponse.json({ error: "bad_request", detail: "wav_or_mp3_only" }, { status: 400 });
  }
  if (audio.length > MAX_AUDIO_B64_CHARS) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 413 });
  }

  if (voiceDailyUsed("voice_input_used", user.id) >= VOICE_LIMITS.asr) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const upstream = await mimoAsrStream(audio);
    trackEvent("voice_input_used", { platform: req.headers.get("x-client-platform") === "web-pc" ? "web-pc" : "web-mobile" }, user.id);
    return new Response(transformMimoSse(upstream, pickAsrDelta), { headers: SSE_HEADERS });
  } catch {
    return NextResponse.json({ error: "voice_unavailable" }, { status: 503 });
  }
}
