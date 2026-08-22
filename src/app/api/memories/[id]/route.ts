import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { moderateText } from "../../../../lib/moderation";
import {
  MAX_MEMORY_LENGTH,
  getMemorialForAccess,
  canManageMemorial,
  getMemory,
  updateMemory,
  deleteMemory,
} from "../../../../lib/memories";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memory = getMemory(id);
  if (!memory) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const memorial = getMemorialForAccess(memory.memorial_id);
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const user = await getSessionUser();
  if (!canManageMemorial(memorial, user?.id ?? null)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const content = (body.content || "").trim();
  if (!content) return NextResponse.json({ error: "empty_content" }, { status: 400 });
  if (content.length > MAX_MEMORY_LENGTH) return NextResponse.json({ error: "content_too_long" }, { status: 400 });

  const check = await moderateText(content);
  if (!check.pass) return NextResponse.json({ error: "content_rejected" }, { status: 422 });

  updateMemory(id, content);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const memory = getMemory(id);
  if (!memory) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const memorial = getMemorialForAccess(memory.memorial_id);
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const user = await getSessionUser();
  if (!canManageMemorial(memorial, user?.id ?? null)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  deleteMemory(id);
  return NextResponse.json({ ok: true });
}
