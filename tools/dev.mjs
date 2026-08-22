// dev 服务器启动包装器：转发 CLI 端口/主机参数给 next dev。
// 优先级：CLI（-p/--port）> PORT 环境变量 > 默认 3002（既有 smoke 工具链的默认端口）。
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const hasPortFlag = args.some(
  (a, i) => ((a === "-p" || a === "--port") && args[i + 1]) || /^(-p|--port)=.+/.test(a)
);
const hasHostFlag = args.some(
  (a, i) => ((a === "-H" || a === "--hostname") && args[i + 1]) || /^(-H|--hostname)=.+/.test(a)
);

const nextArgs = ["next", "dev", ...args];
if (!hasPortFlag) nextArgs.push("-p", process.env.PORT || "3002");
if (!hasHostFlag && process.env.HOST) nextArgs.push("-H", process.env.HOST);

const child = spawn("npx", nextArgs, { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
