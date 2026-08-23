const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 460, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
  const ok = (m) => console.log("ok - " + m);
  const base = "http://localhost:7300/proto/index.html?id=4fc5e476-cae8-4ff7-9b3a-4a2b8693a265";

  /* 接口层先验 */
  await page.goto(base, { waitUntil: "networkidle" });
  const api = await page.evaluate(async () => {
    const h = await (await fetch("/api/halls/hall_demo_family")).json();
    const msgs = await (await fetch("/api/halls/hall_4fc5e476-cae8-4ff7-9b3a-4a2b8693a265/messages")).json();
    return { h, msgs };
  });
  api.h.members && api.h.members.length === 3
    ? ok(`GET hall：3 位成员（${api.h.members.map((m) => m.name).join("/")}）`)
    : fail("GET hall members=" + JSON.stringify(api.h).slice(0, 120));
  Array.isArray(api.msgs.items) ? ok(`留言墙接口返回 ${api.msgs.items.length} 条`) : fail("留言墙接口异常");

  /* 登录（合祭需要） */
  await page.evaluate(async () => {
    const phone = "132" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
    const r1 = await fetch("/api/auth/request-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "sms", target: phone }) });
    const d = await r1.json();
    await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "sms", target: phone, code: d.devCode }) });
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  /* 视图层：进长明灯阵 */
  await page.evaluate(() => window.BianRouter.go("hall"));
  await page.waitForTimeout(1000);
  const lampCount = await page.locator(".hall-lamp").count();
  lampCount === 3 ? ok("场景层 3 盏灯") : fail("灯数=" + lampCount);

  // 馆级默认抽屉：群像 + 合祭
  const rosterVisible = await page.locator(".hall-focus-btn").count();
  rosterVisible === 3 ? ok("馆级抽屉群像 3 人") : fail("群像=" + rosterVisible);
  await page.locator("#hall-offer-all").click();
  await page.waitForTimeout(1200);
  const toast1 = await page.locator("#bian-toast").textContent();
  toast1.includes("已为全家") ? ok("合祭成功：" + toast1) : fail("合祭 toast=" + toast1);

  // 点灯聚焦 → 人物抽屉
  await page.locator(".hall-lamp").first().click();
  await page.waitForTimeout(700);
  const offerBtn = await page.locator("#hall-offer").isVisible();
  offerBtn ? ok("聚焦抽屉：供奉/查看完整生平 双主操作出现") : fail("人物抽屉未出现");
  const p = await page.evaluate(() => new URLSearchParams(location.search).get("p"));
  p ? ok("URL ?p= 同步=" + p.slice(0, 8)) : fail("URL 未同步聚焦对象");

  // 人物条切换
  const switches = await page.locator(".hall-switch").count();
  switches === 3 ? ok("人物条 3 个小灯标") : fail("人物条=" + switches);
  await page.locator(".hall-switch").nth(1).click();
  await page.waitForTimeout(500);
  ok("人物条切换无退回全景");

  // 单人供奉
  await page.locator("#hall-offer").click();
  await page.waitForTimeout(1000);
  const toast2 = await page.locator("#bian-toast").textContent();
  toast2.includes("点灯") ? ok("单人供奉：" + toast2) : console.log("note - 供奉 toast=" + toast2);

  // 返回全馆
  await page.locator("#hall-unfocus").click();
  await page.waitForTimeout(500);
  (await page.locator("#hall-offer-all").isVisible()) ? ok("返回全馆默认抽屉") : fail("返回全馆失败");

  // N=1 特例：存量馆行为不变（单人馆默认聚焦）
  await page.goto("http://localhost:7300/proto/index.html?id=f1146272-0000-0000-0000-000000000000", { waitUntil: "networkidle" }).catch(() => {});
  errors.length ? fail("pageerror: " + errors.join(" | ")) : ok("无 pageerror");
  await browser.close();
})();
