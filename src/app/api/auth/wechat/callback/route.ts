import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { createSession } from "../../../../../lib/auth";
import { getDb } from "../../../../../lib/db";
import { exchangeWechatCode } from "../../../../../lib/wechat";
import { mergeUsers } from "../../../../../lib/accounts";
import { trackEvent } from "../../../../../lib/events";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || "";
  const code = req.nextUrl.searchParams.get("code") || "";
  const db = getDb();
  const stored = db.prepare("SELECT user_id, intent FROM auth_oauth_states WHERE state = ? AND provider = 'wechat' AND expires_at > datetime('now')").get(state) as { user_id: string; intent: string } | undefined;
  if (!stored || !code) return NextResponse.json({ error: "invalid_oauth_state" }, { status: 400 });
  db.prepare("DELETE FROM auth_oauth_states WHERE state = ?").run(state);
  const loginError = (key: string) => NextResponse.redirect(new URL(`/zh/login?error=${key}`, req.url));
  try {
    const identity = await exchangeWechatCode(code);
    let existing = db.prepare("SELECT id FROM users WHERE wechat_unionid = ? OR wechat_openid = ?").get(identity.unionid, identity.openid) as { id: string } | undefined;
    // 2026-08-24 拍板「登录/注册分离」：按 qrcode 落库的 intent 分流（docs/08 §3.0）
    if (!stored.user_id && stored.intent === "register" && existing) {
      return loginError("wechat_already_registered");
    }
    if (!stored.user_id && stored.intent !== "register" && !existing) {
      return loginError("wechat_not_registered");
    }
    let registered = false;
    if (stored.user_id) {
      if (existing && existing.id !== stored.user_id) mergeUsers(db, existing.id, stored.user_id);
      db.prepare("UPDATE users SET wechat_openid = ?, wechat_unionid = ?, avatar_url = COALESCE(NULLIF(avatar_url, ''), ?) WHERE id = ?").run(identity.openid, identity.unionid, identity.avatarUrl, stored.user_id);
      existing = { id: stored.user_id };
    } else if (!existing) {
      existing = { id: uuid() };
      db.prepare("INSERT INTO users (id, name, wechat_openid, wechat_unionid, avatar_url) VALUES (?, ?, ?, ?, ?)").run(existing.id, identity.nickname, identity.openid, identity.unionid, identity.avatarUrl);
      registered = true;
    }
    if (registered) trackEvent("register", { channel: "wechat", agreed: true }, existing.id);
    await createSession(existing.id);
    trackEvent("login", { channel: "wechat", intent: stored.intent }, existing.id);
    return NextResponse.redirect(new URL("/zh/me", req.url));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "wechat_failed" }, { status: 502 });
  }
}
