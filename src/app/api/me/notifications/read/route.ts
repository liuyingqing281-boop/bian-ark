import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getDb } from "../../../../../lib/db";

// POST /api/me/notifications/read { ids: [] } —— 批量置读；空数组 = 全部已读
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 100)
    : [];
  const db = getDb();
  if (!ids.length) {
    db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").run(user.id);
  } else {
    const stmt = db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?");
    for (const id of ids) stmt.run(user.id, id);
  }
  return NextResponse.json({ ok: true });
}
