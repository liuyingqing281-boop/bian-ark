// 验证 npm run dev 不带参数时固定服务在 7300
import { spawn, execSync } from "node:child_process";

const child = spawn("npm", ["run", "dev"], { shell: true, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const deadline = Date.now() + 120_000;
let ok = false;
while (Date.now() < deadline) {
  try {
    const r = await fetch("http://localhost:7300/zh/hall/4fc5e476-cae8-4ff7-9b3a-4a2b8693a265");
    if (r.status === 200) { ok = true; break; }
  } catch {}
  await new Promise((r) => setTimeout(r, 2000));
}
try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
console.log(ok ? "OK: npm run dev 默认服务在 7300，hall 页 200" : "FAIL");
if (!ok) console.log(log.slice(-1200));
process.exit(ok ? 0 : 1);
