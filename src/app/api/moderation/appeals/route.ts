import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSessionUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const resourceType = String(body?.resource_type || "");
  const resourceId = String(body?.resource_id || "");
  const reason = String(body?.reason || "").trim();
  const tables: Record<string, string> = { media: "media", item: "items", digital_human: "digital_humans" };
  const table = tables[resourceType];
  if (!table || !resourceId || reason.length < 5 || reason.length > 500) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const owned = getDb().prepare(`SELECT 1 FROM ${table} WHERE id = ? AND ${table === "items" ? "owner_user_id" : "user_id"} = ?`)
    .get(resourceId, user.id);
  if (!owned) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const id = uuid();
  getDb().prepare("INSERT INTO moderation_appeals (id, resource_type, resource_id, user_id, reason) VALUES (?, ?, ?, ?, ?)")
    .run(id, resourceType, resourceId, user.id, reason);
  return NextResponse.json({ ok: true, id });
}
