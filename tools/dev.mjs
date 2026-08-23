// dev 服务器启动包装器：转发 CLI 端口/主机参数给 next dev。
// 优先级：CLI（-p/--port）> PORT 环境变量 > 默认 7300（既有 smoke 工具链的默认端口）。
// 直接用当前 Node 运行 next 的 bin 入口，不依赖 PATH 中的 npx（预览环境 PATH 可能不完整）。
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next");

const args = process.argv.slice(2);
const hasPortFlag = args.some(
  (a, i) => ((a === "-p" || a === "--port") && args[i + 1]) || /^(-p|--port)=.+/.test(a)
);
const hasHostFlag = args.some(
  (a, i) => ((a === "-H" || a === "--hostname") && args[i + 1]) || /^(-H|--hostname)=.+/.test(a)
);

const nextArgs = [nextBin, "dev", ...args];
if (!hasPortFlag) nextArgs.push("-p", process.env.PORT || "7300");
if (!hasHostFlag && process.env.HOST) nextArgs.push("-H", process.env.HOST);

const child = spawn(process.execPath, nextArgs, {
  stdio: "inherit",
  cwd: path.dirname(path.dirname(fileURLToPath(import.meta.url))), // 项目根目录
  env: process.env,
});
child.on("error", (err) => {
  console.error("[dev] failed to start next:", err.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
