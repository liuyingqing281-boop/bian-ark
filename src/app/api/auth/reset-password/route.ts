import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { trackEvent } from "../../../../lib/events";
import { hashPassword, validatePassword } from "../../../../lib/password";

// 忘记密码收口（docs/08 §3.0，2026-08-25 拍板）：第一步复用 request-code 向账号发码，
// 本接口「验码 + 重置」。核销时点沿用 verify 哲学：分流校验（账号存在/密码规则）通过才核销。
// 成功不写会话，回登录页用新密码登录；对从未设密码的账号即为首次设置。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const channel = body?.channel === "sms" ? "sms" : body?.channel === "email" ? "email" : null;
  const target = String(body?.target || "").trim();
  // 全角数字归一化（与 verify 同规）
  const code = String(body?.code || "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .trim();
  const password = String(body?.password || "");
  if (!channel || !target || !/^\d{6}$/.test(code) || !password) {
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

  // 验码通过，先做分流校验（均不核销，修正后同码重交）
  const column = channel === "email" ? "email" : "phone";
  const user = db.prepare(`SELECT id FROM users WHERE ${column} = ?`).get(target) as
    | { id: string }
    | undefined;
  if (!user) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }
  if (!validatePassword(password)) {
    return NextResponse.json({ error: "weak_password" }, { status: 400 });
  }

  db.prepare("UPDATE login_codes SET used = 1 WHERE channel = ? AND target = ?").run(channel, target);
  const passwordHash = await hashPassword(password);
  db.prepare(
    "UPDATE users SET password_hash = ?, password_updated_at = datetime('now') WHERE id = ?"
  ).run(passwordHash, user.id);
  trackEvent("reset_password", { channel }, user.id);
  return NextResponse.json({ ok: true });
}
