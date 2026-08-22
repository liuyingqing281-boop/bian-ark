// 临时启动 next dev 验证 /prototype 可访问，验证后立即关闭（含进程树）
import { spawn, execSync } from "node:child_process";

const PORT = 3002;
const child = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const deadline = Date.now() + 120_000;
let code = 0;
let html = "";
while (Date.now() < deadline) {
  try {
    const res = await fetch(`http://localhost:${PORT}/prototype`);
    if (res.status === 200) {
      code = 200;
      html = await res.text();
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 2000));
}

try {
  execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
} catch {}

if (code === 200) {
  const hasMarker = html.includes("P0") || html.includes("纪念馆");
  console.log("OK: /prototype returned 200, marker found:", hasMarker);
  process.exit(0);
} else {
  console.error("FAIL: page not reachable. Last dev log:");
  console.error(log.slice(-2000));
  process.exit(1);
}
