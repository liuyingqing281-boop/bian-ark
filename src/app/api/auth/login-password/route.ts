import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { createSession } from "../../../../lib/auth";
import { trackEvent } from "../../../../lib/events";
import { checkPassword } from "../../../../lib/password";

// 账号密码登录（docs/08 §3.0，2026-08-25 拍板）：注册后的手机号/邮箱即账号。
// 同账号密码连错 5 次锁 15 分钟：按 (channel,target) 应用层滑动窗口计数，不新增表
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^1\d{10}$/;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const attempts = new Map<string, { count: number; lockedUntil: number }>();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const target = String(body?.target || "").trim();
  const password = String(body?.password || "");
  // channel 由前端按账号格式自动判定，服务端缺省时同规则推断（双保险）
  let channel: "sms" | "email" | null =
    body?.channel === "sms" || body?.channel === "email" ? body.channel : null;
  if (!channel) channel = PHONE_RE.test(target) ? "sms" : EMAIL_RE.test(target) ? "email" : null;
  if (!channel || !target || !password) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (channel === "email" && !EMAIL_RE.test(target)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (channel === "sms" && !PHONE_RE.test(target)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const key = `${channel}:${target}`;
  const now = Date.now();
  const state = attempts.get(key);
  if (state && state.lockedUntil && state.lockedUntil <= now) attempts.delete(key);
  const lock = attempts.get(key);
  if (lock && lock.lockedUntil > now) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  const db = getDb();
  const column = channel === "email" ? "email" : "phone";
  const user = db.prepare(`SELECT id, password_hash FROM users WHERE ${column} = ?`).get(target) as
    | { id: string; password_hash: string }
    | undefined;
  // 与验证码登录同文案同引导，体验不分差异
  if (!user) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }
  // 微信注册/迁移 024 前的历史验证码账号：未设密码，引导走验证码登录或「忘记密码」首次补设
  if (!user.password_hash) {
    return NextResponse.json({ error: "password_not_set" }, { status: 401 });
  }

  if (!(await checkPassword(password, user.password_hash))) {
    const prev = attempts.get(key);
    const count = (prev?.count || 0) + 1;
    attempts.set(key, {
      count,
      lockedUntil: count >= MAX_ATTEMPTS ? now + LOCK_MS : prev?.lockedUntil || 0,
    });
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  attempts.delete(key);
  await createSession(user.id);
  trackEvent("login", { channel, method: "password" }, user.id);
  return NextResponse.json({ ok: true });
}
