import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";
import { saveUpload, deleteUpload } from "../../../lib/upload";
import { activeProvider, startDigitalHumanJob } from "../../../lib/digitalhuman";
import { trackEvent } from "../../../lib/events";
import { moderateText } from "../../../lib/moderation";

const SCRIPT_MAX = 500;

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memorialId = req.nextUrl.searchParams.get("memorial_id") || "";
  const db = getDb();
  const memorial = db.prepare("SELECT user_id FROM memorials WHERE id = ?").get(memorialId) as
    | { user_id: string }
    | undefined;
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const tasks = db
    .prepare(
      "SELECT id, status, script, result_video_url, error, provider, created_at, updated_at FROM digital_humans WHERE memorial_id = ? ORDER BY created_at DESC"
    )
    .all(memorialId);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const memorialId = String(formData.get("memorial_id") || "");
  const consent = formData.get("consent") === "1";
  const useBiography = formData.get("use_biography") === "1";
  let script = String(formData.get("script") || "").trim().slice(0, SCRIPT_MAX);

  const db = getDb();
  const memorial = db.prepare("SELECT user_id, biography FROM memorials WHERE id = ?").get(memorialId) as
    | { user_id: string; biography: string }
    | undefined;
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (user.membership_tier !== "premium") {
    return NextResponse.json({ error: "premium_only" }, { status: 403 });
  }
  if (!consent) return NextResponse.json({ error: "consent_required" }, { status: 400 });

  if (useBiography) script = (memorial.biography || "").slice(0, SCRIPT_MAX);
  if (!script) return NextResponse.json({ error: "script_required" }, { status: 400 });
  const moderation = await moderateText(script);
  if (!moderation.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

  const existing = db
    .prepare("SELECT COUNT(*) AS c FROM digital_humans WHERE memorial_id = ? AND status != 'failed'")
    .get(memorialId) as { c: number };
  if (existing.c >= 1) {
    const credit = db
      .prepare("SELECT id FROM dh_redo_credits WHERE memorial_id = ? AND user_id = ? AND used = 0 ORDER BY created_at ASC LIMIT 1")
      .get(memorialId, user.id) as { id: string } | undefined;
    if (!credit) return NextResponse.json({ error: "quota_used" }, { status: 409 });
    db.prepare("UPDATE dh_redo_credits SET used = 1 WHERE id = ?").run(credit.id);
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: "photo_required" }, { status: 400 });
  }

  const saved: string[] = [];
  try {
    const photoUp = await saveUpload(photo, "digitalhuman");
    if (photoUp.kind !== "image") throw new Error("photo_must_be_image");
    saved.push(photoUp.url);
    if (photoUp.thumbUrl !== photoUp.url) saved.push(photoUp.thumbUrl);

    let audioUrl = "";
    const audio = formData.get("audio");
    if (audio instanceof File && audio.size > 0) {
      const audioUp = await saveUpload(audio, "digitalhuman", true);
      if (audioUp.kind !== "audio") throw new Error("audio_must_be_audio");
      audioUrl = audioUp.url;
      saved.push(audioUrl);
    }

    let videoUrl = "";
    const video = formData.get("video");
    if (video instanceof File && video.size > 0) {
      const videoUp = await saveUpload(video, "digitalhuman");
      if (videoUp.kind !== "video") throw new Error("video_must_be_video");
      videoUrl = videoUp.url;
      saved.push(videoUrl);
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO digital_humans (id, memorial_id, user_id, status, photo_url, audio_url, video_url, script, provider, consent_accepted)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, 1)`
    ).run(id, memorialId, user.id, photoUp.url, audioUrl, videoUrl, script, activeProvider());
    startDigitalHumanJob(id);
    trackEvent("dh_create", { provider: activeProvider() }, user.id);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    for (const url of saved) deleteUpload(url);
    const message = err instanceof Error ? err.message : "upload_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}