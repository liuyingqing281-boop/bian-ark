import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getDb } from "../../../../../lib/db";
import { createWechatState, wechatAuthorizeUrl, wechatConfigured } from "../../../../../lib/wechat";

export async function POST(req: NextRequest) {
  if (!wechatConfigured()) return NextResponse.json({ error: "wechat_not_configured" }, { status: 503 });
  // 2026-08-24 拍板「登录/注册分离」：intent 随 state 落库，callback 分流（docs/08 §3.0）
  const body = await req.json().catch(() => ({}));
  const intent = body?.intent === "register" ? "register" : "login";
  const user = await getSessionUser();
  const state = createWechatState();
  getDb()
    .prepare("INSERT INTO auth_oauth_states (state, user_id, provider, intent, expires_at) VALUES (?, ?, 'wechat', ?, datetime('now', '+10 minutes'))")
    .run(state, user?.id || "", intent);
  return NextResponse.json({ url: wechatAuthorizeUrl(state), state, intent });
}
