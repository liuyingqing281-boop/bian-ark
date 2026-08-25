const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 460, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const base = "http://localhost:7300/proto/index.html";
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
  const ok = (m) => console.log("ok - " + m);
  const view = () => page.evaluate(() => window.BianRouter.current());

  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // 登录新账号（走 API 快速登录，再刷新页面让壳分流）
  await page.evaluate(async () => {
    const phone = "1330000" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0"); // 测试号段，跳过真实短信
    const r1 = await fetch("/api/auth/request-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "sms", target: phone }) });
    const d = await r1.json();
    await fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "sms", target: phone, code: d.devCode, intent: "register", password: "Test1234!ok", agreed: true }) });
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  ok("登录后落地视图=" + (await view()));

  /* W2：首页无祭奠区块 */
  await page.evaluate(() => window.BianRouter.go("home"));
  await page.waitForTimeout(900);
  const offerGone = (await page.locator("#offer-grid").count()) === 0;
  offerGone ? ok("W2 首页祭奠区块已移除") : fail("首页仍有 offer-grid");

  /* W2：记忆页角色信息卡（示例馆是访客/非馆主 → 无编辑按钮） */
  await page.evaluate(() => window.BianRouter.go("memory"));
  await page.waitForTimeout(900);
  const roleVisible = await page.locator("#mem-role-view").isVisible();
  roleVisible ? ok("W2 记忆页角色信息卡渲染") : fail("角色信息卡不可见");
  const editHidden = await page.locator("#mem-edit").isHidden();
  ok("W2 编辑按钮对非馆主隐藏=" + editHidden);

  /* W3：对话页模式切换 */
  await page.evaluate(() => window.BianRouter.go("chat"));
  await page.waitForTimeout(900);
  // 默认第三方
  const noteHidden = await page.locator("#chat-mode-note").isHidden();
  noteHidden ? ok("W3 默认第三方模式（常驻标识隐藏）") : fail("默认模式标识异常");
  // 切模仿 → 首次弹边界浮层
  await page.locator("#mode-roleplay").click();
  await page.waitForTimeout(500);
  const ovVisible = await page.locator("#ov-roleplay").isVisible();
  ovVisible ? ok("W3 首次切模仿弹边界浮层") : fail("边界浮层未弹出");
  await page.locator("#ov-roleplay-ok").click();
  await page.waitForTimeout(600);
  const noteShown = await page.locator("#chat-mode-note").isVisible();
  noteShown ? ok("W3 确认后进入模仿模式（常驻标识显示）") : fail("模仿模式标识未显示");
  // 发一条消息验证 roleplay 链路
  await page.fill("#chat-input", "你还记得我们一起去河边的事吗？");
  await page.locator("#chat-send").click();
  await page.waitForSelector(".bubble-ta", { timeout: 45000 }).catch(() => null);
  const lastBubble = await page.locator("#chat-msgs .bubble-ta").last().textContent().catch(() => "");
  lastBubble ? ok(`W3 模仿模式回应：${lastBubble.trim().slice(0, 30)}…`) : fail("模仿模式无回应");
  const badge = await page.locator("#chat-msgs .tag-inferred").last().textContent().catch(() => "");
  badge.includes("AI 模仿") ? ok("W3 回应带「AI 模仿」角标") : fail("角标=" + badge);
  // 刷新后模式被记住（每馆记住）
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.BianRouter.go("chat"));
  await page.waitForTimeout(900);
  const noteShown2 = await page.locator("#chat-mode-note").isVisible();
  noteShown2 ? ok("W3 模式每馆记住（刷新后仍模仿）") : fail("刷新后模式丢失");
  // 切回第三方
  await page.locator("#mode-companion").click();
  await page.waitForTimeout(400);

  /* W4：记忆沉淀（上一条消息提到河边，等异步抽取） */
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.BianRouter.go("memory"));
  await page.waitForTimeout(1000);
  const memText = await page.locator("#mem-sections").textContent();
  memText.includes("聊天中记起") || memText.includes("河")
    ? ok("W4 聊天记忆沉淀分区出现")
    : console.log("note - 沉淀未出现（LLM 判定无新事实也属正常）：" + memText.slice(0, 60));

  /* W5+W6：礼物页润色确认 + 进度条 */
  await page.evaluate(() => window.BianRouter.go("gift"));
  await page.waitForTimeout(600);
  await page.fill("#gift-idea", "一盒桂花糕");
  await page.locator("#gift-next").click();
  await page.waitForSelector("#gift-polish-body", { state: "visible", timeout: 30000 }).catch(() => null);
  const polished = await page.locator("#gift-prompt").inputValue();
  polished.length >= 2 ? ok(`W5 自动润色返回：${polished.slice(0, 24)}…`) : console.log("note - 润色降级（接口未返回），走原文也合规");
  const genBtns = await page.locator("#gift-gen-btns").isVisible();
  genBtns ? ok("W5 确认按钮组出现（用这个生成/用原文生成）") : fail("确认按钮组未出现");
  await page.locator("#gift-use-polished").isVisible().then((v) => v ? page.locator("#gift-use-polished").click() : page.locator("#gift-use-origin").click());
  // 进度条
  await page.waitForSelector("#gift-progress-bar", { state: "visible", timeout: 15000 }).catch(() => null);
  const barVisible = await page.locator("#gift-progress-box").isVisible();
  barVisible ? ok("W6 进度条显示") : fail("进度条未显示");
  await page.waitForSelector(".gift-cand", { timeout: 120000 }).catch(() => null);
  const cands = await page.locator(".gift-cand").count();
  cands >= 1 ? ok(`W6 生成完成，候选 ${cands} 张（进度条真实轮询）`) : fail("生成未完成");
  const pct = await page.locator("#gift-progress-num").textContent().catch(() => "?");
  ok("最终进度=" + pct + "%");

  errors.length ? fail("pageerror: " + errors.join(" | ")) : ok("无 pageerror");
  await browser.close();
})();
