import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { moderateText } from "../../../../lib/moderation";
import { trackEvent } from "../../../../lib/events";
import {
  voiceConfigured,
  mimoTtsStream,
  transformMimoSse,
  pickTtsAudio,
  voiceDailyUsed,
  VOICE_LIMITS,
  SSE_HEADERS,
  PRESET_VOICES,
  PREVIEW_LINES,
  VoiceProfile,
} from "../../../../lib/voice";

// docs/14 §2.3 / 08 §3.14：角色创建/设置页音色试听。固定三句文案，不产生任何落库。
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const voice = typeof body?.voice === "string" ? body.voice.trim() : "";
  const voiceDesc = (typeof body?.voiceDesc === "string" ? body.voiceDesc : "").trim().slice(0, 100);
  const lineIdx = Number(body?.line);
  const text = PREVIEW_LINES[lineIdx];
  if (!text) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!voice && !voiceDesc) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!voiceConfigured()) return NextResponse.json({ error: "voice_unavailable" }, { status: 503 });

  let profile: VoiceProfile;
  if (voiceDesc) {
    const check = await moderateText(voiceDesc);
    if (!check.pass) return NextResponse.json({ error: "content_rejected" }, { status: 422 });
    profile = { mode: "design", voiceHandle: "", voiceDesc };
  } else {
    if (!(PRESET_VOICES as readonly string[]).includes(voice)) {
      return NextResponse.json({ error: "unknown_voice" }, { status: 400 });
    }
    profile = { mode: "preset", voiceHandle: voice, voiceDesc: "" };
  }

  if (voiceDailyUsed("voice_preview", user.id) >= VOICE_LIMITS.preview) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const upstream = await mimoTtsStream(text, profile);
    trackEvent("voice_preview", { mode: profile.mode }, user.id);
    return new Response(transformMimoSse(upstream, pickTtsAudio), { headers: SSE_HEADERS });
  } catch {
    return NextResponse.json({ error: "voice_unavailable" }, { status: 503 });
  }
}
