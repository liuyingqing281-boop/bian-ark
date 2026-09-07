#!/usr/bin/env node
// 外部拨测工具（docs/16 P2-1）：
// 从“服务器之外”（本机 / GitHub Actions runner / 任意 cron 主机）验证 https://bianmuyuan.cn 可用性。
// 用法：
//   node tools/probe.mjs                 # 健康三项：/api/health、/zh/garden、starsea bbox
//   node tools/probe.mjs --check-proto-blocked   # 另加 P0-2 验收：五个演示/原型路由须 404
//   node tools/probe.mjs --base https://example.com --timeout 15000
// 退出码：0 = 全部通过；1 = 任一失败。stdout 一行 JSON 摘要；stderr 输出明细。
const base = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : (process.env.PROBE_BASE || "https://bianmuyuan.cn");
const timeoutMs = Number(
  process.argv.includes("--timeout")
    ? process.argv[process.argv.indexOf("--timeout") + 1]
    : (process.env.PROBE_TIMEOUT_MS || 15000)
);
const checkProtoBlocked = process.argv.includes("--check-proto-blocked");

const checks = [
  { name: "health", url: "/api/health", expect: 200 },
  { name: "garden", url: "/zh/garden", expect: 200 },
  { name: "starsea", url: "/api/garden/starsea?bbox=0,0,1,1", expect: 200 },
];
if (checkProtoBlocked) {
  // P0-2：生产模式五个演示/原型路由必须 404（ENABLE_PROTO_ROUTES 未开启）。
  // 注意不带尾斜杠：/proto/ 这类路径会先被 Next 路由层 308 到尾斜杠版本，探测尾斜杠变体语义不稳。
  for (const p of ["/concept", "/proto", "/prototype", "/proto-zcode", "/showreel"]) {
    checks.push({ name: `blocked:${p}`, url: p, expect: 404 });
  }
}

async function one(c) {
  const url = base.replace(/\/$/, "") + c.url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal });
    return { name: c.name, url, got: res.status, ok: res.status === c.expect };
  } catch (e) {
    return { name: c.name, url, got: e.name === "AbortError" ? "timeout" : e.cause?.code || e.message, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(checks.map(one));
const failed = results.filter((r) => !r.ok);
const summary = { base, at: new Date().toISOString(), passed: results.length - failed.length, total: results.length, ok: failed.length === 0, failed };
console.log(JSON.stringify(summary));
if (failed.length) {
  for (const f of failed) console.error(`❌ ${f.name}: expected ${f.expect}, got ${f.got} (${f.url})`);
}
process.exit(failed.length === 0 ? 0 : 1);
