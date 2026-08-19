// 本地回归编排：起 dev server(3003) → B5 视觉验证 → smoke → E2E → 移动审计 → 关服
// 用法: node tools/local-regression.mjs [--skip-visual] [--skip-e2e]
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const PORT = "3003";
const BASE = `http://localhost:${PORT}`;

// 前置：端口必须空闲，防止误打残留服务器
async function portListening() {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1500) });
    return r.status < 600;
  } catch {
    return false;
  }
}
if (await portListening()) {
  console.error(`!! ${PORT} 已被占用，先清理残留服务器再跑`);
  process.exit(1);
}

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", PORT], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, AUTH_IP_DAILY_LIMIT: "1000" },
});
let serverErr = "";
server.stderr.on("data", (d) => { serverErr += d.toString(); });

let up = false;
for (let i = 0; i < 90; i++) {
  if (server.exitCode !== null) break;
  try {
    const r = await fetch(`${BASE}/api/health`);
    if (r.ok) { up = true; break; }
  } catch {}
  await delay(1000);
}
if (!up) {
  console.error("server failed to start. stderr tail:\n" + serverErr.slice(-800));
  try { spawnSync("taskkill", ["/PID", String(server.pid), "/F", "/T"]); } catch {}
  process.exit(1);
}
console.log("== server up on", BASE);

function run(name, cmd, cmdArgs, env = {}) {
  console.log(`\n== ${name}`);
  const r = spawnSync(process.execPath, cmdArgs, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env, BASE_URL: BASE, ...env },
  });
  const ok = r.status === 0;
  console.log(`== ${name}: ${ok ? "PASS" : "FAIL"}`);
  return ok;
}

const results = {};
if (!args.includes("--skip-visual")) {
  results.visual = run("B5 visual verify", process.execPath, ["tools/b5-verify.mjs"]);
}
results.smoke = run("smoke", process.execPath, ["tools/smoke/run-all.mjs", "--serial"]);
if (!args.includes("--skip-e2e")) {
  results.e2e = run("playwright e2e", process.execPath, ["node_modules/@playwright/test/cli.js", "test"], { PLAYWRIGHT_EXTERNAL_SERVER: "1" });
}
results.mobileAudit = run("mobile audit", process.execPath, ["tools/mobile-audit-check.mjs", "b5verify-0000-0000-0000-000000000001"]);

try { spawnSync("taskkill", ["/PID", String(server.pid), "/F", "/T"]); } catch {}
await delay(1500);
if (await portListening()) {
  console.error("!! 服务器未能完全停止");
  process.exit(2);
}
console.log("\n== SERVER_STOPPED");
console.log("== results:", JSON.stringify(results));
process.exit(Object.values(results).every(Boolean) ? 0 : 1);
