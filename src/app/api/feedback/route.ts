import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "../../../lib/auth";
import { getDb } from "../../../lib/db";
import { moderateText } from "../../../lib/moderation";

// POST /api/feedback { content(≤500,必填), contact?(≤100) } → 201 { id }
// 过文本审核；需登录；同用户 60s 限频。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const content = String(body?.content || "").trim();
  const contact = String(body?.contact || "").trim().slice(0, 100);
  if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });
  if (content.length > 500) {
    return NextResponse.json({ error: "field_too_long", field: "content", limit: 500 }, { status: 400 });
  }

  const db = getDb();
  const recent = db
    .prepare(
      "SELECT id FROM feedback WHERE user_id = ? AND created_at >= datetime('now', '-60 seconds') LIMIT 1"
    )
    .get(user.id);
  if (recent) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const moderation = await moderateText([content, contact].filter(Boolean).join(" "));
  if (!moderation.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

  const id = uuid();
  db.prepare(
    "INSERT INTO feedback (id, user_id, content, contact, review_status) VALUES (?, ?, ?, ?, ?)"
  ).run(id, user.id, content, contact, moderation.status);
  return NextResponse.json({ id }, { status: 201 });
}
