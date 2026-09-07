// 纯 Node 依赖的数据库路径解析（单点维护）。
// 本文件禁止引入 next/* 或 better-sqlite3：src/lib/db.ts（服务端）与 src/proxy.ts（中间件）都会引用它，
// 避免中间件/构建环境被拉入框架模块。
import path from "node:path";

/** 与既有 src/lib/db.ts 完全一致的定位逻辑（SMOKE_DB_PATH > DATABASE_PATH > data/bian.db）。 */
export function resolveDatabasePath(): string {
  return path.resolve(
    /* turbopackIgnore: true */
    process.env.SMOKE_DB_PATH || process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bian.db")
  );
}
