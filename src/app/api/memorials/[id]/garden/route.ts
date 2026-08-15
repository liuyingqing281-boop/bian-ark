import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const memorial = db.prepare("SELECT id, user_id, visibility FROM memorials WHERE id = ?").get(id) as
    | { id: string; user_id: string; visibility: string }
    | undefined;
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const place = body?.in_garden === true;
  if (place) {
    if (memorial.visibility !== "public") {
      return NextResponse.json({ error: "visibility_required" }, { status: 400 });
    }
    const row = db
      .prepare("SELECT COALESCE(MAX(garden_slot), 0) AS max_slot FROM memorials WHERE in_garden = 1")
      .get() as { max_slot: number };
    const slot = row.max_slot + 1;
    const section = String(Math.floor((slot - 1) / 30));
    db.prepare("UPDATE memorials SET in_garden = 1, garden_slot = ?, garden_section = ?, updated_at = datetime('now') WHERE id = ?").run(slot, section, id);
    return NextResponse.json({ ok: true, in_garden: true, slot, section });
  }
  db.prepare("UPDATE memorials SET in_garden = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  return NextResponse.json({ ok: true, in_garden: false });
}