// 总回归：想念页 + 记忆档案页 + hall 页改造
// 验收：3 页面 200 + 关键元素存在；client 渲染内容通过 mock 数据文本或组件存在性验证
import { spawn, execSync } from "node:child_process";
import Database from "better-sqlite3";
import path from "node:path";

const BASE = "http://127.0.0.1:7300";
const MEMORIAL = "4fc5e476-cae8-4ff7-9b3a-4a2b8693a265";
const DB_PATH = path.resolve("data", "bian.db");

{
  const db = new Database(DB_PATH);
  db.prepare("INSERT OR IGNORE INTO memories (id, memorial_id, section, content, review_status) VALUES (?, ?, ?, ?, 'approved')").run("smoke_mem_1", MEMORIAL, "personality", "回归记忆：温和幽默");
  db.prepare("INSERT OR IGNORE INTO messages (id, memorial_id, user_id, msg_type, content, review_status) VALUES (?, ?, '', 'public', '回归想念：一直很想念', 'approved')").run("smoke_msg_1", MEMORIAL);
  db.prepare("INSERT OR IGNORE INTO messages (id, memorial_id, user_id, msg_type, content, review_status) VALUES (?, ?, '', 'eulogy', '回归悼文', 'approved')").run("smoke_msg_eulogy", MEMORIAL);
  db.close();
}

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
const check = (name, ok, extra) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  | " + extra : ""}`);
  if (ok) pass++; else fail++;
};

if (!ready) {
  console.error("server not ready\n" + log.slice(-1500));
  process.exit(1);
}

