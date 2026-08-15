import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const suites = [
  { name: "p1", script: "tools/smoke-p1.mjs" },
  { name: "p2", script: "tools/smoke-p2.mjs" },
  { name: "p4", script: "tools/smoke-p4.mjs" },
];

function parseMode(args) {
  const modes = args.filter((arg) => arg === "--serial" || arg === "--parallel");
  const unknown = args.filter((arg) => !modes.includes(arg));
  if (unknown.length || modes.length > 1) {
    throw new Error(`usage: node tools/smoke/run-all.mjs [--serial|--parallel]`);
  }
  return modes[0] === "--parallel" ? "parallel" : "serial";
}

function createLineWriter(suite, stream, logStream) {
  let pending = "";
  return {
    write(chunk) {
      const text = pending + chunk.toString();
      const lines = text.split(/\r?\n/);
      pending = lines.pop() || "";
      for (const line of lines) {
        stream.write(`[${suite}] ${line}\n`);
        logStream?.write(`${line}\n`);
      }
    },
    end() {
      if (!pending) return;
      stream.write(`[${suite}] ${pending}\n`);
      logStream?.write(`${pending}\n`);
      pending = "";
    },
  };
}

function runSuite(suite) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const logDir = process.env.SMOKE_LOG_DIR ? path.resolve(process.env.SMOKE_LOG_DIR) : null;
    if (logDir) fs.mkdirSync(logDir, { recursive: true });
    const logStream = logDir ? fs.createWriteStream(path.join(logDir, `${suite.name}.log`), { flags: "w" }) : null;
    const child = spawn(process.execPath, [suite.script], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = createLineWriter(suite.name, process.stdout, logStream);
    const stderr = createLineWriter(suite.name, process.stderr, logStream);
    child.stdout.on("data", (chunk) => stdout.write(chunk));
    child.stderr.on("data", (chunk) => stderr.write(chunk));
    child.on("error", (error) => stderr.write(`${error.message}\n`));
    child.on("close", (code, signal) => {
      stdout.end();
      stderr.end();
      logStream?.end();
      resolve({
        name: suite.name,
        exitCode: typeof code === "number" ? code : 1,
        signal,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function printSummary(mode, results) {
  const passed = results.filter((result) => result.exitCode === 0).length;
  const failed = results.length - passed;
  console.log(`\nSmoke summary (${mode}): ${passed} passed, ${failed} failed`);
  for (const result of results) {
    const state = result.exitCode === 0 ? "PASS" : "FAIL";
    const signal = result.signal ? ` signal=${result.signal}` : "";
    console.log(`- ${result.name}: ${state}, exit=${result.exitCode}, duration=${(result.durationMs / 1000).toFixed(2)}s${signal}`);
  }
  return failed;
}

const mode = parseMode(process.argv.slice(2));
console.log(`Smoke runner: mode=${mode}, suites=${suites.map((suite) => suite.name).join(",")}`);
const results = [];
if (mode === "parallel") {
  results.push(...await Promise.all(suites.map(runSuite)));
} else {
  for (const suite of suites) results.push(await runSuite(suite));
}
process.exitCode = printSummary(mode, results) ? 1 : 0;
