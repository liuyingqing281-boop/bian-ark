const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
  const ok = (m) => console.log("ok - " + m);

  /* ===== 任务 1：移动端占满整屏 ===== */
  const mp = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone 14
  await mp.goto("http://localhost:7102/proto/index.html", { waitUntil: "networkidle" });
  await mp.waitForTimeout(1200);
  const headerHidden = await mp.locator("header").isHidden();
  const footerHidden = await mp.locator("footer").isHidden();
  const punchHidden = await mp.locator(".phone .punch").isHidden();
  const wrap = await mp.locator(".screen-wrap").boundingBox();
  headerHidden && footerHidden && punchHidden
    ? ok("移动端：壳标题/页脚/打孔隐藏")
    : fail(`header=${headerHidden} footer=${footerHidden} punch=${punchHidden}`);
  wrap && Math.abs(wrap.width - 390) < 2 && Math.abs(wrap.height - 844) < 2
    ? ok(`移动端：screen-wrap=${wrap.width}x${wrap.height} 占满视口`)
    : fail(`screen-wrap=${wrap && wrap.width}x${wrap && wrap.height}`);
  const viewVisible = await mp.locator("#view-root .view").first().isVisible();
  viewVisible ? ok("移动端：应用界面可见") : fail("视图不可见");
  await mp.close();

  /* ===== 任务 2：邮箱验证码注册 ===== */
  const ep = await browser.newPage();
  await ep.goto("http://localhost:7102/proto/index.html", { waitUntil: "networkidle" });
  await ep.waitForTimeout(1000);
  // 确保在登录屏
  await ep.evaluate(() => window.BianRouter.go("auth"));
  await ep.waitForTimeout(500);
  // 切到邮箱通道
  await ep.locator('.auth-ch[data-ch="email"]').click();
  const email = `test${Date.now()}@bian.dev`;
  await ep.fill("#auth-target", email);
  await ep.locator("#auth-send").click();
  await ep.waitForTimeout(1000);
  const codeVal = await ep.locator("#auth-code").inputValue();
  /^\d{6}$/.test(codeVal) ? ok(`邮箱验证码 devCode 自动回填（${codeVal}）`) : fail("邮箱 devCode 未回填：" + codeVal);
  await ep.locator("#auth-submit").click();
  await ep.waitForTimeout(1500);
  const afterAuth = await ep.evaluate(() => window.BianRouter.current());
  afterAuth !== "auth" ? ok(`邮箱注册登录成功 → ${afterAuth}`) : fail("邮箱登录后仍在 auth");
  // 接口侧再验证一次 me
  const me = await ep.evaluate(async () => (await fetch("/api/me")).status);
  me === 200 ? ok("邮箱账号会话有效（/api/me 200）") : fail("/api/me=" + me);
  await ep.close();

  /* ===== 任务 3：AI 生成祭品三步流 ===== */
  const gp = await browser.newPage();
  const errors = [];
  gp.on("pageerror", (e) => errors.push(String(e)));
  await gp.goto("http://localhost:7102/proto/index.html", { waitUntil: "networkidle" });
  await gp.waitForTimeout(1000);
  // 登录（手机号通道）
  await gp.evaluate(() => window.BianRouter.go("auth"));
  await gp.waitForTimeout(400);
  await gp.fill("#auth-target", "135" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
  await gp.locator("#auth-send").click();
  await gp.waitForTimeout(800);
  await gp.locator("#auth-submit").click();
  await gp.waitForTimeout(1200);

  // 直接进入礼物页
  await gp.evaluate(() => window.BianRouter.go("gift"));
  await gp.waitForTimeout(600);

  // 第 1 步：帮我写
  await gp.fill("#gift-idea", "一壶龙井茶");
  await gp.locator("#gift-polish").click();
  await gp.waitForTimeout(3000);
  const promptVal = await gp.locator("#gift-prompt").inputValue();
  if (promptVal.length >= 2) ok(`「帮我写」扩写成功：${promptVal.slice(0, 30)}…`);
  else {
    console.log("note - 帮我写未返回（可能 LLM 未配置），改用手动描述");
    await gp.locator("#gift-prompt-card").evaluate((el) => (el.style.display = "block"));
    await gp.fill("#gift-prompt", "一壶龙井茶");
  }

  // 第 2 步：生成（mock 或真实火山，等结果）
  await gp.locator("#gift-generate").click();
  await gp.waitForSelector(".gift-cand", { timeout: 90000 }).catch(() => null);
  const candCount = await gp.locator(".gift-cand").count();
  candCount >= 1 ? ok(`生成候选 ${candCount} 张`) : fail("生成无候选图");
  const provider = await gp.evaluate(async () => {
    return window.__lastProvider || "unknown";
  });
  if (candCount >= 1) {
    const src = await gp.locator(".gift-cand img").first().getAttribute("src");
    ok("候选图地址=" + src);
    // 第 3 步：选图收藏
    await gp.locator(".gift-cand").first().click();
    await gp.waitForTimeout(500);
    await gp.fill("#gift-name", "一壶龙井");
    await gp.locator("#gift-claim").click();
    await gp.waitForTimeout(1200);
    const toast = await gp.locator("#bian-toast").textContent();
    toast.includes("已收藏") ? ok("收藏成功：" + toast) : fail("收藏 toast=" + toast);
  }
  errors.length ? fail("pageerror: " + errors.join(" | ")) : ok("无 pageerror");
  await gp.close();

  /* ===== 桌面回归：壳仍正常 ===== */
  const dp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await dp.goto("http://localhost:7102/proto/index.html", { waitUntil: "networkidle" });
  await dp.waitForTimeout(800);
  const dw = await dp.locator(".screen-wrap").boundingBox();
  dw && Math.abs(dw.width - 400) < 2 && (await dp.locator("header").isVisible())
    ? ok("桌面端：手机壳与标题保持原样")
    : fail("桌面端壳异常");
  await dp.close();

  await browser.close();
})();
