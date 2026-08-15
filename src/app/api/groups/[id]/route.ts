import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import { groupRole } from "../../../../lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const role = groupRole(id, user.id);
  if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = getDb();
  const group = db.prepare("SELECT id, name, invite_code, owner_user_id, created_at FROM groups WHERE id = ?").get(id);
  if (!group) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const members = role === "owner"
    ? db.prepare(`SELECT u.id, u.name, u.email, gm.role, gm.joined_at
                  FROM group_members gm JOIN users u ON u.id = gm.user_id
                  WHERE gm.group_id = ? ORDER BY gm.role DESC, gm.joined_at`).all(id)
    : [];
  return NextResponse.json({ group: role === "owner" ? group : { ...group, invite_code: undefined }, role, members });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (groupRole(id, user.id) !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM memorial_groups WHERE group_id = ?").run(id);
    db.prepare("DELETE FROM group_members WHERE group_id = ?").run(id);
    db.prepare("DELETE FROM groups WHERE id = ?").run(id);
  })();
  return NextResponse.json({ ok: true });
}