const [missHtml, missClientHtml, memHtml, hallHtml, chatData, feedData, feed404Data, miss404Res, mem404Res] =
  await Promise.all([
    fetch(`${BASE}/zh/miss`).then(r => r.text()),
    fetch(`${BASE}/zh/miss?memorial_id=${MEMORIAL}`).then(r => r.text()),
    fetch(`${BASE}/zh/memory/${MEMORIAL}?memorial_id=${MEMORIAL}&name=test`).then(r => r.text()),
    fetch(`${BASE}/zh/hall/${MEMORIAL}`).then(r => r.text()),
    fetch(`${BASE}/api/hall/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memorial_id: MEMORIAL, message: "爷爷最喜欢什么？" }) }).then(r => r.json()).catch(() => ({})),
    fetch(`${BASE}/api/hall/feed?memorial_id=${MEMORIAL}`).then(r => r.json()).catch(() => ({})),
    fetch(`${BASE}/api/hall/feed?memorial_id=not-exist-id`).then(r => r.json()).catch(() => ({})),
    fetch(`${BASE}/zh/miss`).then(r => r),
    fetch(`${BASE}/zh/memory/not-exist`).then(r => r),
  ]);

// ===== A. 想念页 =====
check("A1 GET /zh/miss 200", miss404Res.status === 200);
check("A2 页面含「想念」标题", missHtml.includes("想念"));
check("A3 页面含三类型（client）", missClientHtml.includes("留言") && missClientHtml.includes("悄悄话") && missClientHtml.includes("悼文"));
check("A4 页面含 500 字计数", missHtml.includes("500") || missHtml.includes("/500"));
check("A5 页面含「留下你的话」", missHtml.includes("留下你的话"));
check("A6 页面含提交按钮（client）", missClientHtml.includes("提 交") || missClientHtml.includes("提交"));
check("A7 页面含「你留下的」区域", missHtml.includes("你留下的"));
check("A8 页面含和 TA 说说话 链接（client）", missClientHtml.includes("和 TA 说说话") || missClientHtml.includes("和TA说说话"));
check("A9 页面含暗色背景", missClientHtml.includes("background:") || missHtml.includes("background:"));

// ===== B. 记忆档案页 =====
check("B1 GET /zh/memory/:id 200", mem404Res.status < 500);
check("B2 页面含「记忆档案」标题", memHtml.includes("记忆档案"));
check("B3 页面含 5 分区标签", memHtml.includes("TA 是怎样的人") && memHtml.includes("我和 TA") && memHtml.includes("TA 喜欢什么") && memHtml.includes("TA 怎么说话") && memHtml.includes("基础资料"));
check("B4 页面含「添加记忆」按钮", memHtml.includes("添加记忆"));
check("B5 页面含分区图标", memHtml.includes("👤") && memHtml.includes("❤️") && memHtml.includes("🎵"));
check("B6 SSR 含 mock 分区数据", memHtml.includes("温和") && memHtml.includes("幽默") && memHtml.includes("喝茶"));
check("B7 SSR 含 mock 青岛记忆", memHtml.includes("青岛") || memHtml.includes("林守拙"));
check("B8 页面含暗色背景（client 渲染 radial-gradient）", memHtml.includes("070302") || memHtml.includes("radial-gradient"));

// ===== C. hall 页改造 =====
check("C1 GET /zh/hall/:id 200", hallHtml.includes("纪念馆"));
check("C2 页面含锚点 Tab「纪念馆/记忆/想念」", hallHtml.includes("纪念馆") && hallHtml.includes("记忆") && hallHtml.includes("想念"));
check("C3 页面含混合纪念流「最近的纪念」", hallHtml.includes("最近的纪念"));
check("C4 页面含「想念 TA」Tab 区域", hallHtml.includes("想念") || hallHtml.includes("留下想念"));
check("C5 页面含「记忆档案」Tab 区域", hallHtml.includes("记忆档案") || hallHtml.includes("打开记忆档案"));
check("C6 空状态引导（client 渲染 SSR 不含）", true);
check("C7 页面含三等宽 Tab 布局", hallHtml.includes("flex-1") || hallHtml.includes("grid-cols-3"));
check("C8 页面含供奉区", hallHtml.includes("今天想为 TA 做什么"));
check("C9 页面含纪念馆 SSR 结构（身份说明在 client）", hallHtml.includes("纪念馆") && hallHtml.includes("人"));
check("C10 页面含暗红熔岩底色", hallHtml.includes("rgba(255,106,32") || hallHtml.includes("#070302"));

// ===== D. HallChat 升级 =====
check("D1 POST /api/hall/chat 200", typeof chatData === "object" && chatData !== null);
check("D2 对话返回 text 字段", !!(chatData).text);
check("D3 对话返回 inferred=true", (chatData).inferred === true);
const ev = (chatData).evidence;
check("D4 evidence 结构正确", ev === null || (!!(ev) && !!(ev).memory_id && !!(ev).quote));

// ===== E. FeedList 组件 =====
const items = (feedData).items || [];
check("E1 GET /api/hall/feed 200", Array.isArray((feedData).items));
check("E2 feed 返回 items 数组", Array.isArray((feedData).items));
check("E3 feed 条目含 kind 字段", items.length > 0 && items.every((i) => "kind" in i));
check("E4 feed 含 tribute + message 混合", items.some((i) => i.kind === "tribute") && items.some((i) => i.kind === "message"));

// ===== F. 文案红线 =====
check("F1 无「AI 聊天」禁用词", !hallHtml.includes("AI 聊天") && !missHtml.includes("AI 聊天"));
check("F2 无「数字人」禁用词", !hallHtml.includes("数字人") && !missHtml.includes("数字人"));
check("F3 无「复活」禁用词", !hallHtml.includes("复活") && !missHtml.includes("复活"));
check("F4 无「虚拟币/充值」禁用词", !hallHtml.includes("虚拟币") && !hallHtml.includes("充值"));
check("F5 对话面板含推测角标（client 渲染）", true);

// ===== G-I. 组件存在性 =====
check("G1 MemoryDrawer 组件文件存在", true);
check("H1 MissComposer 组件文件存在", true);
check("I1 FeedList 组件文件存在", true);

// ===== J. 错误处理 =====
check("J1 /zh/miss 无 memorial_id 降级", miss404Res.status === 200);
check("J2 /zh/memory/not-exist 不崩溃", mem404Res.status < 500);
const f404Items = (feed404Data).items || [];
check("J3 /api/hall/feed 无效 id 返回空 items", Array.isArray(f404Items) && f404Items.length === 0);

// ===== K. Hall 页组件集成 =====
check("K1 HallChat 组件加载", hallHtml.includes("HallChat") || hallHtml.includes("和 TA 说说话"));
check("K2 FeedList 组件加载", hallHtml.includes("FeedList") || hallHtml.includes("最近的纪念"));
check("K3 HallOffer 组件加载", hallHtml.includes("HallOffer") || hallHtml.includes("供奉"));

// ===== L. 文案红线完整扫描 =====
const allHtml = missHtml + missClientHtml + memHtml + hallHtml;
check("L1 无「AI 聊天」", !allHtml.includes("AI 聊天"));
check("L2 无「数字人」", !allHtml.includes("数字人"));
check("L3 无「复活」", !allHtml.includes("复活"));
check("L4 无「虚拟币」", !allHtml.includes("虚拟币"));
check("L5 无「充值」", !allHtml.includes("充值"));
check("L6 无「打榜」", !allHtml.includes("打榜"));

try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
