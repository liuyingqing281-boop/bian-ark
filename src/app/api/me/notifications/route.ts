import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";

// GET /api/me/notifications：通知列表（倒序上限 50）+ 未读数
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, kind, title, body, link, read, created_at
       FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 50`
    )
    .all(user.id) as Array<{
    id: string; kind: string; title: string; body: string; link: string;
    read: number; created_at: string;
  }>;
  const unread = db
    .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as { n: number };
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      link: r.link,
      read: !!r.read,
      createdAt: r.created_at,
    })),
    unread: unread.n,
  });
}
