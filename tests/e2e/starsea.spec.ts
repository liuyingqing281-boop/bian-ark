import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";
import Database from "better-sqlite3";
import { apiLogin, dbPath, gotoStable, RUN } from "./helpers";

// 星海 e2e（Task 2 沉浸壳 + Task 4 正式 2.5D 垂直切片）。
// Task 4 起 garden.spec.ts 的页面级断言并入本文件；正式页 = 星群（starsea-cluster）
// 而非墓碑（Tombstone/garden-card），数据只读 /api/garden/starsea。

// ---------- 沉浸壳（Task 2，保留） ----------
test.describe("星海沉浸壳", () => {
  test("星海使用沉浸壳", async ({ page }) => {
    await page.goto("/zh/garden");
    await expect(page.locator(".starsea-shell")).toBeVisible();
    await expect(page.locator(".pc-sidenav")).toBeHidden();
    await expect(page.locator(".pc-chat-strip")).toBeHidden();
    await expect(page.locator('footer[role="contentinfo"]')).toBeHidden();
    await expect(page.locator(".starsea-scene")).toHaveCSS("position", "fixed");
  });

  test("星海场景铺满可视区", async ({ page }) => {
    await page.goto("/zh/garden");
    const box = await page.locator(".starsea-scene").boundingBox();
    const viewport = page.viewportSize();
    expect(box, "starsea-scene 应存在").toBeTruthy();
    expect(Math.abs(box!.height - viewport!.height), "场景高度应等于可视区高度").toBeLessThanOrEqual(1);
  });

  test("星海页面无横向溢出", async ({ page }) => {
    await page.goto("/zh/garden");
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflowed, "页面不应出现横向滚动").toBe(false);
  });

  test("星海页移动端不出现两套顶部导航", async ({ page }) => {
    await page.goto("/zh/garden");
    await expect(page.locator(".pc-topbar")).toBeHidden();
  });
});

// ---------- 页面输入切换（Task 3 自 garden.spec.ts 并入） ----------
test.describe("星海页面输入切换（Task 3）", () => {
  test("沉浸壳保留，旧墓园卡片渲染已移除", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoStable(page, "/zh/garden");
    await expect(page.locator(".starsea-shell")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".starsea-scene")).toBeVisible();
    await expect(page.locator(".garden-card-rail")).toHaveCount(0);
    await expect(page.locator(".garden-card")).toHaveCount(0);
    await expect(page.locator(".garden-nav")).toHaveCount(0);
  });

  test("初次加载显示固定尺寸 garden-sea 场景容器", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoStable(page, "/zh/garden");
    const sea = page.locator(".garden-sea");
    await expect(sea).toBeVisible({ timeout: 15_000 });
    const box = await sea.boundingBox();
    expect(box, "garden-sea 应有非零尺寸").toBeTruthy();
    expect(box!.width, "garden-sea 宽度应铺满场景").toBeGreaterThan(0);
    expect(box!.height, "garden-sea 高度应铺满场景").toBeGreaterThan(0);
  });

  test("URL 状态往返：详情参数初始化后按白名单顺序规范化回写", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoStable(page, "/zh/garden?panel=detail&hall=h1&zone=public");
    await expect(page.locator(".garden-sea")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/zone=public&hall=h1&panel=detail/, { timeout: 15_000 });
  });
});

// ---------- 正式 2.5D 星海垂直切片（Task 4） ----------
// 种子：一座 3 人公共馆（API 建馆/安放/择位 + 2 条直插 DB 成员），进星海后应渲染 3 星点。
// 标识在 RUN 上叠加 pid：多 worker 同毫秒 import helpers 会撞 RUN（同邮箱 60s 限频），按 worker 唯一化；
// 清理也走本文件定向清理（cleanupRun 按 RUN 前缀会误伤并发 worker 的种子）。
// RUN 已含 pid（helpers.ts Task 5 改造），本文件 TAG 直接复用 RUN 即可跨 worker 唯一
const TAG = RUN;
const seedEmail = `${TAG}-starsea@bian.dev`;
let seededHallId = "";
let seededMemorialId = "";
let seededPrivateHallId = "";
let seededPrivateMemorialId = "";

