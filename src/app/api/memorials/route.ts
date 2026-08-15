import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";

const VALID_TYPES = new Set(["person", "pet", "other"]);

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = String(body?.name || "").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  const type = VALID_TYPES.has(body?.type) ? body.type : "person";

  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO memorials (id, name, type, birth_date, death_date, epitaph, biography, user_id, visibility, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'private', 1)`
  ).run(
    id,
    name,
    type,
    String(body?.birth_date || "").slice(0, 20),
    String(body?.death_date || "").slice(0, 20),
    String(body?.epitaph || "").slice(0, 200),
    String(body?.biography || "").slice(0, 10000),
    user.id
  );
  return NextResponse.json({ ok: true, id });
}