import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getDb } from "../../../../../lib/db";
import { createWechatState, wechatAuthorizeUrl, wechatConfigured } from "../../../../../lib/wechat";

export async function POST() {
  if (!wechatConfigured()) return NextResponse.json({ error: "wechat_not_configured" }, { status: 503 });
  const user = await getSessionUser();
  const state = createWechatState();
  getDb().prepare("INSERT INTO auth_oauth_states (state, user_id, provider, expires_at) VALUES (?, ?, 'wechat', datetime('now', '+10 minutes'))").run(state, user?.id || "");
  return NextResponse.json({ url: wechatAuthorizeUrl(state), state });
}
