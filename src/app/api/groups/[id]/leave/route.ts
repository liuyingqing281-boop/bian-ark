import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getDb } from "../../../../../lib/db";
import { groupRole } from "../../../../../lib/permissions";
import { insertNotification } from "../../../../../lib/notify";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const role = groupRole(id, user.id);
  if (!role) return NextResponse.json({ error: "not_member" }, { status: 404 });
  if (role === "owner") return NextResponse.json({ error: "transfer_or_delete_required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(id, user.id);
  const group = db.prepare("SELECT name, owner_user_id FROM groups WHERE id = ?").get(id) as
    | { name: string; owner_user_id: string }
    | undefined;
  if (group) {
    const displayName = (user.name || user.phone || user.email || "一位亲友").trim();
    insertNotification(group.owner_user_id, "collab", `${displayName} 退出了「${group.name}」`);
  }
  return NextResponse.json({ ok: true });
}
