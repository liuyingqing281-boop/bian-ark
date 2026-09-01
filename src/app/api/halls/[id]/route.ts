import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { trackEvent } from "../../../../lib/events";

// 馆级聚合（docs/13）：灯阵场景 + 群像数据
interface HallRow {
  id: string; name: string; motto: string; skin: string; visibility: string; owner_user_id: string;
  in_garden: number; garden_x: number | null; garden_y: number | null;
}
interface MemberRow {
  id: string; name: string; appellation: string; birth_date: string; death_date: string;
  epitaph: string; avatar_url: string; lamp_x: number | null; lamp_y: number | null; user_id: string;
}

function getHall(id: string): HallRow | undefined {
  return getDb().prepare("SELECT id, name, motto, skin, visibility, owner_user_id, in_garden, garden_x, garden_y FROM halls WHERE id = ?").get(id) as HallRow | undefined;
}

// 馆级可见性：public 皆可；private 仅馆主；group 馆内任一人物关联群的成员
function canViewHall(hall: HallRow, userId: string | null): boolean {
  if (hall.visibility === "public") return true;
  if (!userId) return false;
  if (hall.owner_user_id === userId) return true;
  if (hall.visibility === "group") {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT 1 AS ok FROM memorials m
         JOIN memorial_groups mg ON mg.memorial_id = m.id
         JOIN group_members gm ON gm.group_id = mg.group_id
         WHERE m.hall_id = ? AND gm.user_id = ? LIMIT 1`
      )
      .get(hall.id, userId);
    return !!row;
  }
  return false;
}

// GET /api/halls/[id] —— 馆信息 + 成员（灯位 + 明灭）+ 是否馆主
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hall = getHall(id);
  if (!hall) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await getSessionUser();
  if (!canViewHall(hall, user?.id ?? null)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const db = getDb();
  const members = db
    .prepare(
      `SELECT id, name, appellation, birth_date, death_date, epitaph, avatar_url, lamp_x, lamp_y, user_id
       FROM memorials WHERE hall_id = ? AND is_published = 1 ORDER BY created_at ASC LIMIT 6`
    )
    .all(id) as MemberRow[];
  // 每人独立明灭：24h 内有祭扫则微亮（口径同 candleLit）
  const litRows = db
    .prepare(
      `SELECT memorial_id FROM tributes
       WHERE memorial_id IN (${members.map(() => "?").join(",") || "''"})
         AND created_at >= datetime('now', '-24 hours')
       GROUP BY memorial_id`
    )
    .all(...members.map((m) => m.id)) as Array<{ memorial_id: string }>;
  const lit = new Set(litRows.map((r) => r.memorial_id));

  const isOwner = !!user && hall.owner_user_id === user.id;
  // 传输层脱敏（docs/08 §3.13 F7 / FR-04，收尾评审 Important）：馆主原文；
  // 其余视角（group 成员/未登录访客）一律首字 + **（单字 → *），与馆级页角色规则
  // 同口径。访客侧 UI 二次打码幂等（首字 + ** 再打码不变）。nameMasked 保持既有
  // 装配语义（馆主=原文）。
  const maskName = (name: string) => (name.length <= 1 ? "*" : name[0] + "**");

  return NextResponse.json({
    hall: { id: hall.id, name: isOwner ? hall.name : maskName(hall.name), motto: hall.motto, skin: hall.skin, visibility: hall.visibility, inGarden: hall.in_garden === 1, gardenX: hall.garden_x, gardenY: hall.garden_y },
    isOwner,
    members: members.map((m) => ({
      id: m.id,
      name: isOwner ? m.name : maskName(m.name),
      nameMasked: isOwner ? m.name : maskName(m.name),
      appellation: m.appellation || "",
      birthDate: m.birth_date,
      deathDate: m.death_date,
      epitaph: m.epitaph,
      avatarUrl: m.avatar_url,
      lampX: m.lamp_x,
      lampY: m.lamp_y,
      candleLit: lit.has(m.id),
    })),
  });
}

// PATCH /api/halls/[id]/layout —— 馆主拖拽摆位持久化（不计费、不限次）
// body: { positions: [{ memorialId, x, y }] }，x/y 为场景百分比（0–100）
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hall = getHall(id);
  if (!hall) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (hall.owner_user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const positions = Array.isArray(body?.positions) ? body.positions : null;
  if (!positions || !positions.length) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const db = getDb();
  const memberIds = new Set(
    (db.prepare("SELECT id FROM memorials WHERE hall_id = ?").all(id) as Array<{ id: string }>).map((r) => r.id)
  );
  const clamp = (v: unknown, lo: number, hi: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.min(hi, Math.max(lo, n));
  };
  const update = db.prepare("UPDATE memorials SET lamp_x = ?, lamp_y = ?, updated_at = datetime('now') WHERE id = ? AND hall_id = ?");
  let changed = 0;
  const tx = db.transaction(() => {
    for (const p of positions.slice(0, 6)) {
      if (!p || typeof p.memorialId !== "string" || !memberIds.has(p.memorialId)) continue;
      const x = clamp(p.x, 4, 96);
      const y = clamp(p.y, 8, 88);
      if (x === null || y === null) continue;
      update.run(x, y, p.memorialId, id);
      changed++;
    }
  });
  tx();
  if (!changed) return NextResponse.json({ error: "no_valid_positions" }, { status: 400 });
  trackEvent("lamp_arrange", { hall_id: id, moved: changed }, user.id);
  return NextResponse.json({ ok: true, moved: changed });
}
