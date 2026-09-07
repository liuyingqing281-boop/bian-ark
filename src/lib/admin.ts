import { getSessionUser, SessionUser } from "./auth";
import { canAccessAdmin } from "./admin-guard";

// Admin gate（docs/16 P3-2）：会话用户 + 规则判定。
// 放行规则单一来源 = admin-guard.canAccessAdmin，与 src/proxy.ts 中间件守卫完全一致；
// 此处保留为 API 内纵深（即便中间件被绕过仍拦截）。
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return canAccessAdmin(user.email) ? user : null;
}