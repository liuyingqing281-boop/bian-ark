import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { generateLoginCode } from "../../../../lib/auth";
import { sendLoginCode } from "../../../../lib/notify";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^1\d{10}$/;
// 可通过 AUTH_IP_DAILY_LIMIT 覆盖（CI/E2E 环境调高，生产保持默认）
const IP_DAILY_LIMIT = Number(process.env.AUTH_IP_DAILY_LIMIT || 100);

function requestIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim().slice(0, 64);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const channel = body?.channel === "sms" ? "sms" : body?.channel === "email" ? "email" : null;
  const target = String(body?.target || "").trim();
  if (!channel) return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
  if (channel === "email" && !EMAIL_RE.test(target)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (channel === "sms" && !PHONE_RE.test(target)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const db = getDb();
  const ip = requestIp(req);
  const ipRequests = db.prepare(
    "SELECT COUNT(*) AS count FROM login_codes WHERE request_ip = ? AND created_at >= datetime('now', '-1 day')"
  ).get(ip) as { count: number };
  if (ipRequests.count >= IP_DAILY_LIMIT) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const recent = db
    .prepare("SELECT created_at FROM login_codes WHERE channel = ? AND target = ? ORDER BY created_at DESC LIMIT 1")
    .get(channel, target) as { created_at: string } | undefined;
  if (recent) {
    const elapsed = Date.now() - new Date(recent.created_at.replace(" ", "T") + "Z").getTime();
    if (elapsed < 60_000) {
      return NextResponse.json({ error: "too_frequent" }, { status: 429 });
    }
  }

  const code = generateLoginCode();
  db.prepare("UPDATE login_codes SET used = 1 WHERE channel = ? AND target = ?").run(channel, target);
  db.prepare(
    "INSERT INTO login_codes (channel, target, code, expires_at, request_ip) VALUES (?, ?, ?, datetime('now', '+10 minutes'), ?)"
  ).run(channel, target, code, ip);

  const result = await sendLoginCode(channel, target, code);
  return NextResponse.json({
    ok: true,
    delivered: result.delivered,
    ...(process.env.NODE_ENV !== "production" && result.devCode ? { devCode: result.devCode } : {}),
  });
}
