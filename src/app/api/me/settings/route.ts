import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";

// GET/PATCH /api/me/settings —— 用户设置（users.settings JSON 串，读取时与默认值合并）
const DEFAULTS = { notifyReview: true, notifyCollab: true, privateDefault: false };
const KEYS = Object.keys(DEFAULTS) as Array<keyof typeof DEFAULTS>;

function readSettings(db: ReturnType<typeof getDb>, userId: string) {
  const row = db.prepare("SELECT settings FROM users WHERE id = ?").get(userId) as
    | { settings: string }
    | undefined;
  let stored: Record<string, unknown> = {};
  try {
    stored = JSON.parse(row?.settings || "{}");
  } catch {
    /* 非 JSON 按默认 */
  }
  const merged: Record<string, boolean> = { ...DEFAULTS };
  for (const k of KEYS) if (typeof stored[k] === "boolean") merged[k] = stored[k] as boolean;
  return merged;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(readSettings(getDb(), user.id));
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const db = getDb();
  const merged = readSettings(db, user.id);
  let changed = false;
  for (const k of KEYS) {
    if (k in body) {
      if (typeof body[k] !== "boolean") {
        return NextResponse.json({ error: "invalid_value", field: k }, { status: 400 });
      }
      merged[k] = body[k];
      changed = true;
    }
  }
  if (!changed) return NextResponse.json({ error: "no_fields" }, { status: 400 });
  db.prepare("UPDATE users SET settings = ? WHERE id = ?").run(JSON.stringify(merged), user.id);
  return NextResponse.json({ ok: true });
}
