import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { getDb } from "../../../lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const memorials = db
    .prepare("SELECT id, name, type, visibility, created_at FROM memorials WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id);
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.invite_code, gm.role,
         (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
       FROM groups g JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ? ORDER BY g.created_at DESC`
    )
    .all(user.id);
  // hasPassword（docs/08 §3.0）：是否已设密码，「账号与安全」展示用
  const pwRow = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as
    | { password_hash: string }
    | undefined;
  return NextResponse.json({ user: { ...user, hasPassword: Boolean(pwRow?.password_hash) }, memorials, groups });
}