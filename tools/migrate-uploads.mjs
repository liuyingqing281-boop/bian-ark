import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(process.cwd(), "data", "uploads");
const dryRun = process.argv.includes("--dry-run");
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(root);
const manifest = files.map((file) => {
  const data = fs.readFileSync(file);
  return { objectKey: path.relative(root, file).replace(/\\/g, "/"), size: data.length, sha256: createHash("sha256").update(data).digest("hex"), status: dryRun ? "dry-run" : "verified-local" };
});
const output = path.join(process.cwd(), "data", "upload-migration-manifest.json");
if (!dryRun) fs.writeFileSync(output, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ provider: process.env.STORAGE_PROVIDER || "local", dryRun, files: manifest.length, output: dryRun ? null : output }, null, 2));
