import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "../../../../lib/db";
import { SESSION_COOKIE } from "../../../../lib/admin-guard";

// GET /api/garden/starsea?zone=&bbox= —— 星海分片数据源（docs/08 §3.13 F8 GardenSeaView）
// in_garden=1 的馆按可见性输出：
// - public 馆：对所有访客可见（对外口径不变）
// - 私有馆（2026-09-07 产品变更）：仅随请求会话叠加——馆主本人可见自己的私有星点，
//   匿名/他人请求看不到（WHERE 用 owner_user_id 关联，无泄露面）
// 其余字段语义不变：bbox=x1,y1,x2,y2 视口分片；zone=public|family|official。
// constellationOf 恒 null（家族星座连线待 M4 祠堂由族谱推导）。
// 红线：无访问量/热度/排行字段；名人星域仅"略亮"由平台后台写入 zone。
// 日志卫生（Task 8 Step 5 / Fix Round 1 收紧）：生产环境零日志；开发环境字段
// 枚举 = request id（UUID 前 8 位）/ 耗时 ms / 错误码（仅失败路径），
// 不含用户/馆标识，不携带返回条数等额外诊断。
function devLog(fields: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  console.debug("[starsea]", JSON.stringify(fields));
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const reqId = randomUUID().slice(0, 8);
  const zoneRaw = req.nextUrl.searchParams.get("zone");
  if (zoneRaw !== null && !["public", "family", "official"].includes(zoneRaw)) {
    devLog({ req: reqId, ms: Date.now() - startedAt, code: "invalid_zone" });
    return NextResponse.json({ error: "invalid_zone" }, { status: 400 });
  }
  const zone = zoneRaw || null;
  const bboxRaw = req.nextUrl.searchParams.get("bbox");
  let bbox: [number, number, number, number] | null = null;
  if (bboxRaw !== null) {
    const values = bboxRaw.split(",").map(Number);
    if (values.length !== 4 || !values.every(Number.isFinite) || values[0] < 0 || values[0] > values[2] || values[2] > 1 || values[1] < 0 || values[1] > values[3] || values[3] > 1) {
      devLog({ req: reqId, ms: Date.now() - startedAt, code: "invalid_bbox" });
      return NextResponse.json({ error: "invalid_bbox" }, { status: 400 });
    }
    bbox = values as [number, number, number, number];
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const parsedLimit = limitRaw === null ? 200 : Number(limitRaw);
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    devLog({ req: reqId, ms: Date.now() - startedAt, code: "invalid_limit" });
    return NextResponse.json({ error: "invalid_limit" }, { status: 400 });
  }
  const limit = Math.min(parsedLimit, 500);
  const cursor = req.nextUrl.searchParams.get("cursor") || null;

  const db = getDb();

  // 会话解析（仅当带 cookie 时才查库一次；匿名路径零额外开销、行为与旧版完全一致）。
  // 不做滑动续期（真正续期走业务 API），避免星海热路径写库。
  let uid: string | null = null;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const srow = db
      .prepare("SELECT s.expires_at AS exp, u.id AS uid FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?")
      .get(token) as { uid: string; exp: string } | undefined;
    if (srow && new Date(srow.exp.replace(" ", "T") + "Z").getTime() >= Date.now()) uid = srow.uid;
  }

  // public 馆全可见；有会话时再叠加馆主自己的私有馆（访客语义不变）
  const memVis = uid ? "(m.visibility = 'public' OR h.owner_user_id = @uid)" : "m.visibility = 'public'";
  const hallVis = uid ? "(h.visibility = 'public' OR h.owner_user_id = @uid)" : "h.visibility = 'public'";
  const sql = `
    SELECT h.id AS hall_id, h.name AS hall_name, h.garden_x AS x, h.garden_y AS y, h.garden_zone AS zone,
      (SELECT COUNT(*) FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND ${memVis}) AS lamp_count,
      (SELECT m.name FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND ${memVis} ORDER BY m.created_at ASC LIMIT 1) AS first_name,
      (SELECT m.avatar_url FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND ${memVis} ORDER BY m.created_at ASC LIMIT 1) AS avatar_url,
      (SELECT m.birth_date FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND ${memVis} ORDER BY m.created_at ASC LIMIT 1) AS birth_date,
      (SELECT m.death_date FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND ${memVis} ORDER BY m.created_at ASC LIMIT 1) AS death_date,
      (SELECT m.epitaph FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND ${memVis} ORDER BY m.created_at ASC LIMIT 1) AS epitaph,
      EXISTS(SELECT 1 FROM memorials m JOIN tributes t ON t.memorial_id = m.id
             WHERE m.hall_id = h.id AND m.is_published = 1 AND ${memVis} AND t.created_at >= datetime('now', '-24 hours')) AS candle_lit
    FROM halls h
    WHERE h.in_garden = 1 AND ${hallVis} AND h.garden_x IS NOT NULL AND h.garden_y IS NOT NULL
      AND EXISTS (SELECT 1 FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND ${memVis})
      ${zone ? "AND h.garden_zone = @zone" : ""}
      ${bbox ? "AND h.garden_x BETWEEN @bx1 AND @bx2 AND h.garden_y BETWEEN @by1 AND @by2" : ""}
      ${cursor ? "AND h.id > @cursor" : ""}
    ORDER BY h.id ASC
    LIMIT @limit`;
  const params: Record<string, unknown> = { limit: limit + 1 };
  if (uid) params.uid = uid;
  if (zone) params.zone = zone;
  if (bbox) {
    params.bx1 = bbox[0];
    params.bx2 = bbox[2];
    params.by1 = bbox[1];
    params.by2 = bbox[3];
  }
  if (cursor) params.cursor = cursor;
  const rows = db.prepare(sql).all(params) as Array<{
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
  devLog({ req: reqId, ms: Date.now() - startedAt });
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=15" } });
}
