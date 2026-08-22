// 冒烟：/proto 静态托管 + 安全头放行 + 原型页可访问
import { spawn } from "node:child_process";

const BASE = "http://localhost:7300";
const child = await (async () => {
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) }); if (r.ok) return null; } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  const c = spawn("npx", ["next", "dev", "-p", "7300"], { shell: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  c.stdout.on("data", (d) => (log += d));
  c.stderr.on("data", (d) => (log += d));
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    try { const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) }); if (r.ok) return c; } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error("server not ready", log.slice(-1500));
  process.exit(1);
})();

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  | " + extra : ""}`); ok ? pass++ : fail++; };

try {
  const idx = await fetch(`${BASE}/proto/index.html`);
  const idxHtml = await idx.text();
  check("GET /proto/index.html 200", idx.status === 200);
  check("content-type 为 html", (idx.headers.get("content-type") || "").includes("text/html"));
  check("proto 无 X-Frame-Options DENY", idx.headers.get("x-frame-options") !== "DENY");
  const csp = idx.headers.get("content-security-policy") || "";
  check("proto CSP 允许 self 嵌框", csp.includes("frame-ancestors 'self'"), csp.slice(0, 80));
  check("proto CSP 允许 tailwind CDN", csp.includes("cdn.tailwindcss.com"));

  for (const p of [
    // 单屏壳 + 共享层
    "index.html", "shared/api.js", "shared/router.js", "shared/shell.js", "shared/ui.css",
    // 7 视图 partial + 逻辑
    "views/home.html", "views/home.js", "views/miss.html", "views/miss.js",
    "views/chat.html", "views/chat.js", "views/memory.html", "views/memory.js",
    "views/offering.html", "views/offering.js", "views/gift.html", "views/gift.js",
    "views/profile.html", "views/profile.js",
    // legacy 走查版（路径已修正为 ../shared、../assets）
    "legacy/index.html", "legacy/home.html", "legacy/chat.html", "legacy/miss.html",
    "legacy/memory.html", "legacy/memory-add.html", "legacy/offering.html",
    "legacy/offering-pay.html", "legacy/gift.html", "legacy/profile.html",
    "legacy/chat-intro.html", "legacy/pc.html",
    "assets/portrait.png",
  ]) {
    const r = await fetch(`${BASE}/proto/${p}`);
    check(`GET /proto/${p} 200`, r.status === 200);
  }

  const js = await fetch(`${BASE}/proto/shared/api.js`);
  check("api.js content-type 为 js", (js.headers.get("content-type") || "").includes("javascript"));
  const png = await fetch(`${BASE}/proto/assets/portrait.png`);
  check("assets/portrait.png content-type 为 png", (png.headers.get("content-type") || "").includes("image/png"));

  const esc = await fetch(`${BASE}/proto/..%2F..%2Fpackage.json`);
  check("目录穿越被拒", [400, 403, 404].includes(esc.status), `status=${esc.status}`);

  // 单壳结构断言：视图容器 + 浮层 + 路由脚本
  check("index.html 为单壳（view-root/overlay-root/tabbar）",
    idxHtml.includes('id="view-root"') && idxHtml.includes('id="overlay-root"') && idxHtml.includes('id="tabbar"'));
  check("index.html 含 4 浮层（intro/pay/memadd/evidence）",
    ["ov-intro", "ov-pay", "ov-memadd", "ov-evidence"].every((x) => idxHtml.includes(`id="${x}"`)));
  check("index.html 引用 router.js 与 7 视图 js",
    idxHtml.includes("shared/router.js") && ["home", "miss", "chat", "memory", "offering", "gift", "profile"].every((v) => idxHtml.includes(`views/${v}.js`)));

  // legacy 路径修正断言
  const legacyHome = await (await fetch(`${BASE}/proto/legacy/home.html`)).text();
  check("legacy 页资源路径已修正（../shared）", legacyHome.includes('../shared/'));

  // 非 proto 路径安全头不变
  const api = await fetch(`${BASE}/api/health`);
  check("非 proto 路径仍 X-Frame-Options DENY", api.headers.get("x-frame-options") === "DENY");
} finally {
  if (child) child.kill("SIGTERM");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
