const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 460, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
  const ok = (m) => console.log("ok - " + m);
  const base = "http://localhost:7300/proto/index.html?id=4fc5e476-cae8-4ff7-9b3a-4a2b8693a265";

  /* 接口层 */
  await page.goto(base, { waitUntil: "networkidle" });
  const sea = await page.evaluate(async () => (await (await fetch("/api/garden/starsea")).json()));
  sea.halls && sea.halls.length >= 5 ? ok(`starsea 返回 ${sea.halls.length} 个星群`) : fail("starsea=" + JSON.stringify(sea).slice(0, 150));
  const fam = sea.halls.find((h) => h.hallId === "hall_demo_family");
  fam && fam.lampCount === 3 && fam.zone === "family" ? ok("家族馆：lampCount=3 zone=family") : fail("家族馆数据=" + JSON.stringify(fam));
  const masked = sea.halls.every((h) => h.nameMasked.includes("*"));
  masked ? ok("馆名/人名全部脱敏") : fail("存在未脱敏名称");
  const noHot = sea.halls.every((h) => !("views" in h) && !("heat" in h));
  noHot ? ok("红线：无访问量/热度字段") : fail("出现热度字段");
  // zone/bbox 过滤
  const famOnly = await page.evaluate(async () => (await (await fetch("/api/garden/starsea?zone=family")).json()));
  famOnly.halls.length === 1 ? ok("zone=family 分片正确") : fail("zone 过滤=" + famOnly.halls.length);
  const bbox = await page.evaluate(async () => (await (await fetch("/api/garden/starsea?bbox=0.4,0.2,0.6,0.45")).json()));
  bbox.halls.length >= 1 && bbox.halls.every((h) => h.x >= 0.4 && h.x <= 0.6) ? ok("bbox 视口分片正确") : fail("bbox=" + bbox.halls.length);
  // 缓存头
  const cacheHeader = await page.evaluate(async () => (await fetch("/api/garden/starsea")).headers.get("cache-control"));
  cacheHeader && cacheHeader.includes("max-age=15") ? ok("短缓存 private max-age=15") : console.log("note - cache-control=" + cacheHeader);

  /* 登录后测择位 */
  await page.evaluate(async () => {
    const phone = "1310000" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0"); // 测试号段，跳过真实短信
    const r1 = await fetch("/api/auth/request-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "sms", target: phone }) });
    const d = await r1.json();
    await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "sms", target: phone, code: d.devCode, intent: "register", agreed: true }) });
    // 建一座自己的公开馆用于择位
    const c = await fetch("/api/memorials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "择位测试", type: "person", visibility: "public" }) });
    const cd = await c.json();
    window.__mid = cd.id || cd.memorialId || (cd.memorial && cd.memorial.id);
  });
  const mid = await page.evaluate(() => window.__mid);
  const hallId = "hall_" + mid;
  // 择位：正常点
  const place = await page.evaluate(async (h) => {
    const r = await fetch(`/api/halls/${h}/garden-pos`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ x: 0.85, y: 0.8 }) });
    return { s: r.status, d: await r.json() };
  }, hallId);
  place.s === 200 && place.d.in_garden === true ? ok("择位成功（0.85,0.8）") : fail("择位=" + JSON.stringify(place));
  // 冲突：贴已占用点
  const conflict = await page.evaluate(async (h) => {
    const r = await fetch(`/api/halls/${h}/garden-pos`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ x: 0.2, y: 0.55 }) });
    return { s: r.status, d: await r.json() };
  }, hallId);
  conflict.s === 409 && conflict.d.suggested ? ok(`409 冲突检测 + 建议位 (${conflict.d.suggested.x},${conflict.d.suggested.y})`) : fail("冲突=" + JSON.stringify(conflict));
  // 移出
  const remove = await page.evaluate(async (h) => {
    const r = await fetch(`/api/halls/${h}/garden-pos`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ x: null, y: null }) });
    return { s: r.status, d: await r.json() };
  }, hallId);
  remove.s === 200 && remove.d.in_garden === false ? ok("移出星海成功") : fail("移出=" + JSON.stringify(remove));

  /* 视图层：星海渲染 + 点星进馆 */
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.BianRouter.go("starsea"));
  await page.waitForTimeout(1000);
  const stars = await page.locator(".sea-star").count();
  stars >= 5 ? ok(`星海渲染 ${stars} 颗星`) : fail("星数=" + stars);
  await page.locator(".sea-star").first().click();
  await page.waitForTimeout(500);
  const focusCard = await page.locator("#sea-enter").isVisible();
  focusCard ? ok("点星出聚焦卡") : fail("聚焦卡未出现");
  await page.locator("#sea-enter").click();
  await page.waitForTimeout(1000);
  const lampVisible = (await page.locator(".hall-lamp").count()) >= 1;
  lampVisible ? ok("进馆进入灯阵（园→馆衔接）") : fail("未进入灯阵");

  errors.length ? fail("pageerror: " + errors.join(" | ")) : ok("无 pageerror");
  await browser.close();
})();
