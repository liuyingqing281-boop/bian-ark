import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/auth";
import { trackEvent } from "../../../../../lib/events";

// PATCH /api/halls/[id]/garden-pos —— 星海择位（docs/08 §3.13，墓园规格 §8.3）
// { x, y }（0~1）择位并隐式入园；{ x: null, y: null } 移出星海。
// 冲突：两馆最小间距 0.04；命中返回 409 + 建议邻近空位。
const MIN_DIST = 0.04;

function findSpot(db: ReturnType<typeof getDb>, x: number, y: number): { x: number; y: number } | null {
  const taken = db
    .prepare("SELECT garden_x AS x, garden_y AS y FROM halls WHERE in_garden = 1 AND garden_x IS NOT NULL")
    .all() as Array<{ x: number; y: number }>;
  const free = (cx: number, cy: number) =>
    taken.every((t) => Math.hypot(t.x - cx, t.y - cy) >= MIN_DIST);
  if (free(x, y)) return { x, y };
  // 螺旋外扩找建议空位
  for (let ring = 1; ring <= 8; ring++) {
    const r = MIN_DIST * ring;
    for (let a = 0; a < 12; a++) {
      const cx = Math.min(0.96, Math.max(0.04, x + r * Math.cos((a * Math.PI) / 6)));
      const cy = Math.min(0.92, Math.max(0.08, y + r * Math.sin((a * Math.PI) / 6)));
      if (free(cx, cy)) return { x: Math.round(cx * 1000) / 1000, y: Math.round(cy * 1000) / 1000 };
    }
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const hall = db.prepare("SELECT id, visibility, owner_user_id FROM halls WHERE id = ?").get(id) as
    | { id: string; visibility: string; owner_user_id: string }
    | undefined;
  if (!hall) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (hall.owner_user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || !("x" in body)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  // 移出星海
  if (body.x === null || body.y === null) {
    db.prepare("UPDATE halls SET in_garden = 0, garden_x = NULL, garden_y = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    trackEvent("garden_place", { hall_id: id, action: "remove" }, user.id);
    return NextResponse.json({ ok: true, in_garden: false });
  }

  const x = Number(body.x), y = Number(body.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    return NextResponse.json({ error: "invalid_position" }, { status: 400 });
  }
  if (hall.visibility !== "public") {
    return NextResponse.json({ error: "forbidden", reason: "visibility_required" }, { status: 403 });
  }

  const spot = findSpot(db, x, y);
  if (!spot) return NextResponse.json({ error: "no_space" }, { status: 409 });
  if (Math.hypot(spot.x - x, spot.y - y) > 1e-9) {
    return NextResponse.json({ error: "position_conflict", suggested: spot }, { status: 409 });
  }

  db.prepare("UPDATE halls SET in_garden = 1, garden_x = ?, garden_y = ?, updated_at = datetime('now') WHERE id = ?").run(x, y, id);
  trackEvent("garden_place", { hall_id: id, action: "place", x, y }, user.id);
  return NextResponse.json({ ok: true, in_garden: true, x, y });
}
