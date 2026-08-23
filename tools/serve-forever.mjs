// 持久启动开发服务器（预览卡片故障时的兜底）：detached 运行，日志落盘
// 用法：node tools/serve-forever.mjs   —— 启动后立即退出本脚本，服务器留在后台
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next");
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const out = fs.openSync(path.join(root, "server.log"), "w");
const child = spawn(process.execPath, [nextBin, "dev", "-p", "7300"], {
  cwd: root,
  detached: true,
  stdio: ["ignore", out, out],
  env: process.env,
});
child.unref();
console.log("dev server started, pid =", child.pid, "| log = server.log | http://localhost:7300");
