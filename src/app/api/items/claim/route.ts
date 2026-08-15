import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = String(body?.url || "");
  const prompt = String(body?.prompt || "").trim().slice(0, 100);
  const name = String(body?.name || "").trim().slice(0, 30) || prompt.slice(0, 30);
  if (!url.startsWith("/uploads/items/")) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO items (id, name, category, icon, image_url, style, owner_user_id, source, prompt, review_status)
     VALUES (?, ?, 'custom', '', ?, 'realistic', ?, 'ai', ?, 'approved')`
  ).run(id, name, url, user.id, prompt);
  return NextResponse.json({ ok: true, id });
}