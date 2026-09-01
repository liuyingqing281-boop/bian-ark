// 正式星海视觉基线（Task 9，墓园规格 §7 验收第二层）：只访问正式 /zh/garden，
// 在固定视口产出 4 张基线截图（docs/shots/）：
//   garden-starsea-2d-desktop.png  桌面 2.5D 星海（1440×900）
//   garden-starsea-2d-mobile.png   Pixel 7 2.5D 星海（412×915，触控环境）
//   garden-starsea-detail.png      详情抽屉（半开 + 进馆/供奉双主操作）
//   garden-starsea-placement.png   择位态（馆主横幅 + 44px 目标环 + 实时坐标）
//
// 运行前提：dev 服务器已起（`npm run dev`，缺省 3002；与 Playwright webServer 同端口
// 约定，可用 BASE_URL 覆盖）。详情/择位用脚本自建的一次性种子馆（VISUAL- 前缀，
// 结束时直插 DB 清理，不污染既有数据）；空态/多人星群等过程快照由
// tests/e2e/starsea.spec.ts 以 testInfo.outputPath 留档，不在本脚本职责内。
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3002";
const OUT_DIR = path.resolve("docs/shots");
const TAG = `VISUAL-${Date.now().toString(36)}-${process.pid.toString(36)}`;
const seedEmail = `${TAG}-owner@bian.dev`;

function shot(name) {
  return path.join(OUT_DIR, name);
}

function dbFile() {
  return process.env.SMOKE_DB_PATH || process.env.DATABASE_PATH || path.resolve("data", "bian.db");
}

async function waitSea(page, extra = 800) {
  await page.locator(".starsea-cluster").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(extra); // 星光首帧 + 名牌布局收敛
}

// e2e 同款安全位：y∈[0.16,0.5] 带内取与所有在园馆 clear ≥0.12 的候选（躲开
// 顶部控件与底部抽屉；1440/412 视口下 44px 热区不与邻馆重叠）
function pickSafeSpot() {
  const db = new Database(dbFile());
  try {
    const existing = db
      .prepare("SELECT garden_x AS x, garden_y AS y FROM halls WHERE in_garden = 1 AND garden_x IS NOT NULL")
      .all();
    const ranked = [];
    for (let gx = 0.08; gx <= 0.92; gx += 0.02) {
      for (let gy = 0.16; gy <= 0.5; gy += 0.02) {
        let clear = 1;
        for (const point of existing) clear = Math.min(clear, Math.hypot(point.x - gx, point.y - gy));
        ranked.push({ x: Math.round(gx * 1000) / 1000, y: Math.round(gy * 1000) / 1000, clear });
      }
    }
    ranked.sort((a, b) => b.clear - a.clear);
    const safe = ranked.filter((c) => c.clear >= 0.12).slice(0, 25);
    const pool = safe.length ? safe : ranked;
    return pool[process.pid % pool.length];
  } finally {
    db.close();
  }
}

function cleanupSeed() {
  const db = new Database(dbFile());
  try {
    db.prepare("DELETE FROM tributes WHERE memorial_id IN (SELECT id FROM memorials WHERE name LIKE ?)")
      .run(`${TAG}%`);
    db.prepare("DELETE FROM memorials WHERE name LIKE ?").run(`${TAG}%`);
    db.prepare("DELETE FROM halls WHERE name LIKE ?").run(`${TAG}%`);
    const users = db.prepare("SELECT id FROM users WHERE email LIKE ?").all(`${TAG}-%`);
    for (const user of users) {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
      db.prepare("DELETE FROM events WHERE user_id = ?").run(user.id);
    }
    db.prepare("DELETE FROM users WHERE email LIKE ?").run(`${TAG}-%`);
    db.prepare("DELETE FROM login_codes WHERE target LIKE ?").run(`${TAG}-%`);
  } finally {
    db.close();
  }
}

