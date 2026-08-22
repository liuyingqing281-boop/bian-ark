// 验证 tools/dev.mjs 的端口转发：①带 -p 参数 ②不带参数回退 3002
import { spawn, execSync } from "node:child_process";

async function check(label, spawnArgs, expectPort) {
  const child = spawn("npm", ["run", "dev", ...spawnArgs], { shell: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const deadline = Date.now() + 120_000;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://localhost:${expectPort}/prototype`);
      if (r.status === 200) { ok = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
  console.log(label, ok ? `OK (http://localhost:${expectPort}/prototype → 200)` : "FAIL");
  if (!ok) console.error(log.slice(-1500));
  return ok;
}

const a = await check("带参数 -p 7399:", ["--", "-p", "7399"], 7399);
await new Promise((r) => setTimeout(r, 3000));
const b = await check("不带参数(回退3002):", [], 3002);
process.exit(a && b ? 0 : 1);
