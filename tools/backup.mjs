import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const source = path.resolve(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bian.db"));
// 备份目录口径统一（docs/16 P1-4）：优先 DB_BACKUP_DIR（与 db-migrate 相同），旧 BACKUP_DIR 仅作兼容回退
const backupDir = path.resolve(process.env.DB_BACKUP_DIR || process.env.BACKUP_DIR || path.join(process.cwd(), "data", "backups"));
fs.mkdirSync(backupDir, { recursive: true });
if (!fs.existsSync(source)) {
  // 首次部署库还不存在：无可备份，跳过而不是报错中断发布
  console.log(JSON.stringify({ skipped: true, reason: "database_not_exists", source }));
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(backupDir, `bian-${stamp}.db`);
const db = new Database(source, { readonly: true });
await db.backup(destination);
db.close();
const data = fs.readFileSync(destination);
const checksum = createHash("sha256").update(data).digest("hex");
fs.writeFileSync(`${destination}.sha256`, `${checksum}  ${path.basename(destination)}\n`);
console.log(JSON.stringify({ destination, bytes: data.length, sha256: checksum }, null, 2));
