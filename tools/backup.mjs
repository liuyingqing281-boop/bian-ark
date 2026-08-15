import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const source = path.resolve(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bian.db"));
const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "data", "backups"));
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(backupDir, `bian-${stamp}.db`);
const db = new Database(source, { readonly: true });
await db.backup(destination);
db.close();
const data = fs.readFileSync(destination);
const checksum = createHash("sha256").update(data).digest("hex");
fs.writeFileSync(`${destination}.sha256`, `${checksum}  ${path.basename(destination)}\n`);
console.log(JSON.stringify({ destination, bytes: data.length, sha256: checksum }, null, 2));
