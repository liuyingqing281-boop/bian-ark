import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/auth";

// GET /api/halls/[id]/messages?memorialId= —— 全馆留言墙（docs/13 §5）
// 聚合馆内所有人物的留言，可按人物筛选；条目带归属标签「致 某某」。
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const hall = db.prepare("SELECT id, visibility, owner_user_id FROM halls WHERE id = ?").get(id) as
    | { id: string; visibility: string; owner_user_id: string }
    | undefined;
  if (!hall) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await getSessionUser();
  if (hall.visibility !== "public" && hall.owner_user_id !== user?.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const filter = req.nextUrl.searchParams.get("memorialId") || "";
  const rows = db
    .prepare(
      `SELECT msg.id, msg.msg_type, msg.content, msg.created_at, m.id AS memorial_id, m.name AS memorial_name
       FROM messages msg JOIN memorials m ON m.id = msg.memorial_id
       WHERE m.hall_id = ? AND m.is_published = 1
         AND (msg.review_status = 'approved' OR msg.review_status = '')
         ${filter ? "AND m.id = ?" : ""}
       ORDER BY msg.created_at DESC LIMIT 50`
    )
    .all(...(filter ? [id, filter] : [id])) as Array<{
    id: string; msg_type: string; content: string; created_at: string; memorial_id: string; memorial_name: string;
  }>;

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      msgType: r.msg_type,
      content: r.content,
      createdAt: r.created_at,
      memorialId: r.memorial_id,
      memorialName: r.memorial_name,
    })),
  });
}
