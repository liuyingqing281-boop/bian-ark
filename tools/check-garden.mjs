// 发现页（星海）收尾冒烟：沉浸壳契约 / 星海 API / 我的页 hall 链接 / 真实供奉接线
// 2026-09-01 正式化改造：旧版断言 GardenViewSwitch 墓园卡片语义（组件已随星海上线
// 删除，读取即 ENOENT）；现对齐正式 /zh/garden 语义，口径与 smoke-p2 星海段一致。
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";

const BASE = "http://localhost:7300";

const child = await (async () => {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return null;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  const c = spawn("npx", ["next", "dev", "-p", "7300"], { shell: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  c.stdout.on("data", (d) => (log += d));
  c.stderr.on("data", (d) => (log += d));
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return c;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error("server not ready", log.slice(-1500));
  process.exit(1);
})();

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  | " + extra : ""}`);
  ok ? pass++ : fail++;
};

try {
  const page = await fetch(`${BASE}/zh/garden`);
  const html = await page.text();
  check("GET /zh/garden 200", page.status === 200);
  check("页面含沉浸星海壳（starsea-shell + garden-sea）",
    html.includes("starsea-shell") && html.includes("garden-sea"));
  check("旧墓园卡片标记已移除", /garden-card|tombstone|garden-card-rail|garden-nav/.test(html) === false);

  const sea = await fetch(`${BASE}/api/garden/starsea?bbox=0,0,1,1&limit=500`);
  const seaData = await sea.json().catch(() => ({}));
  check("GET /api/garden/starsea 200 返回馆数组", sea.status === 200 && Array.isArray(seaData.halls));
  check("星海分片只下发脱敏名", seaData.halls?.every((h) => typeof h.nameMasked === "string" && !("name" in h)) === true);

  // 源码级接线断言（detail/offer 均为 client 渲染，SSR HTML 不含）
  const gsSrc = fs.readFileSync("src/components/starsea/GardenSea.tsx", "utf8");
  check("园内供奉接真实 /api/tribute", gsSrc.includes("/api/tribute"));

  const meSrc = fs.readFileSync("src/components/MePanels.tsx", "utf8");
  check("我的页查看链接指向 hall 页", meSrc.includes("/hall/${memorial.id}") && !meSrc.includes("/memorial/${memorial.id}"));

  // 端到端：园内供奉链路等价于直接 POST /api/tribute（公开馆）
  const fd = new FormData();
  fd.set("memorial_id", "4fc5e476-cae8-4ff7-9b3a-4a2b8693a265");
  fd.set("item_id", "candle");
  fd.set("lang", "zh");
  fd.set("is_burning", "1");
  fd.set("message", "发现页冒烟供奉");
  const tri = await fetch(`${BASE}/api/tribute`, { method: "POST", body: fd, redirect: "manual" });
  check("发现页供奉链路（candle+点灯）302", [302, 303, 307].includes(tri.status), `status=${tri.status}`);
} finally {
  if (child) {
    try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
