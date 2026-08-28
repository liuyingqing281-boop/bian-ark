import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

// GET /api/garden/starsea?zone=&bbox= —— 星海分片数据源（docs/08 §3.13 F8 GardenSeaView）
// 仅 in_garden=1 且 public 的馆；bbox=x1,y1,x2,y2 视口分片；zone=public|family|official。
// constellationOf 恒 null（家族星座连线待 M4 祠堂由族谱推导）。
// 红线：无访问量/热度/排行字段；名人星域仅"略亮"由平台后台写入 zone。
export async function GET(req: NextRequest) {
  const zoneRaw = req.nextUrl.searchParams.get("zone");
  if (zoneRaw !== null && !["public", "family", "official"].includes(zoneRaw)) {
    return NextResponse.json({ error: "invalid_zone" }, { status: 400 });
  }
  const zone = zoneRaw || null;
  const bboxRaw = req.nextUrl.searchParams.get("bbox");
  let bbox: [number, number, number, number] | null = null;
  if (bboxRaw !== null) {
    const values = bboxRaw.split(",").map(Number);
    if (values.length !== 4 || !values.every(Number.isFinite) || values[0] < 0 || values[0] > values[2] || values[2] > 1 || values[1] < 0 || values[1] > values[3] || values[3] > 1) {
      return NextResponse.json({ error: "invalid_bbox" }, { status: 400 });
    }
    bbox = values as [number, number, number, number];
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const parsedLimit = limitRaw === null ? 200 : Number(limitRaw);
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) return NextResponse.json({ error: "invalid_limit" }, { status: 400 });
  const limit = Math.min(parsedLimit, 500);
  const cursor = req.nextUrl.searchParams.get("cursor") || null;

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT h.id AS hall_id, h.name AS hall_name, h.garden_x AS x, h.garden_y AS y, h.garden_zone AS zone,
              (SELECT COUNT(*) FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public') AS lamp_count,
              (SELECT m.name FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public' ORDER BY m.created_at ASC LIMIT 1) AS first_name,
              (SELECT m.avatar_url FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public' ORDER BY m.created_at ASC LIMIT 1) AS avatar_url,
              (SELECT m.birth_date FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public' ORDER BY m.created_at ASC LIMIT 1) AS birth_date,
              (SELECT m.death_date FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public' ORDER BY m.created_at ASC LIMIT 1) AS death_date,
              (SELECT m.epitaph FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public' ORDER BY m.created_at ASC LIMIT 1) AS epitaph,
              EXISTS(SELECT 1 FROM memorials m JOIN tributes t ON t.memorial_id = m.id
                     WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public' AND t.created_at >= datetime('now', '-24 hours')) AS candle_lit
       FROM halls h
       WHERE h.in_garden = 1 AND h.visibility = 'public' AND h.garden_x IS NOT NULL AND h.garden_y IS NOT NULL
         AND EXISTS (SELECT 1 FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public')
         ${zone ? "AND h.garden_zone = ?" : ""}
         ${bbox ? "AND h.garden_x BETWEEN ? AND ? AND h.garden_y BETWEEN ? AND ?" : ""}
         ${cursor ? "AND h.id > ?" : ""}
       ORDER BY h.id ASC
       LIMIT ?`
    )
    .all(...(zone ? [zone] : []), ...(bbox ? [bbox[0], bbox[2], bbox[1], bbox[3]] : []), ...(cursor ? [cursor] : []), limit + 1) as Array<{
    hall_id: string; hall_name: string; x: number; y: number; zone: string;
    lamp_count: number; first_name: string; avatar_url: string;
    birth_date: string; death_date: string; epitaph: string; candle_lit: number;
  }>;

  const mask = (name: string) => (name.length <= 1 ? "*" : name[0] + "*".repeat(Math.min(name.length - 1, 2)));
  const emitted = rows.slice(0, limit);
  const body = {
    halls: emitted.map((r) => ({
      hallId: r.hall_id,
      nameMasked: r.lamp_count > 1 ? mask(r.hall_name) : mask(r.first_name || r.hall_name),
      x: r.x,
      y: r.y,
      zone: r.zone || "public",
      lampCount: r.lamp_count,
      candleLit: !!r.candle_lit,
      avatarUrl: r.avatar_url || "",
      birthDate: r.birth_date || "",
      deathDate: r.death_date || "",
      epitaph: r.epitaph || "",
      constellationOf: null,
    })),
    nextCursor: rows.length > limit ? emitted.at(-1)?.hall_id ?? null : null,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=15" } });
}