const browser = await chromium.launch();
try {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ---- 1. 桌面 2.5D 星海 ----
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dpage = await desktop.newPage();
  await dpage.goto(`${BASE}/zh/garden`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitSea(dpage);
  await dpage.screenshot({ path: shot("garden-starsea-2d-desktop.png") });
  console.log("saved garden-starsea-2d-desktop.png");

  // ---- 2. Pixel 7 2.5D 星海 ----
  const mobile = await browser.newContext({ ...devices["Pixel 7"] });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/zh/garden`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitSea(mpage);
  await mpage.screenshot({ path: shot("garden-starsea-2d-mobile.png") });
  console.log("saved garden-starsea-2d-mobile.png");
  await mobile.close();

  // ---- 3. 种子馆（注册 → 建馆 → 入园 → 安全区择位；共享桌面 ctx 的 Cookie） ----
  const rc = await dpage.context().request.post(`${BASE}/api/auth/request-code`, {
    data: { channel: "email", target: seedEmail },
  });
  if (!rc.ok()) throw new Error(`request-code failed: ${rc.status()}`);
  const { devCode } = await rc.json();
  const verify = await dpage.context().request.post(`${BASE}/api/auth/verify`, {
    data: {
      channel: "email",
      target: seedEmail,
      code: devCode,
      intent: "register",
      password: "Test1234!ok",
      agreed: true,
    },
  });
  if (!verify.ok()) throw new Error(`verify register failed: ${verify.status()}`);
  const created = await dpage.context().request.post(`${BASE}/api/memorials`, {
    data: {
      name: `${TAG}三口之家`,
      type: "person",
      visibility: "public",
      biography: `VISUAL ${TAG}`,
      birthDate: "1932-03-08",
      deathDate: "2019-11-02",
      epitaph: "灯火长明，思念不灭",
    },
  });
  const createdBody = await created.json();
  if (!created.ok() || !createdBody.id) throw new Error(`seed memorial failed: ${created.status()}`);
  const placed = await dpage.context().request.post(`${BASE}/api/memorials/${createdBody.id}/garden`, {
    data: { in_garden: true },
  });
  if (!placed.ok()) throw new Error(`seed garden placement failed: ${placed.status()}`);
  const seededHallId = `hall_${createdBody.id}`;
  const spot = pickSafeSpot();
  const positioned = await dpage.context().request.patch(`${BASE}/api/halls/${seededHallId}/garden-pos`, {
    data: { x: spot.x, y: spot.y },
  });
  if (positioned.status() === 409) {
    const suggested = (await positioned.json()).suggested;
    const retry = await dpage.context().request.patch(`${BASE}/api/halls/${seededHallId}/garden-pos`, {
      data: { x: suggested.x, y: suggested.y },
    });
    if (!retry.ok()) throw new Error(`seed garden-pos retry failed: ${retry.status()}`);
  } else if (!positioned.ok()) {
    throw new Error(`seed garden-pos failed: ${positioned.status()}`);
  }

  // ---- 4. 详情抽屉（点种子馆 → 半开 + 双主操作） ----
  await dpage.goto(`${BASE}/zh/garden`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const cluster = dpage.locator(`.starsea-cluster[data-hall-id='${seededHallId}']`);
  await cluster.waitFor({ state: "visible", timeout: 60_000 });
  await cluster.click();
  await dpage.locator(".starsea-drawer .starsea-detail").waitFor({ state: "visible", timeout: 10_000 });
  await dpage.waitForTimeout(900); // 聚焦态 → 详情 + 抽屉高度过渡收敛
  await dpage.screenshot({ path: shot("garden-starsea-detail.png") });
  console.log("saved garden-starsea-detail.png");

  // ---- 5. 择位态（馆主 ?placing=：横幅 + 44px 目标环） ----
  await dpage.goto(`${BASE}/zh/garden?placing=${seededHallId}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await dpage.locator(".starsea-placement-bar").waitFor({ state: "visible", timeout: 60_000 });
  await dpage.locator(".starsea-placement-ring").waitFor({ state: "visible", timeout: 30_000 });
  await dpage.waitForTimeout(500);
  await dpage.screenshot({ path: shot("garden-starsea-placement.png") });
  console.log("saved garden-starsea-placement.png");

  await desktop.close();
} finally {
  await browser.close();
  cleanupSeed();
  console.log(`seed ${TAG} cleaned`);
}
