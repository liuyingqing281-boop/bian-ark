import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/auth";
import { moderateText } from "../../../../../lib/moderation";
import { trackEvent } from "../../../../../lib/events";

// POST /api/halls/[id]/offer-all —— 合祭「为全家点灯」（docs/13 §5）
// 一个动作对全馆 N 位各产生一条供奉记录（同一 batchId 关联，免费点灯）。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const hall = db.prepare("SELECT id, name, visibility, owner_user_id FROM halls WHERE id = ?").get(id) as
    | { id: string; name: string; visibility: string; owner_user_id: string }
    | undefined;
  if (!hall) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (hall.visibility !== "public" && hall.owner_user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const message = String((body as { message?: string })?.message || "").slice(0, 200);
  const senderName = (user.name || "匿名").slice(0, 40);
  const check = await moderateText(senderName + " " + message);
  if (!check.pass) return NextResponse.json({ error: "content_rejected" }, { status: 422 });

  const members = db
    .prepare("SELECT id FROM memorials WHERE hall_id = ? AND is_published = 1 ORDER BY created_at ASC LIMIT 6")
    .all(id) as Array<{ id: string }>;
  if (!members.length) return NextResponse.json({ error: "empty_hall" }, { status: 404 });

  const batchId = uuid();
  const insert = db.prepare(
    "INSERT INTO tributes (id, memorial_id, item_id, message, sender_name, is_burning, user_id, review_status, review_reason) VALUES (?, ?, 'candle', ?, ?, 1, ?, ?, ?)"
  );
  const tx = db.transaction(() => {
    for (const m of members) {
      insert.run(uuid(), m.id, message, senderName, user.id, check.status, check.reason || "");
    }
  });
  tx();
  trackEvent("offer_all", { hall_id: id, batch: batchId, count: members.length }, user.id);
  return NextResponse.json({ ok: true, count: members.length, batchId }, { status: 201 });
}
