// 总回归：hall 页 8 项 + feed 混合流 + 免费供奉 + mock 订单付费供奉
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

const BASE = "http://localhost:7300";
const MEMORIAL = "4fc5e476-cae8-4ff7-9b3a-4a2b8693a265"; // 王老先生（public）
const DB_PATH = path.resolve("data", "bian.db");

// ---- 预置回归数据：public 留言 + 悼文 + 付费祭品 + 已支付订单 ----
const PREMIUM_ITEM = "smoke_premium_candle";
const PAID_ORDER = `smoke-order-${randomUUID()}`;
const seededMessageIds = [];
const seedDb = new Database(DB_PATH);
{
  seedDb.prepare(
    "INSERT OR REPLACE INTO items (id, name, category, icon, price_cents, is_premium) VALUES (?, '长明灯', 'light', '🏮', 1800, 1)"
  ).run(PREMIUM_ITEM);
  for (const [type, content] of [
    ["public", "总回归留言：一直想念您"],
    ["eulogy", "总回归悼文：音容宛在"],
    ["private", "回归负例悄悄话不应出现在feed"],
  ]) {
    const id = randomUUID();
    seededMessageIds.push(id);
    seedDb.prepare(
      "INSERT INTO messages (id, memorial_id, user_id, msg_type, content, review_status) VALUES (?, ?, '', ?, ?, 'approved')"
    ).run(id, MEMORIAL, type, content);
  }
  seedDb.prepare(
    "INSERT INTO orders (id, user_id, kind, status, amount_cents, currency) VALUES (?, '', 'tribute', 'paid', 1800, 'cny')"
  ).run(PAID_ORDER);
}
// 直插数据兜底清理：无论脚本正常结束还是中途抛错都不留污染。
// 复用预置阶段的连接（进程退出阶段新开连接在 Windows 上会 disk I/O error）
const cleanupSeeded = () => {
  try {
    const ph = seededMessageIds.map(() => "?").join(",");
    seedDb.prepare(`DELETE FROM messages WHERE id IN (${ph})`).run(...seededMessageIds);
    seedDb.prepare("DELETE FROM tributes WHERE item_id = ?").run(PREMIUM_ITEM);
    seedDb.prepare("DELETE FROM items WHERE id = ?").run(PREMIUM_ITEM);
    seedDb.prepare("DELETE FROM orders WHERE id = ?").run(PAID_ORDER);
  } catch (err) {
    console.error("cleanup failed:", err.message);
  } finally {
    try { seedDb.close(); } catch {}
  }
};
process.on("exit", cleanupSeeded);

const child = spawn("npx", ["next", "dev", "-p", "7300"], { shell: true, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", (d) => (log += d));
child.stderr.on("data", (d) => (log += d));

const deadline = Date.now() + 150_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const r = await fetch(`${BASE}/zh/hall/${MEMORIAL}`);
    if (r.status !== 404) { ready = true; break; }
  } catch {}
  await new Promise((r) => setTimeout(r, 2000));
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  | " + extra : ""}`);
  ok ? pass++ : fail++;
};

