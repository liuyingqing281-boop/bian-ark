import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";
import { canTributeMemorial, MemorialAccessRow } from "../../../lib/permissions";
import { moderateText } from "../../../lib/moderation";
import { trackEvent } from "../../../lib/events";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const memorial_id = formData.get("memorial_id") as string;
  const item_id = formData.get("item_id") as string;
  const rawLang = formData.get("lang") as string;
  const lang = rawLang === "en" ? "en" : "zh";

  if (!memorial_id) {
    return NextResponse.json({ error: "memorial_not_found" }, { status: 404 });
  }

  const db = getDb();
  const memorial = db
    .prepare("SELECT id, user_id, visibility FROM memorials WHERE id = ? AND is_published = 1")
    .get(memorial_id) as MemorialAccessRow | undefined;
  if (!memorial) {
    return NextResponse.json({ error: "memorial_not_found" }, { status: 404 });
  }

  const user = await getSessionUser();
  if (!canTributeMemorial(memorial, user?.id ?? null)) {
    return NextResponse.json({ error: "tribute_not_allowed" }, { status: 403 });
  }

  const sender_name =
    ((formData.get("sender_name") as string) || "").trim().slice(0, 40) ||
    user?.name ||
    (lang === "en" ? "Anonymous" : "匿名");
  const message = ((formData.get("message") as string) || "").slice(0, 500);
  const senderCheck = await moderateText(sender_name + " " + message);
  if (!senderCheck.pass) {
    return NextResponse.json({ error: "content_blocked" }, { status: 422 });
  }
  const is_burning = formData.get("is_burning") === "1" ? 1 : 0;
  const item = db.prepare("SELECT owner_user_id, review_status FROM items WHERE id = ?").get(item_id || "flower_white") as
    | { owner_user_id: string; review_status: string }
    | undefined;
  if (!item || (item.review_status !== "approved" && item.owner_user_id !== user?.id)) {
    return NextResponse.json({ error: "item_unavailable" }, { status: 400 });
  }

  const itemId = item_id || "flower_white";
  db.prepare(
    "INSERT INTO tributes (id, memorial_id, item_id, message, sender_name, is_burning, user_id, review_status, review_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuid(), memorial_id, itemId, message, sender_name, is_burning, user?.id || "", senderCheck.status, senderCheck.reason || "");
  // 北极星事件：每周有祭奠动作的馆数按此聚合
  trackEvent(
    "tribute_completed",
    { memorial_id, item_id: itemId, has_message: message ? 1 : 0, burning: is_burning, visibility: memorial.visibility },
    user?.id || ""
  );

  return NextResponse.json({ ok: true });
}
