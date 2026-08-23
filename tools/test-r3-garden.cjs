const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 460, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const base = "http://localhost:7102/proto/index.html";
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
  const ok = (m) => console.log("ok - " + m);

  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // 屏01 登录（新手机号 + devCode 自动回填）
  const phone = "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const phoneInput = page.locator('input[type="tel"], input[placeholder*="手机"]').first();
  if (await phoneInput.count()) {
    await phoneInput.fill(phone);
    await page.locator("text=获取验证码").first().click();
    await page.waitForTimeout(600);
    const codeInput = page.locator('input[maxlength="6"], input[placeholder*="验证码"]').first();
    if (await codeInput.count() && !(await codeInput.inputValue())) {
      // 尝试 devCode 回填：从响应或界面读取
      const dev = await page.locator("text=/\\d{6}/").first().textContent().catch(() => "");
      const m = dev && dev.match(/\d{6}/);
      if (m) await codeInput.fill(m[0]);
    }
    await page.locator("text=/登 录|登录|进入彼岸/").first().click();
    await page.waitForTimeout(1200);
    ok("登录流程执行");
  } else {
    console.log("skip - 已是登录态或无登录屏");
  }

  // 空态页（新用户无馆）点「先去公共墓园看看」
  const gardenBtn = page.locator("#empty-garden");
  if (await gardenBtn.count()) {
    await gardenBtn.click();
    await page.waitForTimeout(900);
  } else {
    // 已有馆：点底部「发现」tab
    await page.locator('.tab[data-tab="garden"]').click();
    await page.waitForTimeout(900);
  }

  // 断言落在 garden 视图
  const view = await page.evaluate(() => window.BianRouter.current());
  view === "garden" ? ok("落在 garden 视图") : fail("当前视图=" + view);
  const cards = await page.locator(".garden-card").count();
  cards >= 3 ? ok(`卡片数 ${cards} >= 3`) : fail(`卡片数 ${cards}`);

  // 搜索「王」筛选
  await page.fill("#garden-q", "王");
  await page.waitForTimeout(700);
  const filtered = await page.locator(".garden-card").count();
  filtered >= 1 && filtered < cards ? ok(`搜索「王」筛到 ${filtered} 张`) : fail(`搜索后 ${filtered} 张（原 ${cards}）`);

  // 点第一张卡 → 访客态进馆
  const firstName = await page.locator(".garden-card .font-medium").first().textContent();
  await page.locator(".garden-card").first().click();
  await page.waitForTimeout(1000);
  const v2 = await page.evaluate(() => window.BianRouter.current());
  v2 === "home" ? ok("点卡进 home") : fail("点卡后视图=" + v2);
  const mName = await page.locator("#m-name").textContent().catch(() => "");
  mName.includes(firstName.trim()) ? ok(`馆名匹配：${mName.trim()}`) : fail(`馆名=${mName} 期望含 ${firstName}`);

  // 底部 tab：发现 → 纪念馆（清栈回根）
  await page.locator('.tab[data-tab="garden"]').click();
  await page.waitForTimeout(700);
  (await page.evaluate(() => window.BianRouter.current())) === "garden" ? ok("tab 回 garden") : fail("tab garden 失败");
  await page.locator('.tab[data-tab="hall"]').click();
  await page.waitForTimeout(700);
  const v3 = await page.evaluate(() => window.BianRouter.current());
  v3 === "home" ? ok("tab hall 清栈回 home") : console.log("note - tab hall 后视图=" + v3 + "（该用户可能已有自己的馆）");

  errors.length ? fail("pageerror: " + errors.join(" | ")) : ok("无 pageerror");
  await browser.close();
})();