if (!ready) {
  console.error("server not ready", log.slice(-1500));
} else {
  // ===== A. hall 页（8 项） =====
  const page = await fetch(`${BASE}/zh/hall/${MEMORIAL}`);
  const html = await page.text();
  check("A1 GET /zh/hall/:id 200 且页面完整渲染", page.status === 200 && !html.includes("couldn’t load"));
  check("A2 页面含真实纪念馆名", html.includes("王老先生"));
  check("A3 页面含暗红熔岩底色", html.includes("#070302") || html.includes("rgba(255,106,32"));
  // A4 与 check-pages 的客户端渲染检查方式一致（同 K1/G1）：
  // HallChat 为 client 组件，SSR HTML 只验挂载标记；身份说明文案在组件源码中静态验证
  const chatMounted = html.includes("HallChat") || html.includes("和 TA 说说话");
  const chatSource = fs.readFileSync(path.resolve(process.cwd(), "src", "components", "hall", "HallChat.tsx"), "utf8");
  const chatCopyOk = chatSource.includes("和 TA 说说话") && chatSource.includes("它不是 TA 本人");
  check("A4 对话面板与身份说明（client 渲染）", chatMounted && chatCopyOk);

  const chatRes = await fetch(`${BASE}/api/hall/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memorial_id: MEMORIAL, message: "我今天有点想 TA" }),
  });
  const chatData = await chatRes.json().catch(() => ({}));
  check("A5 POST /api/hall/chat 200", chatRes.status === 200, `provider=${chatData.provider}`);
  check("A6 对话返回文本与推测标识", !!chatData.text && chatData.inferred === true);

  const fd = new FormData();
  fd.set("memorial_id", MEMORIAL);
  fd.set("item_id", "flower_white");
  fd.set("lang", "zh");
  const tri = await fetch(`${BASE}/api/tribute`, { method: "POST", body: fd, redirect: "manual" });
  check("A7 POST /api/tribute 免费供奉重定向", tri.status === 303 || tri.status === 307 || tri.status === 302 || tri.ok);

  const page2 = await fetch(`${BASE}/zh/hall/${MEMORIAL}`);
  const html2 = await page2.text();
  check("A8 纪念流出现新供奉", html2.includes("白菊"));

  // ===== B. feed 混合流 =====
  const feedRes = await fetch(`${BASE}/api/hall/feed?memorial_id=${MEMORIAL}`);
  const feed = await feedRes.json().catch(() => ({}));
  const items = feed.items || [];
  check("B1 GET /api/hall/feed 200 且返回 items", feedRes.status === 200 && Array.isArray(items));
  const kinds = new Set(items.map((i) => i.kind));
  check("B2 混合流含 tribute 与 message", kinds.has("tribute") && kinds.has("message"), `kinds=${[...kinds]}`);
  const shapeOk = items.every(
    (i) => "icon" in i && "label" in i && "senderMasked" in i && "message" in i && "isBurning" in i && "createdAt" in i
  );
  check("B3 条目结构完整 {icon,label,senderMasked,message,isBurning,createdAt}", items.length > 0 && shapeOk);
  const maskOk = items.every((i) => i.senderMasked === "访客" || /^.\*\*$/u.test(i.senderMasked));
  check("B4 sender 打码符合「李**」规则", maskOk, items[0] ? `样例=${items[0].senderMasked}` : "");
  const sorted = items.every((v, i) => i === 0 || items[i - 1].createdAt >= v.createdAt);
  check("B5 按 createdAt 倒序", sorted);
  check("B6 悼文进入混合流", items.some((i) => i.kind === "message" && i.label === "写下悼文"));
  check("B7 悄悄话不进入混合流", !items.some((i) => i.kind === "message" && i.message.includes("悄悄话")));
  const feed404 = await fetch(`${BASE}/api/hall/feed?memorial_id=not-exist`);
  const feed404Data = await feed404.json().catch(() => ({}));
  check("B8 不存在纪念馆返回空 items", feed404.status === 200 && Array.isArray(feed404Data.items) && feed404Data.items.length === 0);

  // ===== C. 付费供奉（mock 订单） =====
  const fdNoOrder = new FormData();
  fdNoOrder.set("memorial_id", MEMORIAL);
  fdNoOrder.set("item_id", PREMIUM_ITEM);
  fdNoOrder.set("lang", "zh");
  const triNoOrder = await fetch(`${BASE}/api/tribute`, { method: "POST", body: fdNoOrder, redirect: "manual" });
  const locNoOrder = triNoOrder.headers.get("location") || "";
  check("C1 付费祭品无订单被拦截", locNoOrder.includes("order_required=1"), locNoOrder);

  const fdPaid = new FormData();
  fdPaid.set("memorial_id", MEMORIAL);
  fdPaid.set("item_id", PREMIUM_ITEM);
  fdPaid.set("lang", "zh");
  fdPaid.set("order_id", PAID_ORDER);
  const triPaid = await fetch(`${BASE}/api/tribute`, { method: "POST", body: fdPaid, redirect: "manual" });
  const locPaid = triPaid.headers.get("location") || "";
  check(
    "C2 付费祭品+已支付订单放行",
    (triPaid.status === 302 || triPaid.status === 303 || triPaid.status === 307) && !locPaid.includes("order_required"),
    locPaid
  );

  const feed2Res = await fetch(`${BASE}/api/hall/feed?memorial_id=${MEMORIAL}`);
  const feed2 = await feed2Res.json().catch(() => ({}));
  check(
    "C3 付费供奉出现在 feed",
    (feed2.items || []).some((i) => i.kind === "tribute" && i.label.includes("长明灯"))
  );
}

try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
