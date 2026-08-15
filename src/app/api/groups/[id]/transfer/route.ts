import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getDb } from "../../../../../lib/db";
import { groupRole } from "../../../../../lib/permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (groupRole(id, user.id) !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const newOwnerId = String(body?.user_id || "");
  if (!newOwnerId || groupRole(id, newOwnerId) !== "member") return NextResponse.json({ error: "member_required" }, { status: 400 });
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?").run(id, user.id);
    db.prepare("UPDATE group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?").run(id, newOwnerId);
    db.prepare("UPDATE groups SET owner_user_id = ? WHERE id = ?").run(newOwnerId, id);
  })();
  return NextResponse.json({ ok: true });
}
