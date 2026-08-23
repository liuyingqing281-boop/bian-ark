// M4 真实工程冒烟：侧板打开 + 历史水合（未登录应为空态）+ feed 接口分页字段
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200));
  });

  // 预置已读身份说明
  await page.addInitScript(() => {
    try { localStorage.setItem("pc.chat.intro", "1"); } catch {}
  });

  await page.goto(
    "http://localhost:7107/zh/hall/4fc5e476-cae8-4ff7-9b3a-4a2b8693a265",
    { waitUntil: "networkidle", timeout: 60000 }
  );

  // feed 接口分页字段直测
  const feed = await page.evaluate(async () => {
    const r = await fetch(
      "/api/hall/feed?memorial_id=4fc5e476-cae8-4ff7-9b3a-4a2b8693a265&limit=5"
    );
    const d = await r.json();
    return { status: r.status, hasNextCursorField: "nextCursor" in d, items: (d.items || []).length };
  });

  // history 接口直测（未登录应 200 + 空）
  const hist = await page.evaluate(async () => {
    const r = await fetch(
      "/api/hall/chat/history?memorial_id=4fc5e476-cae8-4ff7-9b3a-4a2b8693a265"
    );
    const d = await r.json();
    return { status: r.status, items: (d.items || []).length, hasMore: !!d.hasMore };
  });

  // 打开侧板（点竖条）
  await page.locator(".pc-chat-strip").click();
  await page.waitForTimeout(1200);
  const panelVisible = await page.evaluate(() => {
    const p = document.querySelector(".pc-chat-panel");
    return !!p && !p.classList.contains("collapsed");
  });
  const chatHeader = await page.locator(".pc-chat-panel").innerText().catch(() => "");
  await page.screenshot({ path: "E:/彼岸/docs/web/walkthrough/m4-chatpanel-1440.png" });

  // Esc 收起
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const panelCollapsed = await page.evaluate(() => {
    const p = document.querySelector(".pc-chat-panel");
    return !!p && p.classList.contains("collapsed");
  });

  console.log(JSON.stringify({ feed, hist, panelVisible, panelCollapsed, chatHasTitle: chatHeader.includes("说说话"), errors }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
