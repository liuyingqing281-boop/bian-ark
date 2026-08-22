// 发现页（园中园）收尾冒烟：页面 / API / 与 hall 新页互通 / 真实供奉接线
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
  check("页面含公共墓园标题", html.includes("公共墓园"));
  check("全局导航一级入口为「发现」", html.includes(`>发现<`));

  const api = await fetch(`${BASE}/api/garden`);
  const data = await api.json().catch(() => ({}));
  check("GET /api/garden 200 返回列表", api.status === 200 && Array.isArray(data.memorials));

  const q = await fetch(`${BASE}/api/garden?q=${encodeURIComponent("王老")}`);
  const qd = await q.json().catch(() => ({}));
  check("搜索可按名字过滤", qd.memorials?.some((m) => m.name.includes("王老")), `命中=${qd.memorials?.length}`);

  // 源码级接线断言（detail/offer 均为 client 渲染，SSR HTML 不含）
  const src = fs.readFileSync("src/components/GardenViewSwitch.tsx", "utf8");
  check("详情链接指向新版 hall 页", src.includes("/hall/${row.id}") && !src.includes("/memorial/${row.id}"));
  check("园内供奉接真实 /api/tribute", src.includes("'/api/tribute'") && src.includes("GARDEN_OFFER_ITEMS"));
  check("供奉选项映射真实祭品 id", src.includes("'candle'") && src.includes("'flower_white'") && src.includes("'flower_lily'"));

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
