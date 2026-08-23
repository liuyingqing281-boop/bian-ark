import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

// G6 混合纪念流：tributes ∪ messages(public/eulogy)，统一结构，sender 展示层打码
// 打码规则：「李**」（仅保留首字符），库内存原文
function maskName(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "访客";
  return n.slice(0, 1) + "**";
}

interface FeedItem {
  kind: "tribute" | "message";
  icon: string;
  label: string;
  senderMasked: string;
  message: string;
  isBurning: boolean;
  createdAt: string;
}

const MESSAGE_META: Record<string, { icon: string; label: string }> = {
  public: { icon: "💬", label: "留下思念" },
  eulogy: { icon: "🕯️", label: "写下悼文" },
};

export async function GET(req: NextRequest) {
  const memorialId = req.nextUrl.searchParams.get("memorial_id");
  if (!memorialId) {
    return NextResponse.json({ items: [] });
  }

  const db = getDb();
  const memorial = db
    .prepare("SELECT id FROM memorials WHERE id = ? AND is_published = 1")
    .get(memorialId);
  if (!memorial) {
    return NextResponse.json({ items: [] });
  }

  const tributeRows = db
    .prepare(
      `SELECT t.message, t.sender_name, t.is_burning, t.created_at,
              COALESCE(i.icon, '🌸') AS icon, COALESCE(i.name, '心意') AS item_name
       FROM tributes t
       LEFT JOIN items i ON i.id = t.item_id
       WHERE t.memorial_id = ? AND t.review_status = 'approved'
       ORDER BY t.created_at DESC
       LIMIT 100`
    )
    .all(memorialId) as Array<{
    message: string;
    sender_name: string;
    is_burning: number;
    created_at: string;
    icon: string;
    item_name: string;
  }>;

  const messageRows = db
    .prepare(
      `SELECT m.content, m.msg_type, m.created_at, COALESCE(u.name, '') AS sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.memorial_id = ? AND m.msg_type IN ('public', 'eulogy') AND m.review_status = 'approved'
       ORDER BY m.created_at DESC
       LIMIT 100`
    )
    .all(memorialId) as Array<{
    content: string;
    msg_type: string;
    created_at: string;
    sender_name: string;
  }>;

  const items: FeedItem[] = [
    ...tributeRows.map((r): FeedItem => ({
      kind: "tribute",
      icon: r.icon,
      label: `献上${r.item_name}`,
      senderMasked: maskName(r.sender_name),
      message: r.message || "",
      isBurning: r.is_burning === 1,
      createdAt: r.created_at,
    })),
    ...messageRows.map((r): FeedItem => {
      const meta = MESSAGE_META[r.msg_type] || MESSAGE_META.public;
      return {
        kind: "message",
        icon: meta.icon,
        label: meta.label,
        senderMasked: maskName(r.sender_name),
        message: r.content,
        isBurning: false,
        createdAt: r.created_at,
      };
    }),
  ];

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // 游标分页（M4）：cursor = 上一页最后一条 createdAt；默认 limit 50 保持原行为
  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 100);
  const cursor = req.nextUrl.searchParams.get("cursor");

  const filtered = cursor ? items.filter((it) => it.createdAt < cursor) : items;
  const pageItems = filtered.slice(0, limit);
  const nextCursor = filtered.length > limit ? pageItems[pageItems.length - 1]?.createdAt ?? null : null;

  return NextResponse.json({ items: pageItems, nextCursor });
}
