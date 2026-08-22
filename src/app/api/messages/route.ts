import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { canViewMemorial } from "../../../lib/permissions";
import { moderateText } from "../../../lib/moderation";
import {
  MAX_MESSAGE_LENGTH,
  isMessageType,
  listVisibleMessages,
  createMessage,
} from "../../../lib/messages";
import { getMemorialForAccess } from "../../../lib/memories";

export async function GET(req: NextRequest) {
  const memorialId = req.nextUrl.searchParams.get("memorial_id");
  if (!memorialId) return NextResponse.json({ error: "missing memorial_id" }, { status: 400 });

  const memorial = getMemorialForAccess(memorialId);
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const user = await getSessionUser();
  if (!canViewMemorial(memorial, user?.id ?? null)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rows = listVisibleMessages(memorialId, user?.id ?? null);
  return NextResponse.json({
    items: rows.map((r) => ({ id: r.id, msg_type: r.msg_type, content: r.content, created_at: r.created_at })),
  });
}

export async function POST(req: NextRequest) {
  let body: { memorial_id?: string; msg_type?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const memorialId = body.memorial_id;
  const content = (body.content || "").trim();
  if (!memorialId) return NextResponse.json({ error: "missing memorial_id" }, { status: 400 });
  if (!isMessageType(body.msg_type)) return NextResponse.json({ error: "invalid_msg_type" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "empty_content" }, { status: 400 });
  if (content.length > MAX_MESSAGE_LENGTH) return NextResponse.json({ error: "content_too_long" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const memorial = getMemorialForAccess(memorialId);
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!canViewMemorial(memorial, user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const check = await moderateText(content);
  if (!check.pass) return NextResponse.json({ error: "content_rejected" }, { status: 422 });

  const id = createMessage({
    memorial_id: memorialId,
    user_id: user.id,
    msg_type: body.msg_type,
    content,
    review_status: check.status,
    review_reason: check.reason || "",
  });
  return NextResponse.json({ id }, { status: 201 });
}
