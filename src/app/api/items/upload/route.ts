import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { saveUpload, isImageMime } from "../../../../lib/upload";
import { moderateText } from "../../../../lib/moderation";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const name = String(formData.get("name") || "").trim().slice(0, 30);
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (!isImageMime(file.type)) return NextResponse.json({ error: "image_only" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const moderation = await moderateText(name);
  if (!moderation.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

  try {
    const upload = await saveUpload(file, "items");
    const db = getDb();
    const id = uuid();
    db.prepare(
      `INSERT INTO items (id, name, category, icon, image_url, style, owner_user_id, source, prompt, review_status)
       VALUES (?, ?, 'custom', '', ?, 'realistic', ?, 'upload', '', ?)`
    ).run(id, name, upload.url, user.id, moderation.status);
    return NextResponse.json({ ok: true, id, url: upload.url, thumbUrl: upload.thumbUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload_failed" },
      { status: 400 }
    );
  }
}
