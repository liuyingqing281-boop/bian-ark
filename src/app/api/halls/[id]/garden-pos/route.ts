import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getSessionUser } from "../../../../../lib/auth";
import { trackEvent } from "../../../../../lib/events";
import { findAvailableGardenSpot, removeHallFromGarden, setHallGardenPosition } from "../../../../../lib/garden-position";

// PATCH /api/halls/[id]/garden-pos —— 星海择位（docs/08 §3.13，墓园规格 §8.3）
// { x, y }（0~1）择位并隐式入园；{ x: null, y: null } 移出星海。
// 冲突：两馆最小间距 0.04；命中返回 409 + 建议邻近空位。
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
    removeHallFromGarden(db, id);
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

  const spot = findAvailableGardenSpot(db, x, y, id);
  if (!spot) return NextResponse.json({ error: "no_space" }, { status: 409 });
  if (Math.hypot(spot.x - x, spot.y - y) > 1e-9) {
    return NextResponse.json({ error: "position_conflict", suggested: spot }, { status: 409 });
  }

  setHallGardenPosition(db, id, x, y);
  trackEvent("garden_place", { hall_id: id, action: "place", x, y }, user.id);
  return NextResponse.json({ ok: true, in_garden: true, x, y });
}
