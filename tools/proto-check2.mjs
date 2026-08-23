// 启动 next dev，验证 /prototype 与 /zh，随后关闭进程树
import { spawn, execSync } from "node:child_process";

const child = spawn("npx", ["next", "dev", "-p", "7300"], { shell: true, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const deadline = Date.now() + 120_000;
let proto = null;
let zh = null;
while (Date.now() < deadline) {
  try {
    const r = await fetch("http://localhost:7300/prototype");
    if (r.status === 200) {
      proto = 200;
      const r2 = await fetch("http://localhost:7300/zh", { redirect: "follow" });
      zh = r2.status;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 2000));
}

try {
  execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
} catch {}

console.log("prototype:", proto, "| /zh:", zh);
if (proto !== 200) console.error(log.slice(-2000));
process.exit(proto === 200 ? 0 : 1);
