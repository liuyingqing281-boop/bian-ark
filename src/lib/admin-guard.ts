// Admin 门禁单一规则源（docs/16 P3-2）：
// - 服务端纵深：requireAdmin（src/lib/admin.ts）
// - 中间件前置：src/proxy.ts 对 /api/admin 与 /[lang]/admin 的统一守卫
// 本文件只允许 Node 内置模块与 better-sqlite3，禁止 next/*（proxy.ts 会 import 本文件）。
import Database from "better-sqlite3";
import { resolveDatabasePath } from "./db-core";

export const SESSION_COOKIE = "bian_session";

/**
 * 与旧 requireAdmin 完全一致的放行规则：
 * - ADMIN_EMAILS（逗号分隔）非空：邮箱须在名单内
 * - ADMIN_EMAILS 为空：仅开发/演示环境放行（任何登录用户），生产环境 fail-closed
 */
export function canAccessAdmin(email: string | null | undefined): boolean {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) {
    return process.env.NODE_ENV !== "production";
  }
  return !!email && list.includes(email.toLowerCase());
}

/** 与 src/lib/auth.ts 一致的 SQLite UTC（'YYYY-MM-DD HH:MM:SS'）过期判断。 */
function parseSqliteUtc(datetime: string): number {
  return new Date(datetime.replace(" ", "T") + "Z").getTime();
}

/**
 * 只读解析会话令牌对应邮箱（供中间件守卫使用；避免把 next/headers 与迁移/种子逻辑拉进 proxy 捆绑）。
 * 有意不做滑动续期：通过守卫的后续真实请求会走 API 路径（auth.ts getSessionUser）续期。
 * 令牌缺失 / 已过期 / 数据库暂不可用均返回 null（失败关闭，且不缓存失败，下次请求重试）。
 */
export function resolveSessionEmail(token: string | null | undefined): string | null {
  if (!token) return null;
  let db: Database.Database | null = null;
  try {
    db = new Database(resolveDatabasePath(), { readonly: true });
    const row = db
      .prepare(
        `SELECT s.expires_at AS expires_at, u.email AS email
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`
      )
      .get(token) as { email: string; expires_at: string } | undefined;
    if (!row) return null;
    return parseSqliteUtc(row.expires_at) >= Date.now() ? row.email : null;
  } catch {
    return null;
  } finally {
    if (db) db.close();
  }
}
