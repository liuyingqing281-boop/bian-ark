// 预热 Turbopack 编译缓存：启动 dev，逐个编译关键路由，全部 200 后关闭
import { spawn, execSync } from "node:child_process";

const ROUTES = ["/zh", "/zh/hall/4fc5e476-cae8-4ff7-9b3a-4a2b8693a265", "/zh/memorial/4fc5e476-cae8-4ff7-9b3a-4a2b8693a265", "/prototype", "/api/health"];
const child = spawn("npm", ["run", "dev"], { shell: true, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const deadline = Date.now() + 240_000;
const results = {};
// 先等服务器 ready
let ready = false;
while (Date.now() < deadline) {
  try { const r = await fetch("http://localhost:7300/api/health"); if (r.status) { ready = true; break; } } catch {}
  await new Promise((r) => setTimeout(r, 1500));
}
if (ready) {
  for (const route of ROUTES) {
    const t0 = Date.now();
    try {
      const r = await fetch(`http://localhost:7300${route}`, { redirect: "follow" });
      await r.text();
      results[route] = `${r.status} (${((Date.now() - t0) / 1000).toFixed(1)}s)`;
    } catch (e) {
      results[route] = `ERR ${e.message}`;
    }
  }
} else {
  console.error("server not ready", log.slice(-1500));
}
try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
for (const [k, v] of Object.entries(results)) console.log(v.padEnd(18), k);
process.exit(ready ? 0 : 1);
