import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { canViewMemorial, MemorialAccessRow } from "../../../../lib/permissions";
import { moderateText } from "../../../../lib/moderation";
import { trackEvent } from "../../../../lib/events";
import { localFileToDataUrl } from "../../../../lib/ark";
import {
  voiceConfigured,
  mimoTtsStream,
  transformMimoSse,
  pickTtsAudio,
  voiceDailyUsed,
  VOICE_LIMITS,
  SSE_HEADERS,
  VoiceProfile,
  VoiceMode,
} from "../../../../lib/voice";

// docs/14 §2.2 / 08 §3.14：TA 气泡朗读 → PCM16 流。朗读音频不落库。
export const maxDuration = 60;

interface VoiceRow extends MemorialAccessRow {
  voice_mode: string;
  voice_handle: string;
  voice_desc: string;
}

/** F9 规则：clone 须有 approved 复刻记录，否则回落默认音色 */
async function resolveVoice(memorial: VoiceRow): Promise<{ profile: VoiceProfile; sampleDataUrl?: string }> {
  const mode = (["preset", "design", "clone"].includes(memorial.voice_mode) ? memorial.voice_mode : "") as VoiceMode;
  const profile: VoiceProfile = { mode, voiceHandle: memorial.voice_handle || "", voiceDesc: memorial.voice_desc || "" };
  if (mode !== "clone") return { profile };
  const db = getDb();
  const clone = db
    .prepare("SELECT sample_url FROM voice_clones WHERE memorial_id = ? AND review_status = 'approved' ORDER BY created_at DESC LIMIT 1")
    .get(memorial.id) as { sample_url: string } | undefined;
  if (!clone) return { profile: { mode: "", voiceHandle: "", voiceDesc: "" } };
  const sampleDataUrl = (await localFileToDataUrl(clone.sample_url, "audio")) ?? undefined;
  if (!sampleDataUrl) return { profile: { mode: "", voiceHandle: "", voiceDesc: "" } };
  return { profile, sampleDataUrl };
}

function anonKey(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `anon:${createHash("sha256").update(ip).digest("hex").slice(0, 16)}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const memorialId = typeof body?.memorialId === "string" ? body.memorialId.trim() : "";
  const text = (typeof body?.text === "string" ? body.text : "").trim().slice(0, 500);
  if (!memorialId || !text) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!voiceConfigured()) return NextResponse.json({ error: "voice_unavailable" }, { status: 503 });

  const db = getDb();
  const memorial = db
    .prepare("SELECT id, user_id, visibility, voice_mode, voice_handle, voice_desc FROM memorials WHERE id = ? AND is_published = 1")
    .get(memorialId) as VoiceRow | undefined;
  const user = await getSessionUser();
  if (!memorial || !canViewMemorial(memorial, user?.id ?? null)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 限频：登录按用户+日，游客按匿名 IP+日（更严）
  const key = user?.id ?? anonKey(req);
  const limit = user ? VOICE_LIMITS.ttsUser : VOICE_LIMITS.ttsGuest;
  if (voiceDailyUsed("voice_play", key) >= limit) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const check = await moderateText(text);
  if (!check.pass) return NextResponse.json({ error: "content_rejected" }, { status: 422 });

  try {
    const { profile, sampleDataUrl } = await resolveVoice(memorial);
    const upstream = await mimoTtsStream(text, profile, sampleDataUrl);
    trackEvent("voice_play", {
      memorial_id: memorialId,
      voiceMode: profile.mode || "default",
      platform: req.headers.get("x-client-platform") === "web-pc" ? "web-pc" : "web-mobile",
    }, key);
    return new Response(transformMimoSse(upstream, pickTtsAudio), { headers: SSE_HEADERS });
  } catch {
    return NextResponse.json({ error: "voice_unavailable" }, { status: 503 });
  }
}
