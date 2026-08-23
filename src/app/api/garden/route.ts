import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 40);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, type, avatar_url, birth_date, death_date, epitaph, garden_section, garden_slot, created_at
       FROM memorials
       WHERE is_published = 1 AND visibility = 'public' AND in_garden = 1 AND name LIKE ?
       ORDER BY garden_slot ASC
       LIMIT 100`
    )
    .all(`%${q}%`);
  return NextResponse.json({ memorials: rows });
}