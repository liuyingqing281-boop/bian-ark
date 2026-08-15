import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getDb } from "../../../../../lib/db";
import { groupRole } from "../../../../../lib/permissions";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (groupRole(id, user.id) !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const inviteCode = randomBytes(8).toString("hex");
  getDb().prepare("UPDATE groups SET invite_code = ? WHERE id = ?").run(inviteCode, id);
  return NextResponse.json({ ok: true, invite_code: inviteCode });
}
