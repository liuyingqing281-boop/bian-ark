import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim().slice(0, 40);
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const db = getDb();
  const id = uuid();
  const inviteCode = randomBytes(4).toString("hex");
  db.prepare("INSERT INTO groups (id, name, owner_user_id, invite_code) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    user.id,
    inviteCode
  );
  db.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'owner')").run(id, user.id);
  return NextResponse.json({ ok: true, id, invite_code: inviteCode });
}