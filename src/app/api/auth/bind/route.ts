import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import { mergeUsers } from "../../../../lib/accounts";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const channel = body?.channel === "email" ? "email" : body?.channel === "sms" ? "phone" : null;
  const codeChannel = channel === "phone" ? "sms" : "email";
  const target = String(body?.target || "").trim();
  const code = String(body?.code || "");
  if (!channel || !target || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const db = getDb();
  const loginCode = db.prepare("SELECT rowid FROM login_codes WHERE channel = ? AND target = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1").get(codeChannel, target, code) as { rowid: number } | undefined;
  if (!loginCode) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  try {
    db.transaction(() => {
      const conflict = db.prepare(`SELECT id FROM users WHERE ${channel} = ?`).get(target) as { id: string } | undefined;
      if (conflict && conflict.id !== user.id) mergeUsers(db, conflict.id, user.id);
      db.prepare(`UPDATE users SET ${channel} = ? WHERE id = ?`).run(target, user.id);
      db.prepare("UPDATE login_codes SET used = 1 WHERE rowid = ?").run(loginCode.rowid);
    })();
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "bind_conflict" }, { status: 409 }); }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const column = body?.channel === "email" ? "email" : body?.channel === "sms" ? "phone" : body?.channel === "wechat" ? "wechat" : null;
  if (!column) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const db = getDb();
  const row = db.prepare("SELECT email, phone, wechat_unionid FROM users WHERE id = ?").get(user.id) as { email: string; phone: string; wechat_unionid: string };
  const bound = [row.email, row.phone, row.wechat_unionid].filter(Boolean).length;
  if (bound <= 1) return NextResponse.json({ error: "last_login_method" }, { status: 409 });
  if (column === "wechat") db.prepare("UPDATE users SET wechat_openid = NULL, wechat_unionid = NULL WHERE id = ?").run(user.id);
  else db.prepare(`UPDATE users SET ${column} = NULL WHERE id = ?`).run(user.id);
  return NextResponse.json({ ok: true });
}
