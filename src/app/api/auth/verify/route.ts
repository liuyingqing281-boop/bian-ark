import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../../lib/db";
import { createSession } from "../../../../lib/auth";
import { trackEvent } from "../../../../lib/events";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const channel = body?.channel === "sms" ? "sms" : body?.channel === "email" ? "email" : null;
  const target = String(body?.target || "").trim();
  // 全角数字（中文输入法常见）归一化为半角
  const code = String(body?.code || "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .trim();
  const name = String(body?.name || "").trim().slice(0, 32);
  if (!channel || !target || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT rowid, code, expires_at, attempts, locked_until FROM login_codes
       WHERE channel = ? AND target = ? AND used = 0 ORDER BY created_at DESC LIMIT 1`
    )
    .get(channel, target) as
    | { rowid: number; code: string; expires_at: string; attempts: number; locked_until: string }
    | undefined;
  if (!row) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  if (row.locked_until && new Date(row.locked_until.replace(" ", "T") + "Z").getTime() > Date.now()) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }
  if (new Date(row.expires_at.replace(" ", "T") + "Z").getTime() < Date.now()) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  if (row.attempts >= 5) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }
  if (row.code !== code) {
    db.prepare(
      `UPDATE login_codes
       SET attempts = attempts + 1,
           locked_until = CASE WHEN attempts + 1 >= 5 THEN datetime('now', '+15 minutes') ELSE locked_until END
       WHERE rowid = ?`
    ).run(row.rowid);
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  db.prepare("UPDATE login_codes SET used = 1 WHERE channel = ? AND target = ?").run(channel, target);

  const column = channel === "email" ? "email" : "phone";
  let user = db.prepare(`SELECT id FROM users WHERE ${column} = ?`).get(target) as
    | { id: string }
    | undefined;
  if (!user) {
    const id = uuid();
    db.prepare("INSERT INTO users (id, email, phone, name) VALUES (?, ?, ?, ?)").run(
      id,
      channel === "email" ? target : null,
      channel === "sms" ? target : null,
      name || (channel === "email" ? target.split("@")[0] : `用户${target.slice(-4)}`)
    );
    user = { id };
  }
  await createSession(user.id);
  trackEvent("login", { channel }, user.id);
  return NextResponse.json({ ok: true });
}
