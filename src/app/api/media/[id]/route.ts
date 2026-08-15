import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import { moderateText } from "../../../../lib/moderation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const media = db.prepare("SELECT memorial_id, user_id FROM media WHERE id = ?").get(id) as
    | { memorial_id: string; user_id: string }
    | undefined;
  if (!media) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (media.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const caption = body.caption === undefined ? undefined : String(body.caption).trim();
  if (caption !== undefined && caption.length > 200) {
    return NextResponse.json({ error: "caption_too_long" }, { status: 400 });
  }
  const sortOrder = body.sort_order === undefined ? undefined : Number(body.sort_order);
  if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000)) {
    return NextResponse.json({ error: "invalid_sort_order" }, { status: 400 });
  }
  const review = caption === undefined ? null : await moderateText(caption);
  if (review && !review.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });
  db.transaction(() => {
    if (caption !== undefined) {
      db.prepare("UPDATE media SET caption = ?, review_status = ?, review_reason = ? WHERE id = ?")
        .run(caption, review!.status, review!.reason || "", id);
    }
    if (sortOrder !== undefined) db.prepare("UPDATE media SET sort_order = ? WHERE id = ?").run(sortOrder, id);
    if (body.is_cover === true) {
      db.prepare("UPDATE media SET is_cover = 0 WHERE memorial_id = ?").run(media.memorial_id);
      db.prepare("UPDATE media SET is_cover = 1 WHERE id = ?").run(id);
    } else if (body.is_cover === false) {
      db.prepare("UPDATE media SET is_cover = 0 WHERE id = ?").run(id);
    }
  })();
  return NextResponse.json({ ok: true });
}
