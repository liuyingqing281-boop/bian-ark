import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";
import { moderateText } from "../../../lib/moderation";
import { canViewMemorial, MemorialAccessRow } from "../../../lib/permissions";

// GET：生平时间线（F2 TimelineItem[]）。公开馆游客可读。
export async function GET(req: NextRequest) {
  const memorialId =
    req.nextUrl.searchParams.get("memorialId") || req.nextUrl.searchParams.get("memorial_id") || "";
  if (!memorialId) return NextResponse.json({ error: "missing memorialId" }, { status: 400 });

  const db = getDb();
  const memorial = db
    .prepare("SELECT id, user_id, visibility FROM memorials WHERE id = ? AND is_published = 1")
    .get(memorialId) as MemorialAccessRow | undefined;
  const user = await getSessionUser();
  if (!memorial || !canViewMemorial(memorial, user?.id ?? null)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rows = db
    .prepare(
      `SELECT le.id, le.year, le.title, le.description, COALESCE(m.url, '') AS image_url
       FROM life_events le
       LEFT JOIN media m ON m.id = le.media_id
       WHERE le.memorial_id = ?
       ORDER BY le.year ASC, le.sort_order ASC`
    )
    .all(memorialId) as Array<{ id: string; year: string; title: string; description: string; image_url: string }>;

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      year: r.year,
      title: r.title,
      description: r.description,
      imageUrl: r.image_url || null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const memorialId = String(body?.memorial_id || "");
  const year = String(body?.year || "").trim().slice(0, 20);
  const title = String(body?.title || "").trim().slice(0, 80);
  const description = String(body?.description || "").trim().slice(0, 300);
  if (!year || !title) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const db = getDb();
  const memorial = db.prepare("SELECT user_id FROM memorials WHERE id = ?").get(memorialId) as
    | { user_id: string }
    | undefined;
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const moderation = await moderateText(`${year} ${title} ${description}`);
  if (!moderation.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

  const count = db.prepare("SELECT COUNT(*) AS c FROM life_events WHERE memorial_id = ?").get(memorialId) as {
    c: number;
  };
  if (count.c >= 50) return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });

  const id = uuid();
  db.prepare(
    "INSERT INTO life_events (id, memorial_id, user_id, year, title, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, memorialId, user.id, year, title, description, count.c + 1);
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const db = getDb();
  const event = db.prepare("SELECT user_id FROM life_events WHERE id = ?").get(id) as
    | { user_id: string }
    | undefined;
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (event.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  db.prepare("DELETE FROM life_events WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}