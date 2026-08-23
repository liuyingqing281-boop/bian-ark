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

  // 游标分页（M4）：默认返回最新 50 条（按时间升序返回）+ hasMore/nextCursor；
  // before=<createdAt> 继续向更早翻页。limit 上限 200。
  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
  const before = req.nextUrl.searchParams.get("before");

  const baseSql = `SELECT role, content, evidence_memory_id, created_at
       FROM chat_messages
       WHERE memorial_id = ? AND user_id = ?${before ? " AND created_at < ?" : ""}
       ORDER BY created_at DESC, rowid DESC
       LIMIT ?`;
  const args: unknown[] = before ? [memorialId, user.id, before, limit + 1] : [memorialId, user.id, limit + 1];

  const desc = getDb().prepare(baseSql).all(...(args as string[])) as Array<{
    role: string;
    content: string;
    evidence_memory_id: string | null;
    created_at: string;
  }>;

  const hasMore = desc.length > limit;
  const page = desc.slice(0, limit).reverse(); // 升序返回，直接可渲染
  const nextCursor = hasMore ? page[0]?.created_at ?? null : null;

  return NextResponse.json({
    items: page.map(toChatHistoryItem),
    hasMore,
    nextCursor,
  });
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
