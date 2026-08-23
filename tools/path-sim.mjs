// 模拟受限 PATH 环境下 npm run dev 的行为（复现预览卡片环境）
import { spawn, execSync } from "node:child_process";

// 只保留系统目录，去掉 node/npm 所在目录
const minimalPath = "C:\\Windows\\System32;C:\\Windows";
const npmCmd = "C:/Users/liuli/AppData/Local/Programs/kimi-desktop/resources/resources/runtime/node_modules/npm/bin/npm-cli.js";
const nodeExe = process.execPath;
console.log("node:", nodeExe);
console.log("npm_execpath:", npmCmd);

// 预览侧多半用绝对路径的 node + npm-cli 起脚本，script 内部能否找到 node 是关键
const child = spawn(nodeExe, [npmCmd, "run", "dev"], {
  env: { ...process.env, PATH: minimalPath, Path: minimalPath },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const deadline = Date.now() + 60_000;
let ok = false;
while (Date.now() < deadline) {
  try {
    const r = await fetch("http://localhost:7300/api/health");
    if (r.status) { ok = true; break; }
  } catch {}
  const exited = await new Promise((r) => {
    const t = setTimeout(() => r(false), 500);
    child.once("exit", (c) => { clearTimeout(t); r(true); });
  });
  if (exited) break;
}
try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
console.log(ok ? "OK: 受限 PATH 下也能起" : "FAIL: 受限 PATH 下启动失败（复现！）");
console.log("--- output ---");
console.log(log.slice(0, 1500));
process.exit(0);
