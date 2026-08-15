import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";
import { saveUpload, deleteUpload } from "../../../lib/upload";
import { trackEvent } from "../../../lib/events";
import { moderateText } from "../../../lib/moderation";

const FREE_LIMITS: Record<string, number> = { image: 20, video: 2 };
const PREMIUM_LIMITS: Record<string, number> = { image: 200, video: 20 };

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const memorialId = String(formData.get("memorial_id") || "");
  const caption = String(formData.get("caption") || "").slice(0, 200);
  const db = getDb();
  const memorial = db.prepare("SELECT user_id FROM memorials WHERE id = ?").get(memorialId) as
    | { user_id: string }
    | undefined;
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (caption) {
    const moderation = await moderateText(caption);
    if (!moderation.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });
  }
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "no_files" }, { status: 400 });

  const limits = user.membership_tier === "premium" ? PREMIUM_LIMITS : FREE_LIMITS;
  const countRows = db
    .prepare("SELECT kind, COUNT(*) AS c FROM media WHERE memorial_id = ? GROUP BY kind")
    .all(memorialId) as { kind: string; c: number }[];
  const used: Record<string, number> = { image: 0, video: 0 };
  for (const row of countRows) used[row.kind] = row.c;

  const orderRow = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM media WHERE memorial_id = ?")
    .get(memorialId) as { max_order: number };
  let nextOrder = orderRow.max_order + 1;

  const saved: { id: string; url: string; thumbUrl: string; kind: string }[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const upload = await saveUpload(file, "media");
      if (used[upload.kind] >= limits[upload.kind]) {
        deleteUpload(upload.url);
        if (upload.thumbUrl !== upload.url) deleteUpload(upload.thumbUrl);
        errors.push(`${file.name}: quota_exceeded_${upload.kind}`);
        continue;
      }
      const id = uuid();
      const review = caption ? await moderateText(caption) : { pass: true, status: "approved" as const };
      db.prepare(
        `INSERT INTO media (id, memorial_id, user_id, kind, url, thumb_url, caption, sort_order, review_status, review_reason, object_key, mime, size_bytes, sha256)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, memorialId, user.id, upload.kind, upload.url, upload.thumbUrl, caption, nextOrder++, review.status, review.reason || "", upload.objectKey, upload.mime, upload.sizeBytes, upload.sha256);
      used[upload.kind] += 1;
      saved.push({ id, url: upload.url, thumbUrl: upload.thumbUrl, kind: upload.kind });
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : "upload_failed"}`);
    }
  }
  trackEvent("media_upload", { saved: saved.length, failed: errors.length }, user.id);
  return NextResponse.json({ ok: true, saved, errors });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const db = getDb();
  const media = db.prepare("SELECT id, user_id, url, thumb_url FROM media WHERE id = ?").get(id) as
    | { id: string; user_id: string; url: string; thumb_url: string }
    | undefined;
  if (!media) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (media.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  db.prepare("DELETE FROM media WHERE id = ?").run(id);
  deleteUpload(media.url);
  if (media.thumb_url && media.thumb_url !== media.url) deleteUpload(media.thumb_url);
  return NextResponse.json({ ok: true });
}
