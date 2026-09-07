#!/usr/bin/env node
// 一条龙发布（docs/16 P1-1）：本地构建 → 打包（隔离 distDir，免疫 dev server）→ 上传 → 远端 apply-release → 验证 → 报告
// 用法：npm run release [-- --skip-sync] [-- --skip-dirty]
// 依赖：~/.ssh/bian_deploy 密钥（2026-09-07 已打通）、GNU tar（Git Bash 自带）
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOST = "root@47.238.100.165";
const REMOTE_DIR = "/var/www/bian";
const KEY = path.join(os.homedir(), ".ssh", "bian_deploy");
const SSH_BASE = ["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=accept-new", HOST];
const args = process.argv.slice(2);
const skipSync = args.includes("--skip-sync");
const skipDirty = args.includes("--skip-dirty");
const log = (s) => console.log(s);

function run(cmd, opts = {}) {
  // stdio:"inherit"（构建/上传流式输出）时 execSync 返回 null，不能直接 .toString()
  const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts });
  return out == null ? "" : out.toString().trim();
}

function assert(cond, msg) {
  if (!cond) { console.error(`❌ ${msg}`); process.exit(1); }
}

// ---------- 1. 前置检查 ----------
log("=== [1/6] 前置检查 ===");
const branch = run("git rev-parse --abbrev-ref HEAD");
assert(branch === "master", `当前分支 ${branch}，请在 master 上发布（或用 git checkout master）`);
const dirty = run("git status --porcelain -- src deploy tools migrations package.json next.config.ts").length > 0;
if (dirty && !skipDirty) {
  assert(false, "工作区有未提交的产品改动（src/deploy/tools/migrations/package.json）。先提交再发布，或 --skip-dirty");
}
const commit = run("git rev-parse HEAD");
if (!skipSync) {
  run("git fetch origin master");
  const remote = run("git rev-parse origin/master");
  assert(commit === remote, `本地 master(${commit.slice(0, 7)}) 与 origin/master(${remote.slice(0, 7)}) 不一致：先 push/pull，或 --skip-sync`);
}
log(`  分支 master @ ${commit.slice(0, 7)} ✓`);

// ---------- 2. 隔离构建（BIAN_NEXT_DIST_DIR，与 dev server 的 .next 互不干扰） ----------
log("=== [2/6] 生产构建（隔离目录 .next-release）===");
fs.rmSync(".next-release", { recursive: true, force: true });
run("npm run build", { env: { ...process.env, BIAN_NEXT_DIST_DIR: ".next-release" }, stdio: "inherit" });
fs.rmSync(path.join(".next-release", "cache"), { recursive: true, force: true }); // 构建缓存不入包
fs.writeFileSync(path.join(".next-release", "RELEASE_COMMIT"), commit); // 产物-代码一致性（apply-release 校验）
log("  构建完成，已写入 RELEASE_COMMIT");

// ---------- 3. 打包（--transform 把 .next-release 改名为 .next） ----------
log("=== [3/6] 打包 ===");
const pkg = "bian-release-next.tar.gz";
fs.rmSync(pkg, { force: true });
run(`tar czf ${pkg} --transform 's,^\\.next-release,.next,' .next-release`);
const size = (fs.statSync(pkg).size / 1024 / 1024).toFixed(1);
assert(parseFloat(size) < 50, `包体 ${size}MB 异常（历史事故阈值），中止`);
log(`  ${pkg}（${size}MB）`);

// ---------- 4. 上传 ----------
log("=== [4/6] 上传 ===");
run(`scp -i "${KEY}" -o StrictHostKeyChecking=accept-new ${pkg} ${HOST}:${REMOTE_DIR}/`, { stdio: "inherit" });
log("  上传完成");

// ---------- 5. 远端发布（流式输出） ----------
log("=== [5/6] 服务器发布（apply-release.sh）===");
await new Promise((resolve) => {
  const child = spawn(SSH_BASE[0], [...SSH_BASE.slice(1), `cd ${REMOTE_DIR} && bash deploy/apply-release.sh`], { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => {
    if (code !== 0) { console.error(`❌ 远端发布失败（exit ${code}）。可用 bash deploy/rollback.sh 回滚上一版`); process.exit(code ?? 1); }
    resolve();
  });
});

// ---------- 6. 远端验证 + 报告 ----------
log("=== [6/6] 线上验证 ===");
// 远端脚本只用双引号（外层 ssh 参数用单引号包裹，无需二次转义）
const remoteScript = `cd ${REMOTE_DIR} && echo "{\\"commit\\":\\"$(git rev-parse HEAD | cut -c1-7)\\",\\"buildId\\":\\"$(cat .next/BUILD_ID)\\",\\"health\\":\\"$(curl -s -o /dev/null -w %{http_code} http://localhost:3002/api/health)\\",\\"starsea\\":\\"$(curl -s -o /dev/null -w %{http_code} http://localhost:3002/api/garden/starsea?bbox=0,0,1,1)\\",\\"garden\\":\\"$(curl -s -o /dev/null -w %{http_code} http://localhost:3002/zh/garden)\\",\\"protoBlocked\\":\\"$([ \\"$(curl -s -o /dev/null -w %{http_code} http://localhost:3002/concept)\\" = 404 ] && echo yes || echo no)\\",\\"migrations\\":\\"$(node tools/db-migrate.mjs status 2>/dev/null | grep -c applied)\\"}"`;
assert(!remoteScript.includes("'"), "内部错误：remoteScript 含单引号会破坏外层引号");
const verify = run(`${SSH_BASE.join(" ")} '${remoteScript}'`).trim();
let v = {};
try { v = JSON.parse(verify); } catch { log("  （验证输出解析失败，原文：\n" + verify + "）"); }
assert(v.health === "200", `health 异常：${v.health}`);
assert(v.starsea === "200", `starsea 异常：${v.starsea}`);
assert(v.garden === "200", `/zh/garden 异常：${v.garden}`);
log(`  commit=${v.commit} BUILD_ID=${(v.buildId || "").slice(0, 8)} health=${v.health} starsea=${v.starsea} garden=${v.garden} 迁移已应用=${v.migrations} 原型屏蔽=${v.protoBlocked}`);

// 报告落盘
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const reportDir = "deploy-reports";
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, `release-${stamp}.md`), [
  `# 发布报告 ${stamp}`,
  ``,
  `- commit：\`${commit.slice(0, 7)}\`（${run("git log -1 --format=%s").replace(/"/g, "'")}）`,
  `- 包体：${pkg} ${size}MB（隔离构建 .next-release → --transform → .next）`,
  `- BUILD_ID：\`${v.buildId}\``,
  `- 验证：health=${v.health} · starsea=${v.starsea} · /zh/garden=${v.garden} · 迁移已应用=${v.migrations} · 原型路由屏蔽=${v.protoBlocked}`,
  `- 回滚：\`ssh -i ~/.ssh/bian_deploy ${HOST} 'bash ${REMOTE_DIR}/deploy/rollback.sh'\`（数据库备份列表加 --list）`,
  ``,
].join("\n"));
log(`\n✅ 发布完成。报告：${reportDir}/release-${stamp}.md`);
