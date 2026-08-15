import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { createSession } from "../../../../../lib/auth";
import { getDb } from "../../../../../lib/db";
import { exchangeWechatCode } from "../../../../../lib/wechat";
import { mergeUsers } from "../../../../../lib/accounts";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state") || "";
  const code = req.nextUrl.searchParams.get("code") || "";
  const db = getDb();
  const stored = db.prepare("SELECT user_id FROM auth_oauth_states WHERE state = ? AND provider = 'wechat' AND expires_at > datetime('now')").get(state) as { user_id: string } | undefined;
  if (!stored || !code) return NextResponse.json({ error: "invalid_oauth_state" }, { status: 400 });
  db.prepare("DELETE FROM auth_oauth_states WHERE state = ?").run(state);
  try {
    const identity = await exchangeWechatCode(code);
    let existing = db.prepare("SELECT id FROM users WHERE wechat_unionid = ? OR wechat_openid = ?").get(identity.unionid, identity.openid) as { id: string } | undefined;
    if (stored.user_id) {
      if (existing && existing.id !== stored.user_id) mergeUsers(db, existing.id, stored.user_id);
      db.prepare("UPDATE users SET wechat_openid = ?, wechat_unionid = ?, avatar_url = COALESCE(NULLIF(avatar_url, ''), ?) WHERE id = ?").run(identity.openid, identity.unionid, identity.avatarUrl, stored.user_id);
      existing = { id: stored.user_id };
    } else if (!existing) {
      existing = { id: uuid() };
      db.prepare("INSERT INTO users (id, name, wechat_openid, wechat_unionid, avatar_url) VALUES (?, ?, ?, ?, ?)").run(existing.id, identity.nickname, identity.openid, identity.unionid, identity.avatarUrl);
    }
    await createSession(existing.id);
    return NextResponse.redirect(new URL("/zh/me", req.url));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "wechat_failed" }, { status: 502 });
  }
}
