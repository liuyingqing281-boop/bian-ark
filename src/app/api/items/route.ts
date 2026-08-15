import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") || "official";
  const db = getDb();
  if (scope === "mine") {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const items = db
      .prepare("SELECT * FROM items WHERE owner_user_id = ? ORDER BY rowid DESC")
      .all(user.id);
    return NextResponse.json({ items });
  }
  const items = db
    .prepare("SELECT * FROM items WHERE owner_user_id = '' AND review_status = 'approved' ORDER BY is_premium ASC, sort_order ASC")
    .all();
  return NextResponse.json({ items });
}