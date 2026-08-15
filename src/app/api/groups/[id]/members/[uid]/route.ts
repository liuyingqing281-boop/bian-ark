import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../../lib/auth";
import { getDb } from "../../../../../../lib/db";
import { groupRole } from "../../../../../../lib/permissions";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; uid: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, uid } = await params;
  if (groupRole(id, user.id) !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (uid === user.id) return NextResponse.json({ error: "owner_cannot_be_removed" }, { status: 400 });
  getDb().prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND role != 'owner'").run(id, uid);
  return NextResponse.json({ ok: true });
}
