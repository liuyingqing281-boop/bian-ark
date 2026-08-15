import { randomBytes } from "node:crypto";

export interface WechatIdentity { openid: string; unionid: string; nickname: string; avatarUrl: string }

function config() {
  return { appId: process.env.WECHAT_APP_ID || "", secret: process.env.WECHAT_APP_SECRET || "", redirectUri: process.env.WECHAT_REDIRECT_URI || "" };
}

export function wechatConfigured(): boolean {
  const value = config();
  return !!(value.appId && value.secret && value.redirectUri);
}

export function createWechatState(): string { return randomBytes(24).toString("hex"); }

export function wechatAuthorizeUrl(state: string): string {
  const value = config();
  if (!wechatConfigured()) throw new Error("wechat_not_configured");
  const query = new URLSearchParams({ appid: value.appId, redirect_uri: value.redirectUri, response_type: "code", scope: "snsapi_login", state });
  return `https://open.weixin.qq.com/connect/qrconnect?${query.toString()}#wechat_redirect`;
}

export async function exchangeWechatCode(code: string): Promise<WechatIdentity> {
  const value = config();
  if (!wechatConfigured()) throw new Error("wechat_not_configured");
  const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  tokenUrl.search = new URLSearchParams({ appid: value.appId, secret: value.secret, code, grant_type: "authorization_code" }).toString();
  const tokenResponse = await fetch(tokenUrl, { signal: AbortSignal.timeout(10_000) });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || token.errcode || !token.access_token || !token.openid) throw new Error("wechat_code_exchange_failed");
  const infoUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
  infoUrl.search = new URLSearchParams({ access_token: token.access_token, openid: token.openid, lang: "zh_CN" }).toString();
  const infoResponse = await fetch(infoUrl, { signal: AbortSignal.timeout(10_000) });
  const info = await infoResponse.json();
  if (!infoResponse.ok || info.errcode) throw new Error("wechat_profile_failed");
  return { openid: String(info.openid), unionid: String(info.unionid || info.openid), nickname: String(info.nickname || "微信用户").slice(0, 32), avatarUrl: String(info.headimgurl || "") };
}