test.describe("正式 2.5D 星海", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    const ctx = await browser.newContext();
    await apiLogin(ctx.request, seedEmail);
    const created = await ctx.request.post("/api/memorials", {
      data: {
        name: `${TAG}星海三口之家`,
        type: "person",
        visibility: "public",
        biography: `E2E ${TAG}`,
        birthDate: "1930-01-01",
        deathDate: "2020-12-31",
        epitaph: "灯火长明，思念不灭",
      },
    });
    const body = (await created.json()) as { id?: string };
    if (!created.ok() || !body.id) throw new Error(`seed memorial failed: ${created.status()}`);
    const placed = await ctx.request.post(`/api/memorials/${body.id}/garden`, { data: { in_garden: true } });
    if (!placed.ok()) throw new Error(`seed garden placement failed: ${placed.status()}`);
    seededHallId = `hall_${body.id}`;
    seededMemorialId = body.id;

    // Task 5：一座私密馆（馆 id 与旧人物 id 两条路都不得被 ID 兼容绕过权限）
    const priv = await ctx.request.post("/api/memorials", {
      data: { name: `${TAG}私密馆`, type: "person", visibility: "private", biography: `E2E ${TAG}` },
    });
    const privBody = (await priv.json()) as { id?: string };
    if (!priv.ok() || !privBody.id) throw new Error(`seed private memorial failed: ${priv.status()}`);
    seededPrivateMemorialId = privBody.id;
    seededPrivateHallId = `hall_${privBody.id}`;
    // 自动疏朗位可能落在底部抽屉/顶部控件下面：馆主择位钉到安全区（避开控件/抽屉的
    // y∈[0.16,0.5] 带），并与所有在园馆保持 ≥0.12 归一化间距——移动端窄视口下 44px
    // 热区才不会互相遮挡（最小馆间距 0.04 ≈ 16px，会让点击被邻馆拦截）。
    // 多 worker 并发种子时按 pid 在最优候选中错开取点。
    const spotDb = new Database(dbPath());
    let spotX = 0.5;
    let spotY = 0.3;
    try {
      const existing = spotDb
        .prepare("SELECT garden_x AS x, garden_y AS y FROM halls WHERE in_garden = 1 AND garden_x IS NOT NULL")
        .all() as Array<{ x: number; y: number }>;
      const candidates: Array<{ x: number; y: number; clear: number }> = [];
      for (let gx = 0.08; gx <= 0.92; gx += 0.02) {
        for (let gy = 0.16; gy <= 0.5; gy += 0.02) {
          let clear = 1;
          for (const point of existing) clear = Math.min(clear, Math.hypot(point.x - gx, point.y - gy));
          candidates.push({ x: Math.round(gx * 1000) / 1000, y: Math.round(gy * 1000) / 1000, clear });
        }
      }
      const ranked = candidates.sort((a, b) => b.clear - a.clear);
      const safe = ranked.filter((c) => c.clear >= 0.12).slice(0, 25);
      const pick = (safe.length ? safe : ranked)[process.pid % (safe.length || ranked.length)];
      spotX = pick.x;
      spotY = pick.y;
    } finally {
      spotDb.close();
    }
    const positioned = await ctx.request.patch(`/api/halls/${seededHallId}/garden-pos`, {
      data: { x: spotX, y: spotY },
    });
    if (positioned.status() === 409) {
      const suggested = ((await positioned.json()) as { suggested?: { x: number; y: number } }).suggested;
      if (!suggested) throw new Error("seed garden-pos conflict without suggestion");
      const retry = await ctx.request.patch(`/api/halls/${seededHallId}/garden-pos`, {
        data: { x: suggested.x, y: suggested.y },
      });
      if (!retry.ok()) throw new Error(`seed garden-pos retry failed: ${retry.status()}`);
    } else if (!positioned.ok()) {
      throw new Error(`seed garden-pos failed: ${positioned.status()}`);
    }

    // 3 人馆：无成员新增 API（docs/08 §3.13），直插 2 行公共成员 + 1 条 24h 内祭扫（candleLit）
    const db = new Database(dbPath());
    try {
      const owner = db.prepare("SELECT user_id FROM memorials WHERE id = ?").get(body.id) as { user_id: string };
      const insertMember = db.prepare(
        `INSERT INTO memorials (id, name, user_id, visibility, is_published, hall_id, birth_date, death_date, created_at)
         VALUES (?, ?, ?, 'public', 1, ?, '', '', datetime('now', '+1 minute'))`
      );
      insertMember.run(`${TAG}-lamp2`, `${TAG}成员甲`, owner.user_id, seededHallId);
      insertMember.run(`${TAG}-lamp3`, `${TAG}成员乙`, owner.user_id, seededHallId);
      db.prepare(
        `INSERT INTO tributes (id, memorial_id, item_id, message, sender_name) VALUES (?, ?, 'candle', ?, 'E2E')`
      ).run(`${TAG}-seed-tribute`, body.id, `E2E ${TAG}`);
    } finally {
      db.close();
    }
    await ctx.close();
  });

  test.afterAll(async () => {
    // 定向清理本 worker 的种子（RUN 前缀 + pid）：tributes/memorials/halls/users/login_codes/sessions
    const db = new Database(dbPath());
    try {
      db.prepare("DELETE FROM tributes WHERE memorial_id IN (SELECT id FROM memorials WHERE name LIKE ? OR biography LIKE ?)")
        .run(`${TAG}%`, `E2E ${TAG}`);
      db.prepare("DELETE FROM memorials WHERE name LIKE ? OR biography LIKE ?").run(`${TAG}%`, `E2E ${TAG}`);
      db.prepare("DELETE FROM halls WHERE name LIKE ?").run(`${TAG}%`);
      const users = db.prepare("SELECT id FROM users WHERE email LIKE ?").all(`${TAG}-%`) as Array<{ id: string }>;
      for (const user of users) {
        db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
        db.prepare("DELETE FROM events WHERE user_id = ?").run(user.id);
      }
      db.prepare("DELETE FROM users WHERE email LIKE ?").run(`${TAG}-%`);
      db.prepare("DELETE FROM login_codes WHERE target LIKE ?").run(`${TAG}-%`);
    } finally {
      db.close();
    }
  });

  test("正式页按馆显示星群而不是墓碑，不读旧 /api/garden", async ({ page }) => {
    test.setTimeout(90_000);
    const legacyCalls: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/garden") && !url.includes("/api/garden/starsea")) legacyCalls.push(url);
    });
    await gotoStable(page, "/zh/garden");
    const cluster = page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
    await expect(cluster).toBeVisible({ timeout: 30_000 });
    await expect(cluster.locator(".starsea-dot")).toHaveCount(3);
    // 旧墓碑卡片（Tombstone/garden-card）绝不在正式页出现
    await expect(page.locator(".garden-card, .tombstone")).toHaveCount(0);
    // 只允许读正式星海接口
    expect(legacyCalls, "不应请求旧 /api/garden 接口").toEqual([]);
    // 星群热区 ≥44×44 且 aria-label 带脱敏馆名与人数
    const box = await cluster.boundingBox();
    expect(box, "星群热区应有尺寸").toBeTruthy();
    expect(Math.min(box!.width, box!.height), "星群热区最小 44×44px").toBeGreaterThanOrEqual(44);
    await expect(cluster).toHaveAttribute("aria-label", /.+，3 位亲人/);
    // 名牌只显示脱敏名
    await expect(cluster.locator(".starsea-name")).toContainText("*");
  });

  test("点星群聚焦后打开详情抽屉，供奉/进馆双主操作就位", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoStable(page, "/zh/garden");
    const cluster = page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
    await expect(cluster).toBeVisible({ timeout: 30_000 });
    await cluster.click();
    // 400–700ms 聚焦 → 详情抽屉（e2e 放宽到 3s 吸收 dev 抖动）
    await expect(cluster).toHaveClass(/is-focused/, { timeout: 3_000 });
    const detail = page.locator(".starsea-drawer .starsea-detail");
    await expect(detail).toBeVisible({ timeout: 3_000 });
    await expect(detail.locator(".starsea-detail-count")).toContainText("3 位亲人");
    await expect(detail.locator(".starsea-detail-years")).toContainText("1930");
    await expect(detail.locator(".starsea-detail-epitaph")).toContainText("灯火长明");
    // 进馆（Task 5 起真实导航到馆级页；Task 4 时代只断言 href）
    await expect(detail.locator("a.starsea-enter")).toHaveAttribute("href", `/zh/hall/${seededHallId}`);
    await expect(detail.locator("button.starsea-offer-open")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`hall=${seededHallId}&panel=detail`));
    await detail.locator("a.starsea-enter").click();
    await page.waitForURL(new RegExp(`/zh/hall/${seededHallId}`), { timeout: 30_000 });
    await expect(page.locator(`[data-hall-id='${seededHallId}']`)).toBeVisible({ timeout: 15_000 });
  });

  test("搜索只降亮不改变星群节点数量与位置", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoStable(page, "/zh/garden");
    await expect(page.locator(".starsea-cluster").first()).toBeVisible({ timeout: 30_000 });
    const snapshot = () =>
      page.locator(".starsea-cluster").evaluateAll((els) =>
        els.map((el) => ({
          id: el.getAttribute("data-hall-id"),
          left: getComputedStyle(el).left,
          top: getComputedStyle(el).top,
        }))
      );
    const before = await snapshot();
    expect(before.length, "应至少有一座星群").toBeGreaterThan(0);

    const search = page.getByLabel("搜索星海");
    await search.fill("绝不匹配的词xyzq");
    // 防抖 300–500ms 后非匹配星群降亮
    await expect(page.locator(".starsea-cluster.is-dimmed").first()).toBeVisible({ timeout: 5_000 });
    const after = await snapshot();
    expect(after, "搜索不得增删或移动星群节点").toEqual(before);

    // 结果计数以 aria-live 播报
    const count = page.locator(".starsea-count[aria-live='polite']");
    await expect(count).toContainText("0");
    // 清除按钮恢复
    await page.locator(".starsea-search-clear").click();
    await expect(page.locator(".starsea-cluster.is-dimmed")).toHaveCount(0, { timeout: 5_000 });
    await expect(count).toHaveText(/找到 [1-9]\d* 座馆/, { timeout: 5_000 });
  });

  test("星域筛选切换公共馆可见性并可复位", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoStable(page, "/zh/garden");
    const cluster = page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
    await expect(cluster).toBeVisible({ timeout: 30_000 });
    await page.locator(".starsea-zone").selectOption("family");
    await expect(page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`)).toHaveCount(0, { timeout: 10_000 });
    await expect(page).toHaveURL(/zone=family/);
    await page.locator(".starsea-zone").selectOption("");
    await expect(cluster).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/zone=/);
  });

  test("供奉 401 未登录不报成功", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoStable(page, "/zh/garden");
    const cluster = page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
    await expect(cluster).toBeVisible({ timeout: 30_000 });
    await cluster.click();
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 3_000 });
    await page.locator("button.starsea-offer-open").click();
    const offer = page.locator(".starsea-drawer .starsea-offer");
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await offer.locator(".starsea-offer-submit").click();
    const status = offer.locator(".starsea-offer-status");
    await expect(status).toContainText(/登录/, { timeout: 10_000 });
    await expect(status).not.toContainText(/成功/);
  });

  test("供奉 500 服务端错误保留输入且不报成功", async ({ page }) => {
    test.setTimeout(90_000);
    await page.route("**/api/tribute", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "internal_error" }) })
    );
    await gotoStable(page, "/zh/garden");
    const cluster = page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
    await expect(cluster).toBeVisible({ timeout: 30_000 });
    await cluster.click();
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 3_000 });
    await page.locator("button.starsea-offer-open").click();
    const offer = page.locator(".starsea-drawer .starsea-offer");
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await offer.locator(".starsea-offer-message").fill("穿越星海的心意");
    await offer.locator(".starsea-offer-submit").click();
    const status = offer.locator(".starsea-offer-status");
    await expect(status).toContainText(/失败|稍后再试|internal_error/, { timeout: 10_000 });
    await expect(status).not.toContainText(/成功/);
    // 失败不清空留言与面板
    await expect(offer.locator(".starsea-offer-message")).toHaveValue("穿越星海的心意");
    // 请求期间/失败后 Esc 仍可回详情
    await page.keyboard.press("Escape");
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 5_000 });
  });

  test("Esc 与浏览器返回按 供奉→详情→列表 层级回退", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoStable(page, "/zh/garden");
    const cluster = page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
    await expect(cluster).toBeVisible({ timeout: 30_000 });
    await cluster.click();
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 3_000 });
    await expect(page).toHaveURL(new RegExp(`hall=${seededHallId}&panel=detail`));
    await page.locator("button.starsea-offer-open").click();
    await expect(page.locator(".starsea-drawer .starsea-offer")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/panel=offer/);
    // Esc：供奉 → 详情
    await page.keyboard.press("Escape");
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/panel=detail/);
    // Esc：详情 → 列表（URL 清爽；Esc 为状态回退 + replaceState）
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/zh\/garden$/, { timeout: 5_000 });
    await expect(page.locator(".starsea-drawer .starsea-detail")).toHaveCount(0);
    // 浏览器返回：列表 → 上一次详情历史（pushState 层级，popstate 恢复详情态）
    await page.goBack();
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/panel=detail/);
  });

  test("刷新带 hall+panel=detail 恢复详情态而非像素坐标", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoStable(page, `/zh/garden?hall=${seededHallId}&panel=detail`);
    const detail = page.locator(".starsea-drawer .starsea-detail");
    await expect(detail).toBeVisible({ timeout: 30_000 });
    await expect(detail.locator(".starsea-detail-count")).toContainText("3 位亲人");
    await expect(page).toHaveURL(new RegExp(`hall=${seededHallId}&panel=detail`));
    // URL 不承载像素镜头
    await expect(page).not.toHaveURL(/scale=|offset=/);
  });

  test("移动端结果计数保持无障碍可达（视觉隐藏而非 display:none）", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoStable(page, "/zh/garden");
    const count = page.locator(".starsea-count[aria-live='polite']");
    await expect(count).toBeAttached({ timeout: 30_000 });
    // 窄屏（≤640px，Pixel 7=412px）下计数只做视觉隐藏；
    // display:none 会把 aria-live 区域整个移出无障碍树，读屏永远不播报
    const display = await count.evaluate((el) => getComputedStyle(el).display);
    expect(display, "aria-live 计数不得 display:none").not.toBe("none");
  });

  test("供奉 pending 中 Esc 回详情，迟到的成功不得再把详情回退成列表", async ({ page }) => {
    test.setTimeout(90_000);
    // 慢响应网关：挂起 /api/tribute，等测试放行后才返回成功
    const gate = { release: () => {} };
    const gatePromise = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    await page.route("**/api/tribute", async (route) => {
      await gatePromise;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "late-success" }) });
    });
    await gotoStable(page, "/zh/garden");
    const cluster = page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
    await expect(cluster).toBeVisible({ timeout: 30_000 });
    await cluster.click();
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 3_000 });
    await page.locator("button.starsea-offer-open").click();
    const offer = page.locator(".starsea-drawer .starsea-offer");
    await expect(offer).toBeVisible({ timeout: 10_000 });
    await offer.locator(".starsea-offer-submit").click();
    // 提交中 Esc（规格允许）→ 回详情
    await page.keyboard.press("Escape");
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/panel=detail/);
    // 放行迟到的成功：1000ms 反馈 + 缓冲后，详情与选中必须原样保留
    gate.release();
    await page.waitForTimeout(1_800);
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible();
    await expect(page.locator(".starsea-drawer .starsea-detail .starsea-detail-count")).toContainText("3 位亲人");
    await expect(page).toHaveURL(/panel=detail/);
  });

  // ---------- 园 → 馆 → 人 → 园 闭环 + 旧链接兼容（Task 5） ----------
  test("星海进馆 → 人物聚焦 → Esc 回馆级 → 返回星海恢复浏览状态", async ({ page }) => {
    test.setTimeout(150_000);
    await gotoStable(page, "/zh/garden");
    const cluster = page.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
    await expect(cluster).toBeVisible({ timeout: 30_000 });
    await cluster.click();
    const detail = page.locator(".starsea-drawer .starsea-detail");
    await expect(detail).toBeVisible({ timeout: 3_000 });
    await expect(page).toHaveURL(new RegExp(`hall=${seededHallId}&panel=detail`));
    // 进馆 → 馆级页（3 人馆默认馆级公共层，不聚焦任何一盏灯）
    await detail.locator("a.starsea-enter").click();
    await page.waitForURL(new RegExp(`/zh/hall/${seededHallId}`), { timeout: 30_000 });
    const hallRoot = page.locator(`[data-hall-id='${seededHallId}']`);
    await expect(hallRoot).toBeVisible({ timeout: 15_000 });
    await expect(hallRoot.locator("[data-memorial-id]")).toHaveCount(3);
    // 点灯聚焦第一位亲人：URL 保留 p，人物层（h1）出现
    await hallRoot.locator(`[data-memorial-id='${seededMemorialId}']`).click();
    await expect(page).toHaveURL(new RegExp(`[?&]p=${seededMemorialId}($|&)`), { timeout: 15_000 });
    await expect(hallRoot.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    // Esc：人物 → 馆级（清 p 回公共层）
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/p=/, { timeout: 15_000 });
    await expect(hallRoot.locator("[data-memorial-id]")).toHaveCount(3, { timeout: 15_000 });
    // 返回星海：恢复离馆前浏览状态（详情抽屉 + URL 白名单参数）
    await hallRoot.locator("button.hall-back-garden").click();
    await page.waitForURL(/\/zh\/garden/, { timeout: 30_000 });
    await expect(page.locator(".starsea-drawer .starsea-detail")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`hall=${seededHallId}&panel=detail`), { timeout: 15_000 });
  });

  test("馆页人物聚焦后桌面可达聊天入口（沉浸壳 Task 2 遗留回归）", async ({ page }) => {
    test.setTimeout(90_000);
    test.skip((page.viewportSize()?.width ?? 0) < 768, "桌面聊天侧栏仅 ≥768px 视口断言");
    await gotoStable(page, `/zh/hall/${seededHallId}?p=${seededMemorialId}`);
    const hallRoot = page.locator(`[data-hall-id='${seededHallId}']`);
    await expect(hallRoot).toBeVisible({ timeout: 30_000 });
    await expect(hallRoot.locator("h1").first()).toBeVisible({ timeout: 15_000 });
    await expect(hallRoot.locator(".hall-scene-chat")).toBeVisible();
  });

  test("旧 memorial URL 永久重定向到馆级规范地址（含 p=）", async ({ page }) => {
    test.setTimeout(90_000);
    // 服务端 canonical redirect：生产构建直出 308 + Location；
    // dev 流式渲染下 Next 以 200 + meta refresh 等价送达，两种形态都认
    const probe = await page.request.get(`/zh/hall/${seededMemorialId}`, { maxRedirects: 0 });
    const location = probe.headers()["location"] || "";
    if (probe.status() >= 300 && probe.status() < 400) {
      expect(location, "308 Location 应指向馆级规范地址").toContain(`/zh/hall/hall_${seededMemorialId}`);
      expect(location, "308 Location 应携带 p=").toContain(`p=${seededMemorialId}`);
    } else {
      const html = await probe.text();
      expect(html, "dev 流式渲染应以 meta refresh 重定向").toContain("http-equiv=\"refresh\"");
    }
    const response = await page.goto(`/zh/hall/${seededMemorialId}`);
    expect(response?.ok(), "重定向落地应为 200").toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`/zh/hall/hall_${seededMemorialId}\\?p=${seededMemorialId}$`), {
      timeout: 15_000,
    });
    // 落地即聚焦该人物（人物层 h1 可见）
    const hallRoot = page.locator(`[data-hall-id='hall_${seededMemorialId}']`);
    await expect(hallRoot).toBeVisible({ timeout: 15_000 });
    await expect(hallRoot.locator("h1").first()).toBeVisible({ timeout: 15_000 });
  });

  test("不存在的馆 id 返回既有 404 UI", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoStable(page, "/zh/hall/hall_does_not_exist_404");
    await expect(page.getByText("纪念馆不存在或未公开")).toBeVisible({ timeout: 15_000 });
  });

  test("私密馆对访客不可见：馆 id 与旧人物 id 都 404", async ({ page }) => {
    test.setTimeout(90_000);
    await gotoStable(page, `/zh/hall/${seededPrivateHallId}`);
    await expect(page.getByText("纪念馆不存在或未公开")).toBeVisible({ timeout: 15_000 });
    await gotoStable(page, `/zh/hall/${seededPrivateMemorialId}`);
    await expect(page.getByText("纪念馆不存在或未公开")).toBeVisible({ timeout: 15_000 });
  });
});
