import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { canViewMemorial } from "../../../lib/permissions";
import { moderateText } from "../../../lib/moderation";
import {
  MEMORY_SECTIONS,
  MAX_MEMORY_LENGTH,
  getMemorialForAccess,
  canManageMemorial,
  listMemories,
  createMemory,
  isMemorySection,
  MemoryRow,
} from "../../../lib/memories";

export async function GET(req: NextRequest) {
  const memorialId = req.nextUrl.searchParams.get("memorial_id");
  if (!memorialId) return NextResponse.json({ error: "missing memorial_id" }, { status: 400 });

  const memorial = getMemorialForAccess(memorialId);
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const user = await getSessionUser();
  if (!canViewMemorial(memorial, user?.id ?? null)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = listMemories(memorialId);
  const sections: Record<string, string[]> = {};
  for (const section of MEMORY_SECTIONS) sections[section] = [];
  for (const row of rows) {
    if (!sections[row.section]) sections[row.section] = [];
    sections[row.section].push(row.content);
  }
  return NextResponse.json({
    total: rows.length,
    sections,
    // 供前端增删改使用的完整条目（契约只增不减）
    entries: rows.map((r: MemoryRow) => ({
      id: r.id,
      section: r.section,
      content: r.content,
      source: r.source,
      created_at: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  let body: { memorial_id?: string; section?: string; content?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const memorialId = body.memorial_id;
  const content = (body.content || "").trim();
  if (!memorialId) return NextResponse.json({ error: "missing memorial_id" }, { status: 400 });
  if (!isMemorySection(body.section)) return NextResponse.json({ error: "invalid_section" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "empty_content" }, { status: 400 });
  if (content.length > MAX_MEMORY_LENGTH) return NextResponse.json({ error: "content_too_long" }, { status: 400 });

  const memorial = getMemorialForAccess(memorialId);
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const user = await getSessionUser();
  const userId = user?.id ?? null;
  const isManager = canManageMemorial(memorial, userId);
  const isChatSource = body.source === "chat";
  // 馆主/协作人可录入；普通登录用户仅允许对话闭环的「补充记忆」（source=chat）
  if (!isManager) {
    if (!userId || !isChatSource || !canViewMemorial(memorial, userId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const check = await moderateText(content);
  if (!check.pass) return NextResponse.json({ error: "content_rejected" }, { status: 422 });

  const id = createMemory({
    memorial_id: memorialId,
    user_id: userId || "",
    section: body.section,
    content,
    source: isManager && !isChatSource ? "manual" : "chat",
    review_status: check.status,
    review_reason: check.reason || "",
  });
  return NextResponse.json({ id }, { status: 201 });
}
