import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/auth";
import { ensureAutomaticHallPosition, removeHallFromGarden } from "../../../../../lib/garden-position";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const memorial = db.prepare("SELECT id, hall_id, visibility FROM memorials WHERE id = ?").get(id) as
    | { id: string; hall_id: string; visibility: string }
    | undefined;
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const hallId = memorial.hall_id || `hall_${memorial.id}`;
  const hall = db.prepare("SELECT id, owner_user_id, visibility, garden_x, garden_y FROM halls WHERE id = ?").get(hallId) as
    | { id: string; owner_user_id: string; visibility: string; garden_x: number | null; garden_y: number | null }
    | undefined;
  if (!hall) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (hall.owner_user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

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
    const position = ensureAutomaticHallPosition(db, hall);
    if (!position) return NextResponse.json({ error: "no_space" }, { status: 409 });
    if (hall.visibility !== "public") {
      db.prepare("UPDATE halls SET visibility = 'public', updated_at = datetime('now') WHERE id = ?").run(hallId);
    }
    db.prepare("UPDATE memorials SET in_garden = 1, garden_slot = ?, garden_section = ?, updated_at = datetime('now') WHERE id = ?").run(slot, section, id);
    return NextResponse.json({ ok: true, in_garden: true, slot, section, hallId, inGarden: true, x: position.x, y: position.y });
  }
  db.prepare("UPDATE memorials SET in_garden = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  removeHallFromGarden(db, hallId);
  return NextResponse.json({ ok: true, in_garden: false, hallId, inGarden: false, x: null, y: null });
}
