// M4 走查补测：G07 Esc 行为（修正版）+ G08 hover（非 active 项）
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:7106/legacy/pc.html";
const OUT = "E:/彼岸/docs/web/walkthrough";

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const results = {};

  // ---------- G07：干净 page（不预置 localStorage） ----------
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(BASE, { waitUntil: "networkidle" });

  // 1) 触发 openChat → 弹层应显示；Esc 不应关闭
  await page.evaluate(() => {
    document.getElementById("chatStrip").click();
  });
  await page.waitForTimeout(300);
  const introShown = await page.evaluate(
    () => document.getElementById("introMask").style.display === "flex"
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const introStillThere = await page.evaluate(
    () => document.getElementById("introMask").style.display === "flex"
  );
  const panelStillClosed = await page.evaluate(() =>
    document.getElementById("chatPanel").classList.contains("collapsed")
  );
  await page.screenshot({ path: OUT + "/manual-G07-intro-esc.png" });

  // 2) 确认弹层 → 侧板展开 → Esc 应收起
  await page.evaluate(() => {
    // 点击确认按钮
    const btns = Array.from(document.querySelectorAll("#introMask button"));
    (btns[btns.length - 1] || btns[0]).click();
  });
  await page.waitForTimeout(400);
  const panelOpen = await page.evaluate(
    () => !document.getElementById("chatPanel").classList.contains("collapsed")
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const panelClosedByEsc = await page.evaluate(
    () => document.getElementById("chatPanel").classList.contains("collapsed")
  );
  results.G07 = {
    pass: introShown && introStillThere && panelStillClosed && panelOpen && panelClosedByEsc,
    detail: `弹层首显=${introShown}，Esc 后仍在=${introStillThere}（不可关闭 ✓）；确认后侧板展开=${panelOpen}，Esc 收起=${panelClosedByEsc}`,
  };

  // ---------- G08：hover 非 active 导航 + 对话竖条 ----------
  const myLink = page.locator(".side-link").nth(2); // 「我的」非 active
  const bgBefore = await myLink.evaluate((el) => getComputedStyle(el).backgroundColor);
  await myLink.hover();
  await page.waitForTimeout(300);
  const bgAfter = await myLink.evaluate((el) => getComputedStyle(el).backgroundColor);
  const stripHoverBg = await page.locator("#chatStrip").evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.locator("#chatStrip").hover();
  await page.waitForTimeout(300);
  const stripHoverBgAfter = await page.locator("#chatStrip").evaluate((el) => getComputedStyle(el).backgroundColor);
  const navOk = bgBefore !== bgAfter;
  const stripOk = stripHoverBg !== stripHoverBgAfter;
  results.G08 = {
    pass: navOk && stripOk,
    detail: `导航「我的」hover 背景 ${bgBefore} → ${bgAfter}；竖条 hover ${stripHoverBg} → ${stripHoverBgAfter}`,
  };
  await page.screenshot({ path: OUT + "/manual-G08-hover.png" });

  await browser.close();
  for (const [k, v] of Object.entries(results)) {
    console.log(`- ${v.pass ? "✅" : "❌"} **${k}**：${v.detail}`);
  }
  console.log("ALL_PASS=" + Object.values(results).every((v) => v.pass));
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
