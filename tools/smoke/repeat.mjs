import { spawn } from "node:child_process";

function parseCount(args) {
  if (!args.length) return 3;
  if (args.length !== 2 || args[0] !== "--count" || !/^\d+$/.test(args[1])) {
    throw new Error("usage: node tools/smoke/repeat.mjs [--count positive-integer]");
  }
  const count = Number(args[1]);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("--count must be a positive integer");
  return count;
}

function runRound(round) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    console.log(`\nRepeat round ${round} started`);
    const child = spawn(process.execPath, ["tools/smoke/run-all.mjs", "--serial"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", (error) => {
      console.error(`Repeat round ${round} failed to start: ${error.message}`);
      resolve({ round, exitCode: 1, durationMs: Date.now() - startedAt });
    });
    child.on("close", (code) => resolve({
      round,
      exitCode: typeof code === "number" ? code : 1,
      durationMs: Date.now() - startedAt,
    }));
  });
}

const count = parseCount(process.argv.slice(2));
const results = [];
for (let round = 1; round <= count; round++) {
  const result = await runRound(round);
  results.push(result);
  if (result.exitCode !== 0) break;
}

const passed = results.filter((result) => result.exitCode === 0).length;
console.log(`\nRepeat summary: ${passed}/${count} rounds passed`);
for (const result of results) {
  console.log(`- round ${result.round}: ${result.exitCode === 0 ? "PASS" : "FAIL"}, exit=${result.exitCode}, duration=${(result.durationMs / 1000).toFixed(2)}s`);
}
if (results.length < count) console.log(`- skipped rounds: ${count - results.length}`);
process.exitCode = passed === count ? 0 : 1;
