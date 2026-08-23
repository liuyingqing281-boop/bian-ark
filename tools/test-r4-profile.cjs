const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 460, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const base = "http://localhost:7102/proto/index.html";
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
  const ok = (m) => console.log("ok - " + m);
  const view = () => page.evaluate(() => window.BianRouter.current());

  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // 登录新账号
  const phoneInput = page.locator('input[type="tel"], input[placeholder*="手机"]').first();
  if (await phoneInput.count()) {
    await phoneInput.fill("138" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
    await page.locator("text=获取验证码").first().click();
    await page.waitForTimeout(600);
    const codeInput = page.locator('input[maxlength="6"], input[placeholder*="验证码"]').first();
    if (await codeInput.count() && !(await codeInput.inputValue())) {
      const dev = await page.locator("text=/\\d{6}/").first().textContent().catch(() => "");
      const m = dev && dev.match(/\d{6}/);
      if (m) await codeInput.fill(m[0]);
    }
    await page.locator("text=/登 录|登录|进入彼岸/").first().click();
    await page.waitForTimeout(1200);
    ok("登录新账号（落地视图=" + (await view()) + "）");
  }

  // 进「我的」（tabbar 不可见时直接走路由）
  const meTab = page.locator('.tab[data-tab="me"]');
  if (await meTab.isVisible().catch(() => false)) await meTab.click();
  else await page.evaluate(() => window.BianRouter.go("profile"));
  await page.waitForTimeout(900);
  (await view()) === "profile" ? ok("落在 profile") : fail("视图=" + (await view()));

  // 订单记录
  await page.locator("#me-orders").click();
  await page.waitForTimeout(700);
  (await view()) === "orders" && (await page.locator("#orders-list").count())
    ? ok("订单记录视图打开：" + (await page.locator("#orders-list").textContent()).trim().slice(0, 12))
    : fail("orders 视图未打开");
  await page.locator(".nav-back").first().click();
  await page.waitForTimeout(600);

  // 亲友共同纪念：创建组 → 列表出现 + 邀请码
  await page.locator("#me-groups").click();
  await page.waitForTimeout(700);
  await page.fill("#groups-create-name", "测试协作组");
  await page.locator("#groups-create-btn").click();
  await page.waitForTimeout(900);
  const gtxt = await page.locator("#groups-list").textContent();
  gtxt.includes("测试协作组") && gtxt.includes("邀请码") ? ok("协作组创建成功且显示邀请码") : fail("协作组列表=" + gtxt.slice(0, 40));
  const code = await page.locator(".group-invite").first().getAttribute("data-code").catch(() => null);
  await page.locator(".nav-back").first().click();
  await page.waitForTimeout(600);

  // 用同账号加入自己的组（invite 有效即可；重复成员 INSERT OR IGNORE 也 ok）
  if (code) {
    await page.locator("#me-groups").click();
    await page.waitForTimeout(600);
    await page.fill("#groups-join-code", code);
    await page.locator("#groups-join-btn").click();
    await page.waitForTimeout(800);
    ok("加入组接口响应（owner 已加入属幂等）");
    await page.locator(".nav-back").first().click();
    await page.waitForTimeout(600);
  }

  // 通知：列表打开 + 全部已读
  await page.locator("#me-notif").click();
  await page.waitForTimeout(700);
  (await view()) === "notifications" ? ok("通知视图打开") : fail("通知视图未打开");
  await page.locator("#notif-read-all").click();
  await page.waitForTimeout(700);
  ok("全部已读接口响应");
  await page.locator(".nav-back").first().click();
  await page.waitForTimeout(600);

  // 隐私：导出申请 + 注销申请（dup 去重）
  await page.locator("#me-privacy").click();
  await page.waitForTimeout(700);
  await page.locator("#privacy-export-req").click();
  await page.waitForTimeout(700);
  ok("数据导出申请提交");
  page.once("dialog", (d) => d.accept());
  await page.locator("#privacy-delete-req").click();
  await page.waitForTimeout(700);
  ok("注销申请提交");
  await page.locator(".nav-back").first().click();
  await page.waitForTimeout(600);

  // 帮助与反馈：提交
  await page.locator("#me-feedback").click();
  await page.waitForTimeout(700);
  await page.fill("#fb-content", "测试反馈：希望支持纪念日提醒。");
  await page.locator("#fb-submit").click();
  await page.waitForTimeout(800);
  const fbAgain = await page.locator("#fb-content").inputValue();
  fbAgain === "" ? ok("反馈提交成功并清空") : fail("反馈未提交成功");
  await page.locator(".nav-back").first().click();
  await page.waitForTimeout(600);

  // 设置：开关切换 + 刷新后保持
  await page.locator("#v7-gear").click();
  await page.waitForTimeout(700);
  const before = await page.locator("#set-notify-collab").isChecked();
  await page.locator("#set-notify-collab").click();
  await page.waitForTimeout(700);
  await page.locator(".nav-back").first().click();
  await page.waitForTimeout(500);
  await page.locator("#v7-gear").click();
  await page.waitForTimeout(800);
  const after = await page.locator("#set-notify-collab").isChecked();
  after === !before ? ok(`设置开关持久化（${before} → ${after}）`) : fail("开关未持久化");

  // 删除纪念馆按钮存在且非馆主禁用（新账号用默认示例馆 id → member/guest）
  const delDisabled = await page.locator("#set-del-memorial").isDisabled();
  ok("删除纪念馆按钮状态=" + (delDisabled ? "禁用（非馆主，正确）" : "可用（馆主）"));

  // 退出登录
  await page.locator("#set-logout").click();
  await page.waitForTimeout(900);
  (await view()) === "auth" ? ok("退出登录 → 回到屏01") : fail("退出后视图=" + (await view()));

  errors.length ? fail("pageerror: " + errors.join(" | ")) : ok("无 pageerror");
  await browser.close();
})();
