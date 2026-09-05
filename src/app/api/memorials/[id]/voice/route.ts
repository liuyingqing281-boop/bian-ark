import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/auth";
import { canManageMemorial } from "../../../../../lib/memories";
import { moderateText } from "../../../../../lib/moderation";
import { saveUpload } from "../../../../../lib/upload";
import { trackEvent } from "../../../../../lib/events";
import { PRESET_VOICES, VoiceMode } from "../../../../../lib/voice";

// docs/14 §2.3 / 08 §3.14：角色音色配置（A 档 preset/design 即存即效；B 档 clone 进人工审核）
export const maxDuration = 60;

const CLONE_MAX_BYTES = 10 * 1024 * 1024; // B 档样本 ≤10MB（MiMo voiceclone 上限）
const CLONE_MIME = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"]);

interface MemorialRow {
  id: string;
  user_id: string;
  visibility: string;
  voice_mode: string;
  voice_handle: string;
  voice_desc: string;
  voice_updated_at: string;
}

function getMemorial(id: string): MemorialRow | undefined {
  return getDb()
    .prepare("SELECT id, user_id, visibility, voice_mode, voice_handle, voice_desc, voice_updated_at FROM memorials WHERE id = ?")
    .get(id) as MemorialRow | undefined;
}

/** F9 VoiceProfileView */
function voiceProfile(db: ReturnType<typeof getDb>, m: MemorialRow) {
  let cloneStatus: "" | "pending" | "approved" | "rejected" = "";
  if (m.voice_mode === "clone") {
    const row = db
      .prepare("SELECT review_status FROM voice_clones WHERE memorial_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(m.id) as { review_status: string } | undefined;
    cloneStatus = (row?.review_status as "pending" | "approved" | "rejected") ?? "";
  }
  return {
    mode: (m.voice_mode || "none") as VoiceMode | "none",
    voice: m.voice_handle || "",
    voiceDesc: m.voice_desc || "",
    cloneStatus,
    updatedAt: m.voice_updated_at || "",
  };
}

// GET：当前音色档案（F9），馆内可管理者可读
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memorial = getMemorial(id);
  if (!memorial || !canManageMemorial(memorial, user.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ voiceProfile: voiceProfile(getDb(), memorial), presetVoices: PRESET_VOICES });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const memorial = getMemorial(id);
  if (!memorial || !canManageMemorial(memorial, user.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") || "";

  /* ---------- B 档：音色复刻（multipart：样本 + 授权） ---------- */
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    if (form.get("consentAccepted") !== "true") {
      return NextResponse.json({ error: "consent_required" }, { status: 422 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
    if (!CLONE_MIME.has(file.type)) {
      return NextResponse.json({ error: "bad_request", detail: "wav_or_mp3_only" }, { status: 400 });
    }
    if (file.size > CLONE_MAX_BYTES) return NextResponse.json({ error: "audio_too_large" }, { status: 413 });

    let upload;
    try {
      upload = await saveUpload(file, "voice", true);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "upload_failed" }, { status: 400 });
    }
    const cloneId = uuid();
    db.prepare(
      `INSERT INTO voice_clones (id, memorial_id, user_id, sample_url, consent_accepted, review_status)
       VALUES (?, ?, ?, ?, 1, 'pending')`
    ).run(cloneId, id, user.id, upload.url);
    db.prepare(
      "UPDATE memorials SET voice_mode = 'clone', voice_handle = ?, voice_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run(cloneId, id);
    trackEvent("voice_clone_submit", { memorial_id: id }, user.id);
    return NextResponse.json({ cloneStatus: "pending" }, { status: 202 });
  }

  /* ---------- A 档：预置音色 / 描述生成（JSON，即存即效） ---------- */
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const mode = String(body.mode || "");

  if (mode === "preset") {
    const voice = String(body.voice || "").trim();
    if (!(PRESET_VOICES as readonly string[]).includes(voice)) {
      return NextResponse.json({ error: "unknown_voice" }, { status: 400 });
    }
    db.prepare(
      "UPDATE memorials SET voice_mode = 'preset', voice_handle = ?, voice_desc = '', voice_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run(voice, id);
    trackEvent("voice_profile_set", { memorial_id: id, mode: "preset" }, user.id);
  } else if (mode === "design") {
    const voiceDesc = String(body.voiceDesc || "").trim().slice(0, 100);
    if (!voiceDesc) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    const check = await moderateText(voiceDesc);
    if (!check.pass) return NextResponse.json({ error: "content_rejected" }, { status: 422 });
    db.prepare(
      "UPDATE memorials SET voice_mode = 'design', voice_handle = '', voice_desc = ?, voice_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run(voiceDesc, id);
    trackEvent("voice_profile_set", { memorial_id: id, mode: "design" }, user.id);
  } else if (mode === "none") {
    // 清除音色配置（回落默认音色）
    db.prepare(
      "UPDATE memorials SET voice_mode = '', voice_handle = '', voice_desc = '', voice_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run(id);
  } else {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const updated = getMemorial(id)!;
  return NextResponse.json({ ok: true, voiceProfile: voiceProfile(db, updated) });
}
