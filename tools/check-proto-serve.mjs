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

  for (const p of ["home.html", "chat.html", "miss.html", "memory.html", "memory-add.html", "offering.html", "offering-pay.html", "gift.html", "profile.html", "chat-intro.html", "pc.html"]) {
    const r = await fetch(`${BASE}/proto/${p}`);
    check(`GET /proto/${p} 200`, r.status === 200);
  }

  const js = await fetch(`${BASE}/proto/shared/api.js`);
  check("api.js 可访问且为 js", js.status === 200 && (js.headers.get("content-type") || "").includes("javascript"));
  const css = await fetch(`${BASE}/proto/shared/ui.css`);
  check("ui.css 可访问", css.status === 200);
  const png = await fetch(`${BASE}/proto/assets/portrait.png`);
  check("assets/portrait.png 可访问", png.status === 200 && (png.headers.get("content-type") || "").includes("image/png"));

  const esc = await fetch(`${BASE}/proto/..%2F..%2Fpackage.json`);
  check("目录穿越被拒", [400, 403, 404].includes(esc.status), `status=${esc.status}`);

  // 原型页已接入 api.js
  check("home.html 引用 api.js", idxHtml.includes("iframe") && (await (await fetch(`${BASE}/proto/home.html`)).text()).includes("shared/api.js"));

  // 非 proto 路径安全头不变
  const api = await fetch(`${BASE}/api/health`);
  check("非 proto 路径仍 X-Frame-Options DENY", api.headers.get("x-frame-options") === "DENY");
} finally {
  if (child) child.kill("SIGTERM");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
