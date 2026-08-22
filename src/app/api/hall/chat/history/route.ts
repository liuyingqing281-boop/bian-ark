import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/auth";
import { canViewMemorial, MemorialAccessRow } from "../../../../../lib/permissions";
import { toChatHistoryItem, pickId } from "../../../../../lib/view-models";

// 对话历史（F5）：仅本人可见，游客恒空；DELETE = 04 屏 ⋯ 菜单「清空对话」
function getMemorial(memorialId: string): MemorialAccessRow | undefined {
  return getDb()
    .prepare("SELECT id, user_id, visibility FROM memorials WHERE id = ? AND is_published = 1")
    .get(memorialId) as MemorialAccessRow | undefined;
}

export async function GET(req: NextRequest) {
  const memorialId = pickId(
    req.nextUrl.searchParams.get("memorialId"),
    req.nextUrl.searchParams.get("memorial_id")
  );
  if (!memorialId) return NextResponse.json({ error: "missing memorialId" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ items: [] }); // 游客不持久化，恒空

  const memorial = getMemorial(memorialId);
  if (!memorial || !canViewMemorial(memorial, user.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rows = getDb()
    .prepare(
      `SELECT role, content, evidence_memory_id, created_at
       FROM chat_messages
       WHERE memorial_id = ? AND user_id = ?
       ORDER BY created_at ASC, rowid ASC
       LIMIT 500`
    )
    .all(memorialId, user.id) as Array<{
    role: string;
    content: string;
    evidence_memory_id: string | null;
    created_at: string;
  }>;

  return NextResponse.json({ items: rows.map(toChatHistoryItem) });
}

export async function DELETE(req: NextRequest) {
  const memorialId = pickId(
    req.nextUrl.searchParams.get("memorialId"),
    req.nextUrl.searchParams.get("memorial_id")
  );
  if (!memorialId) return NextResponse.json({ error: "missing memorialId" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const memorial = getMemorial(memorialId);
  if (!memorial || !canViewMemorial(memorial, user.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  getDb()
    .prepare("DELETE FROM chat_messages WHERE memorial_id = ? AND user_id = ?")
    .run(memorialId, user.id);
  return new NextResponse(null, { status: 204 });
}
