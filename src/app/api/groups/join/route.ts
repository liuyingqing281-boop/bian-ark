import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { trackEvent } from "../../../../lib/events";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const inviteCode = String(body?.invite_code || "").trim();
  if (!inviteCode) return NextResponse.json({ error: "invalid_invite" }, { status: 400 });

  const db = getDb();
  const group = db.prepare("SELECT id, name FROM groups WHERE invite_code = ?").get(inviteCode) as
    | { id: string; name: string }
    | undefined;
  if (!group) return NextResponse.json({ error: "invalid_invite" }, { status: 404 });

  const joined = db
    .prepare("INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')")
    .run(group.id, user.id);
  if (joined.changes > 0) {
    trackEvent("group_joined", { group_id: group.id }, user.id);
  }
  return NextResponse.json({ ok: true, group_id: group.id, name: group.name });
}