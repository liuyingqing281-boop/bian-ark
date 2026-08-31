import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { migrateUp, verifyDatabase } from "../src/lib/migrations.mjs";

const root = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(root, ".starsea-formal-"));
const dbPath = path.join(tempRoot, "formal.db");
const appRoot = path.join(tempRoot, "app");
const port = 7417;
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let serverExitPromise;
let failures = 0;
let passes = 0;

function check(name, fn) {
  try {
    fn();
    passes += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passes += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function checksum(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function waitForExit(child) {
  let settled = false;
  return new Promise((resolve) => {
    const settle = (event, code, signal) => {
      if (settled) return;
      settled = true;
      resolve({ event, code, signal });
    };
    child.once("exit", (code, signal) => settle("exit", code, signal));
    child.once("close", (code, signal) => settle("close", code, signal));
    if (child.exitCode !== null || child.signalCode !== null) settle("state", child.exitCode, child.signalCode);
  });
}

// 带超时的竞争等待：无论成败都清掉计时器，不让悬挂的 setTimeout 拖住进程退出
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next server did not start within 60 seconds");
}

function cookieJar() {
  const values = new Map();
  return {
    async request(pathname, { method = "GET", body } = {}) {
      const headers = {};
      if (body !== undefined) headers["content-type"] = "application/json";
      if (values.size) headers.cookie = [...values].map(([key, value]) => `${key}=${value}`).join("; ");
      const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookie = typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean);
      for (const value of setCookie) {
        const [pair] = value.split(";", 1);
        const at = pair.indexOf("=");
        if (at > 0) values.set(pair.slice(0, at), pair.slice(at + 1));
      }
      const text = await response.text();
      return { status: response.status, json: text ? JSON.parse(text) : null };
    },
  };
}

async function register(client) {
  const email = `formal-${randomUUID()}@test.local`;
  const codeResponse = await client.request("/api/auth/request-code", {
    method: "POST",
    body: { channel: "email", target: email },
  });
  assert.equal(codeResponse.status, 200);
  const verify = await client.request("/api/auth/verify", {
    method: "POST",
    body: {
      channel: "email",
      target: email,
      code: codeResponse.json.devCode,
      intent: "register",
      password: "Test1234!ok",
      agreed: true,
    },
  });
  assert.equal(verify.status, 200);
}

async function createPublicMemorial(client, name) {
  const response = await client.request("/api/memorials", {
    method: "POST",
    body: { name, type: "person", visibility: "public" },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.ok, true);
  return response.json.id;
}

function formalTestSource() {
  return fs.readFileSync(new URL(import.meta.url), "utf8");
}

function positionDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

// ---- Task 8：规模与性能（600+ 公共馆夹具 + bbox/游标/稳定排序证明） ----
// 夹具只进本测试的临时库（SMOKE_DB_PATH），带运行前缀、结束时按前缀删除，
// 绝不触碰开发库 data/bian.db 基线。
const SCALE_RUN = randomUUID().slice(0, 8);
const SCALE_HALLS = 620;

// 向正式库插入 SCALE_HALLS 座公共馆（各带 1 条已发布公共 memorial）。
// 坐标确定性散布（黄金比步进，无随机源）；避开 x/y = 0.5 精确值——
// 相邻 bbox 的共享边界恰好不落在任何馆上，边界断言才可判定「零丢失/零重复」。
// 事务包裹：失败整体回滚，不留半截夹具。
function seedScaleFixture(db) {
  db.exec("BEGIN");
  try {
    db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, '规模夹具')").run(`user_${SCALE_RUN}`, `scale-${SCALE_RUN}@test.local`);
    const insertHall = db.prepare(
      `INSERT INTO halls (id, name, visibility, owner_user_id, in_garden, garden_x, garden_y, garden_zone)
       VALUES (?, ?, 'public', ?, 1, ?, ?, 'public')`
    );
    const insertMemorial = db.prepare(
      `INSERT INTO memorials (id, name, user_id, visibility, is_published, hall_id)
       VALUES (?, ?, ?, 'public', 1, ?)`
    );
    for (let i = 0; i < SCALE_HALLS; i += 1) {
      let x = Math.round((0.02 + ((i * 0.61803398875) % 0.96)) * 1000) / 1000;
      let y = Math.round((0.02 + ((i * 0.75487766624) % 0.96)) * 1000) / 1000;
      if (x === 0.5) x = 0.501;
      if (y === 0.5) y = 0.501;
      const hallId = `hall_${SCALE_RUN}s${i}`;
      insertHall.run(hallId, `规模馆${i}`, `user_${SCALE_RUN}`, x, y);
      insertMemorial.run(`${SCALE_RUN}m${i}`, `亲人${i}`, `user_${SCALE_RUN}`, hallId);
    }
    db.exec("COMMIT");
    return SCALE_HALLS;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function scaleFixtureCleanup(db) {
  db.prepare("DELETE FROM memorials WHERE id LIKE ? OR user_id = ?").run(`${SCALE_RUN}%`, `user_${SCALE_RUN}`);
  db.prepare("DELETE FROM halls WHERE id LIKE ? OR owner_user_id = ?").run(`hall_${SCALE_RUN}%`, `user_${SCALE_RUN}`);
  db.prepare("DELETE FROM users WHERE id = ?").run(`user_${SCALE_RUN}`);
}

const STARSEA_GROUND_TRUTH_SQL = `
  SELECT COUNT(*) AS n FROM halls h
  WHERE h.in_garden = 1 AND h.visibility = 'public'
    AND h.garden_x IS NOT NULL AND h.garden_y IS NOT NULL
    AND EXISTS (SELECT 1 FROM memorials m WHERE m.hall_id = h.id AND m.is_published = 1 AND m.visibility = 'public')`;

// 游标走全量：每页断言 200/OK、页内 hallId 升序、跨页严格递增（cursor 语义）
async function walkStarsea(bbox, limit) {
  const halls = [];
  let cursor = null;
  let pages = 0;
  let lastId = "";
  do {
    const params = new URLSearchParams({ bbox, limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`${baseUrl}/api/garden/starsea?${params.toString()}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    const ids = body.halls.map((hall) => hall.hallId);
    assert.deepEqual(ids, [...ids].sort(), `第 ${pages} 页应按 hallId 升序`);
    for (const id of ids) {
      assert.equal(id > lastId, true, `跨页应严格升序：${lastId} → ${id}`);
      lastId = id;
    }
    halls.push(...body.halls);
    cursor = body.nextCursor;
    pages += 1;
    assert.equal(pages <= 12, true, "游标页数失控（防死循环守卫）");
  } while (cursor);
  return { halls, pages };
}

// 轻量性能记录（指示性，不作门禁）：600+ 夹具下真实浏览器首交互/可见星群数。
// best-effort：dev 首访要把页面与全部客户端 chunk 现场编译（本机观测 /zh/garden
// 首次 200 用时 ~38s），首等窗可能赶不上水合——失败后 reload 重试一次（此时已
// 全部编译完，二次加载 <100ms 级）。两次都失败只记录跳过，绝不判失败。
async function perfProbeWithFixture() {
  if (process.env.STARSEA_SKIP_PERF === "1") return;
  let browser;
  let page;
  const errors = [];
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch();
    page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    const startedAt = Date.now();
    await page.goto(`${baseUrl}/zh/garden`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    // dev 首编译竞态兜底（同 tests/e2e/helpers.ts gotoStable 坑）：Next 16 dev 偶发
    // 页面级运行时错浮层（内部 JSON.parse），识别到错误 dialog 立即重载一次
    if (await page.getByRole("dialog").first().isVisible().catch(() => false)) {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    }
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await page.waitForFunction(() => {
          const m = window.__starseaMetrics;
          return Boolean(m && typeof m.firstInteractiveMs === "number");
        }, undefined, { timeout: 120_000 });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
      }
    }
    const metrics = await page.evaluate(() => window.__starseaMetrics ?? null);
    const counts = await page.evaluate(() => ({
      clusters: document.querySelectorAll(".starsea-cluster").length,
      halos: document.querySelectorAll(".starsea-halo").length,
      cards: document.querySelectorAll(".starsea-card").length,
    }));
    console.log(`PERF probe(fixture=${SCALE_HALLS}+) ${JSON.stringify({ wallMs: Date.now() - startedAt, ...metrics, ...counts })}`);
    if (errors.length) console.log(`PERF probe page errors: ${JSON.stringify(errors.slice(0, 3))}`);
  } catch (error) {
    console.log(`PERF probe skipped (not a failure): ${error && error.message ? error.message.split("\n")[0] : error}`);
    try {
      const html = page ? await page.content() : "";
      console.log(`PERF probe diag: pageErrors=${JSON.stringify(errors.slice(0, 3))} htmlHead=${JSON.stringify(html.slice(0, 400))}`);
    } catch {
      // 页面已不可读：无法补充诊断
    }
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function main() {
  const migrationPath = path.join(root, "migrations", "025_garden_canonical.sql");
  check("025 migration exists", () => assert.equal(fs.existsSync(migrationPath), true));

  // Empty database: migration is repeatable and does not alter its migration checksum.
  check("migration works on an empty database and remains repeatable", () => {
    const emptyPath = path.join(tempRoot, "empty.db");
    const db = new Database(emptyPath);
    db.pragma("foreign_keys = ON");
    migrateUp(db);
    const before = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count;
    const beforeChecksum = db.prepare("SELECT checksum FROM schema_migrations WHERE version = 25").get()?.checksum;
    migrateUp(db);
    const after = db.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count;
    const afterChecksum = db.prepare("SELECT checksum FROM schema_migrations WHERE version = 25").get()?.checksum;
    assert.equal(before, after);
    assert.equal(beforeChecksum, checksum(migrationPath));
    assert.equal(afterChecksum, beforeChecksum);
    const verification = verifyDatabase(db);
    assert.equal(verification.ok, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 25").get().count, 1);
    db.close();
  });

  // Existing database: simulate a pre-link single-person hall, then apply 025 exactly once.
  check("migration backfills representative hall links without losing rows", () => {
    const existingPath = path.join(tempRoot, "existing.db");
    const db = new Database(existingPath);
    db.pragma("foreign_keys = ON");
    migrateUp(db);
    db.prepare("INSERT INTO users (id, email, name) VALUES ('user_existing', 'existing@test.local', 'Existing')").run();
    db.prepare("INSERT INTO memorials (id, name, user_id, visibility, is_published, hall_id) VALUES ('mem_existing', 'Existing', 'user_existing', 'public', 1, '')").run();
    db.prepare("INSERT INTO halls (id, name, owner_user_id, visibility) VALUES ('hall_mem_existing', 'Existing', 'user_existing', 'public')").run();
    db.prepare("DELETE FROM schema_migrations WHERE version = 25").run();
    const memorialsBefore = db.prepare("SELECT COUNT(*) AS count FROM memorials").get().count;
    migrateUp(db);
    const memorialsAfter = db.prepare("SELECT COUNT(*) AS count FROM memorials").get().count;
    assert.equal(memorialsAfter, memorialsBefore);
    assert.equal(db.prepare("SELECT hall_id FROM memorials WHERE id = 'mem_existing'").get().hall_id, "hall_mem_existing");
    assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
    assert.equal(db.pragma("foreign_key_check").length, 0);
    db.close();
  });

  // ---- Task 3：浏览状态机 / 确定性星阵 / waitForExit 行为化 ----
  // 经 node --experimental-strip-types 直载真实 TS 模块（.ts 显式扩展名），禁止 JS 复刻 reducer
  await checkAsync("garden-sea-state reducer drives the panel journey", async () => {
    const m = await import("../src/lib/garden-sea-state.ts");
    const initial = m.initialGardenSeaState();
    assert.equal(initial.panel, "list");
    assert.equal(initial.selectedHallId, null);
    const detail = m.gardenSeaReducer(initial, { type: "selectHall", hallId: "h1" });
    assert.equal(detail.panel, "detail");
    assert.equal(detail.selectedHallId, "h1");
    const offer = m.gardenSeaReducer(detail, { type: "openOffer" });
    assert.equal(offer.panel, "offer");
    assert.equal(m.gardenSeaReducer(offer, { type: "back" }).panel, "detail");
    const list = m.gardenSeaReducer(detail, { type: "back" });
    assert.equal(list.panel, "list");
    assert.equal(list.selectedHallId, null);
    assert.equal(list.selectedMemorialId, null);
  });

  await checkAsync("garden-sea-state URL contract round-trips through the whitelist", async () => {
    const m = await import("../src/lib/garden-sea-state.ts");
    const initial = m.initialGardenSeaState();
    const detail = m.gardenSeaReducer(initial, { type: "selectHall", hallId: "h1" });
    assert.equal(m.serializeGardenUrl(detail).get("hall"), "h1");
    assert.equal(m.serializeGardenUrl(detail).get("panel"), "detail");
    const parsed = m.parseGardenUrl(new URLSearchParams("hall=h1&panel=detail"));
    assert.equal(parsed.selectedHallId, "h1");
    assert.equal(parsed.panel, "detail");
    // 旅程状态 serialize → parse 往返保持 URL 承载的浏览语义（不含像素坐标）
    const detailMem = m.gardenSeaReducer(detail, { type: "selectMemorial", hallId: "h1", memorialId: "m1" });
    const offer = m.gardenSeaReducer(detailMem, { type: "openOffer" });
    const roundTrip = m.parseGardenUrl(m.serializeGardenUrl(offer));
    for (const key of ["view", "query", "zone", "panel", "selectedHallId", "selectedMemorialId"]) {
      assert.deepEqual(roundTrip[key], offer[key]);
    }
    // 白名单红线：scale/offset 绝不进 URL；未知参数解析时被忽略并回默认镜头
    const zoomed = { ...detail, scale: 4, offset: { x: 0.75, y: 0.25 } };
    assert.equal(m.serializeGardenUrl(zoomed).get("scale"), null);
    assert.equal(m.serializeGardenUrl(zoomed).get("offset"), null);
    const polluted = m.parseGardenUrl(new URLSearchParams("hall=h1&panel=offer&scale=9&offset=1,2&evil=x"));
    assert.equal(polluted.scale, initial.scale);
    assert.deepEqual(polluted.offset, initial.offset);
    // setZone / setView / setQuery 落到 URL；默认值省略不写
    assert.equal(m.serializeGardenUrl(m.gardenSeaReducer(initial, { type: "setZone", zone: "family" })).get("zone"), "family");
    assert.equal(m.serializeGardenUrl(initial).get("zone"), null);
    assert.equal(m.serializeGardenUrl(m.gardenSeaReducer(initial, { type: "setView", view: "3d" })).get("view"), "3d");
    assert.equal(m.serializeGardenUrl(m.gardenSeaReducer(initial, { type: "setQuery", query: "  外婆  " })).get("q"), "外婆");
    assert.equal(m.gardenSeaReducer(initial, { type: "setQuery", query: "a".repeat(50) }).query.length, 40);
  });

  await checkAsync("garden camera round-trips storage and corrupt JSON falls back to default", async () => {
    const m = await import("../src/lib/garden-sea-state.ts");
    const initial = m.initialGardenSeaState();
    const expectedDefault = { scale: initial.scale, offset: { x: initial.offset.x, y: initial.offset.y } };
    const backing = new Map();
    const shim = {
      getItem: (k) => (backing.has(k) ? backing.get(k) : null),
      setItem: (k, v) => backing.set(k, String(v)),
      removeItem: (k) => backing.delete(k),
    };
    const hadStorage = Object.prototype.hasOwnProperty.call(globalThis, "sessionStorage");
    const originalStorage = globalThis.sessionStorage;
    globalThis.sessionStorage = shim;
    try {
      m.saveGardenCamera("starsea:camera:zh", { scale: 2.5, offset: { x: 0.25, y: 0.75 } });
      assert.deepEqual(m.loadGardenCamera("starsea:camera:zh"), { scale: 2.5, offset: { x: 0.25, y: 0.75 } });
      backing.set("starsea:camera:zh", "{not json");
      assert.deepEqual(m.loadGardenCamera("starsea:camera:zh"), expectedDefault);
      backing.set("starsea:camera:zh", JSON.stringify({ scale: "big", offset: null }));
      assert.deepEqual(m.loadGardenCamera("starsea:camera:zh"), expectedDefault);
      assert.deepEqual(m.loadGardenCamera("starsea:camera:en"), expectedDefault);
    } finally {
      if (hadStorage) globalThis.sessionStorage = originalStorage;
      else delete globalThis.sessionStorage;
    }
  });

  await checkAsync("star offsets are deterministic per hall and clamp lamp counts", async () => {
    const m = await import("../src/lib/garden-sea.ts");
    const first = m.starOffsets("hall_demo", 4);
    assert.deepEqual(m.starOffsets("hall_demo", 4), first); // 同馆同形：刷新/缩放/搜索后不变
    assert.equal(first.length, 4);
    assert.equal(m.starOffsets("hall_demo", 0).length, 1); // lampCount 下限 1
    assert.equal(m.starOffsets("hall_demo", -3).length, 1);
    assert.equal(m.starOffsets("hall_demo", 9).length, 6); // 上限 6
    for (const point of first) {
      assert.equal(Math.abs(point.x) <= 0.02, true, "成员偏移应落在星群半径内");
      assert.equal(Math.abs(point.y) <= 0.02, true);
    }
    const shapes = new Set();
    for (let i = 0; i < 60; i += 1) shapes.add(JSON.stringify(m.starOffsets(`hall_${i}`, 6)));
    assert.equal(shapes.size >= 3, true, "固定预设应覆盖多种星形");
    const ordered = m.stableHallOrder([{ hallId: "hall_b" }, { hallId: "hall_a" }]);
    assert.deepEqual(ordered.map((h) => h.hallId), ["hall_a", "hall_b"]);
    const source = fs.readFileSync(path.join(root, "src", "lib", "garden-sea.ts"), "utf8");
    assert.equal(source.includes("Math.random"), false, "确定性布局禁用 Math.random");
  });

  // ---- Task 6：择位坐标归一化（clamp 0–1 + 3 位小数，发送前统一走这里） ----
  await checkAsync("placement points clamp to 0-1 and round to 3 decimals", async () => {
    const m = await import("../src/lib/garden-sea.ts");
    assert.equal(typeof m.roundPlacementPoint, "function");
    assert.deepEqual(m.roundPlacementPoint(0.123456, 0.9876549), { x: 0.123, y: 0.988 });
    assert.deepEqual(m.roundPlacementPoint(-0.2, 1.4), { x: 0, y: 1 });
    assert.deepEqual(m.roundPlacementPoint(NaN, 0.5), { x: 0, y: 0.5 });
    assert.deepEqual(m.roundPlacementPoint(Infinity, 0.5), { x: 1, y: 0.5 });
    // 钳制在先、舍入在后：边界值四舍五入不会越界（0.9996 → 1 而非 1.001）
    assert.deepEqual(m.roundPlacementPoint(0.9996, 0.9994), { x: 1, y: 0.999 });
  });

  await checkAsync("waitForExit resolves promptly after the child already exited", async () => {
    const child = spawn(process.execPath, ["-e", ""]);
    await new Promise((resolve) => child.once("exit", resolve)); // 先让它自然退出
    const startedAt = Date.now();
    const result = await withTimeout(waitForExit(child), 1500, "post-exit listener path hung");
    assert.equal(Date.now() - startedAt < 1500, true);
    assert.ok(result && ["exit", "close", "state"].includes(result.event));
  });

  await checkAsync("waitForExit resolves for a pre-registered child that gets killed", async () => {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);
    const exitPromise = waitForExit(child); // 运行中先注册监听（pre-kill 路径）
    child.kill();
    const result = await withTimeout(exitPromise, 5000, "kill path hung");
    assert.ok(result && ["exit", "close"].includes(result.event));
  });

  fs.mkdirSync(appRoot, { recursive: true });
  for (const entry of ["src", "public", "migrations", "package.json", "next.config.ts", "postcss.config.mjs", "tailwind.config.ts"]) {
    const source = path.join(root, entry);
    if (!fs.existsSync(source)) continue;
    if (["src", "public", "migrations"].includes(entry)) {
      const copy = spawn("robocopy", [source, path.join(appRoot, entry), "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS"], { stdio: "ignore" });
      const exit = await new Promise((resolve) => copy.once("exit", resolve));
      if (exit === null || exit > 7) throw new Error(`robocopy ${entry} failed: ${exit}`);
    } else fs.copyFileSync(source, path.join(appRoot, entry));
  }
  const copyDependencies = spawn("robocopy", [path.join(root, "node_modules"), path.join(appRoot, "node_modules"), "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS"], { stdio: "ignore" });
  const copyExit = await new Promise((resolve) => copyDependencies.once("exit", resolve));
  if (copyExit === null || copyExit > 7) throw new Error(`robocopy node_modules failed: ${copyExit}`);
  fs.copyFileSync(path.join(root, "tsconfig.json"), path.join(appRoot, "tsconfig.json"));
  const require = createRequire(import.meta.url);
  const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next");
  server = spawn(process.execPath, [nextBin, "dev", appRoot, "--webpack", "-p", String(port)], {
    cwd: appRoot,
    env: { ...process.env, NODE_PATH: path.join(root, "node_modules"), SMOKE_DB_PATH: dbPath, BIAN_NEXT_DIST_DIR: ".next-starsea-formal", NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  serverExitPromise = waitForExit(server);
  await waitForServer();

  const client = cookieJar();
  await register(client);
  const ids = [];
  for (const name of ["正式星海甲", "正式星海乙", "正式星海丙"]) {
    ids.push(await createPublicMemorial(client, name));
  }
  const oneCharacterId = await createPublicMemorial(client, "一");
  const savedZeroId = await createPublicMemorial(client, "零");

  const db = new Database(dbPath, { readonly: true });
  check("new memorial links to its canonical hall", () => {
    for (const id of ids) {
      const row = db.prepare(
        "SELECT m.hall_id, m.user_id, m.visibility, h.owner_user_id, h.visibility AS hall_visibility FROM memorials m JOIN halls h ON h.id = m.hall_id WHERE m.id = ?"
      ).get(id);
      assert.equal(row.hall_id, `hall_${id}`);
      assert.equal(row.owner_user_id, row.user_id);
      assert.equal(row.hall_visibility, row.visibility);
    }
  });
  db.close();

  const zeroWriter = new Database(dbPath);
  zeroWriter.prepare("UPDATE halls SET garden_x = 0, garden_y = 0 WHERE id = ?").run(`hall_${savedZeroId}`);
  zeroWriter.close();
  const savedZeroPlacement = await client.request(`/api/memorials/${savedZeroId}/garden`, {
    method: "POST",
    body: { in_garden: true },
  });
  await checkAsync("valid saved zero coordinates remain valid", async () => {
    assert.equal(savedZeroPlacement.status, 200);
    assert.equal(savedZeroPlacement.json.x, 0);
    assert.equal(savedZeroPlacement.json.y, 0);
  });

  const placements = [];
  for (const id of ids) {
    const placement = await client.request(`/api/memorials/${id}/garden`, {
      method: "POST",
      body: { in_garden: true },
    });
    await checkAsync(`legacy garden placement returns canonical hall data for ${id}`, async () => {
      assert.equal(placement.status, 200);
      assert.equal(placement.json.hallId, `hall_${id}`);
      assert.equal(placement.json.inGarden, true);
      assert.equal(typeof placement.json.x, "number");
      assert.equal(typeof placement.json.y, "number");
      placements.push(placement.json);
    });
  }

  await checkAsync("SQL NULL coordinates receive sparse deterministic positions", async () => {
    assert.notDeepEqual({ x: placements[0].x, y: placements[0].y }, { x: 0, y: 0 });
    assert.equal(positionDistance(placements[0], placements[1]) >= 0.04, true);
  });

  const oneCharacterPlacement = await client.request(`/api/memorials/${oneCharacterId}/garden`, {
    method: "POST",
    body: { in_garden: true },
  });
  await checkAsync("one-character StarSea names are always masked", async () => {
    assert.equal(oneCharacterPlacement.status, 200);
    const body = await (await fetch(`${baseUrl}/api/garden/starsea?bbox=0,0,1,1`)).json();
    const hall = body.halls.find((item) => item.hallId === `hall_${oneCharacterId}`);
    assert.equal(hall.nameMasked, "*");
  });

  const writer = new Database(dbPath);
  const protectedHallId = `hall_${ids[0]}`;
  const owner = writer.prepare("SELECT user_id FROM memorials WHERE id = ?").get(ids[0]);
  writer.prepare("UPDATE halls SET visibility = 'private', in_garden = 0, garden_x = NULL, garden_y = NULL WHERE id = ?").run(protectedHallId);
  writer.prepare(
    `INSERT INTO memorials (id, name, user_id, visibility, is_published, hall_id, avatar_url, birth_date, death_date, epitaph, created_at)
     VALUES (?, '秘', ?, 'private', 1, ?, 'secret-avatar', '1900', '2000', 'secret epitaph', '2000-01-01 00:00:00')`
  ).run(`private_${randomUUID()}`, owner.user_id, protectedHallId);
  writer.close();

  await checkAsync("legacy placement refuses a public member inside a non-public hall", async () => {
    const response = await client.request(`/api/memorials/${ids[0]}/garden`, { method: "POST", body: { in_garden: true } });
    assert.equal(response.status, 400);
    assert.deepEqual(response.json, { error: "visibility_required" });
    const db = new Database(dbPath, { readonly: true });
    const hall = db.prepare("SELECT visibility, in_garden FROM halls WHERE id = ?").get(protectedHallId);
    db.close();
    assert.deepEqual(hall, { visibility: "private", in_garden: 0 });
  });

  const publicHallId = `hall_${ids[1]}`;
  const writer2 = new Database(dbPath);
  const owner2 = writer2.prepare("SELECT user_id FROM memorials WHERE id = ?").get(ids[1]);
  writer2.prepare(
    `INSERT INTO memorials (id, name, user_id, visibility, is_published, hall_id, avatar_url, birth_date, death_date, epitaph, created_at)
     VALUES (?, '隐', ?, 'group', 1, ?, 'secret-avatar', '1901', '2001', 'secret epitaph', '2000-01-01 00:00:00')`
  ).run(`group_${randomUUID()}`, owner2.user_id, publicHallId);
  writer2.close();

  await checkAsync("starsea excludes private and group members from public aggregates", async () => {
    const body = await (await fetch(`${baseUrl}/api/garden/starsea?bbox=0,0,1,1`)).json();
    const hall = body.halls.find((item) => item.hallId === publicHallId);
    assert.equal(hall.lampCount, 1);
    assert.equal(hall.avatarUrl, "");
    assert.equal(hall.birthDate, "");
    assert.equal(hall.deathDate, "");
    assert.equal(hall.epitaph, "");
    assert.notEqual(hall.nameMasked, "隐");
  });

  await checkAsync("invalid bbox is rejected instead of widening the query", async () => {
    const response = await fetch(`${baseUrl}/api/garden/starsea?bbox=0.9,0.2,0.1,0.8`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_bbox" });
  });

  await checkAsync("invalid zone is rejected", async () => {
    const response = await fetch(`${baseUrl}/api/garden/starsea?zone=unknown`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_zone" });
  });

  await checkAsync("starsea returns masked canonical halls inside bbox", async () => {
    const response = await fetch(`${baseUrl}/api/garden/starsea?bbox=0,0,1,1&limit=200`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(Array.isArray(body.halls), true);
    assert.equal("nextCursor" in body, true);
    assert.equal(body.halls.length, ids.length + 1);
    for (const hall of body.halls) {
      assert.equal(hall.hallId.startsWith("hall_"), true);
      assert.equal(hall.lampCount >= 1, true);
      assert.equal(hall.nameMasked.includes("*"), true);
      assert.equal("views" in hall, false);
      assert.equal("heat" in hall, false);
      assert.equal(hall.x >= 0 && hall.x <= 1 && hall.y >= 0 && hall.y <= 1, true);
    }
  });

  await checkAsync("starsea pagination is stable and returns null at the end", async () => {
    const first = await (await fetch(`${baseUrl}/api/garden/starsea?limit=2`)).json();
    assert.equal(first.halls.length, 2);
    assert.equal(typeof first.nextCursor, "string");
    assert.equal(first.nextCursor, first.halls.at(-1).hallId);
    const second = await (await fetch(`${baseUrl}/api/garden/starsea?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`)).json();
    assert.equal(second.halls.length, 2);
    assert.equal(second.nextCursor, null);
    assert.deepEqual(
      [...first.halls, ...second.halls].map((hall) => hall.hallId),
      [...ids.slice(1), oneCharacterId, savedZeroId].map((id) => `hall_${id}`).sort()
    );
  });

  // ---- Task 8：规模夹具 + bbox/游标/稳定排序证明 ----
  let scaleBaselineCount = 0;
  {
    const db = new Database(dbPath, { readonly: true });
    scaleBaselineCount = db.prepare(STARSEA_GROUND_TRUTH_SQL).get().n;
    db.close();
  }

  await checkAsync("scale fixture seeds 600+ public halls with published memorials", async () => {
    const db = new Database(dbPath);
    try {
      const seeded = seedScaleFixture(db);
      assert.equal(seeded >= 600, true, `夹具应插入 ≥600 座馆，实际 ${seeded}`);
      const dbCount = db.prepare(STARSEA_GROUND_TRUTH_SQL).get().n;
      assert.equal(dbCount, scaleBaselineCount + seeded, "夹具馆应全部进入星海数据源");
      const onBoundary = db.prepare(
        "SELECT COUNT(*) AS n FROM halls WHERE id LIKE ? AND (garden_x = 0.5 OR garden_y = 0.5)"
      ).get(`hall_${SCALE_RUN}%`).n;
      assert.equal(onBoundary, 0, "夹具坐标应避开 0.5 共享边界精确值");
    } finally {
      db.close();
    }
  });

  await checkAsync("cursor walk serves the full 600+ set with no silent truncation", async () => {
    const first = await (await fetch(`${baseUrl}/api/garden/starsea?bbox=0,0,1,1&limit=500`)).json();
    assert.equal(first.halls.length, 500, "首页应打满 500 上限");
    assert.equal(typeof first.nextCursor, "string", ">500 结果集必须暴露 nextCursor（不得静默截断）");
    const { halls, pages } = await walkStarsea("0,0,1,1", 500);
    const idsSeen = halls.map((hall) => hall.hallId);
    assert.equal(new Set(idsSeen).size, idsSeen.length, "游标走全量不得重复");
    const db = new Database(dbPath, { readonly: true });
    const groundTruth = db.prepare(STARSEA_GROUND_TRUTH_SQL).get().n;
    db.close();
    assert.equal(idsSeen.length, groundTruth, `游标应覆盖全部 ${groundTruth} 座馆`);
    assert.equal(groundTruth >= 600, true, "夹具规模应达 600+");
    assert.equal(pages >= 2, true, "应至少分两页");
  });

  await checkAsync("adjacent bbox requests lose and duplicate zero halls at the shared boundary", async () => {
    const left = await walkStarsea("0,0,0.5,1", 500);
    const right = await walkStarsea("0.5,0,1,1", 500);
    const full = await walkStarsea("0,0,1,1", 500);
    const leftIds = new Set(left.halls.map((hall) => hall.hallId));
    const rightIds = new Set(right.halls.map((hall) => hall.hallId));
    const fullMap = new Map(full.halls.map((hall) => [hall.hallId, hall]));
    // 恰好压在共享边界上的馆（x=0.5）按 BETWEEN 含闭区间语义允许双侧出现；
    // 除此之外任何馆都不得重复，也不得从两侧并集中消失
    const onBoundary = full.halls.filter((hall) => hall.x === 0.5).map((hall) => hall.hallId);
    for (const id of leftIds) {
      if (onBoundary.includes(id)) continue;
      assert.equal(rightIds.has(id), false, `非边界馆 ${id} 不应同时出现在两侧`);
    }
    assert.equal(
      left.halls.length + right.halls.length,
      full.halls.length + onBoundary.length,
      "左右分片总数应等于全集 + 精确边界馆数（零丢失/零重复）"
    );
    const union = new Set([...leftIds, ...rightIds]);
    for (const id of fullMap.keys()) {
      assert.equal(union.has(id), true, `全集馆 ${id} 必须被相邻分片之一覆盖（零丢失）`);
    }
    assert.equal(union.size, full.halls.length, "相邻 bbox 并集应恰好等于全集");
  });

  await checkAsync("identical repeated requests return the identical stable order", async () => {
    const url = `${baseUrl}/api/garden/starsea?bbox=0,0,1,1&limit=500`;
    const one = await (await fetch(url)).text();
    const two = await (await fetch(url)).text();
    assert.equal(one, two, "同参数重复请求应返回逐字节一致的有序结果");
  });

  await perfProbeWithFixture();

  check("scale fixture is fully cleaned up by run prefix", () => {
    const db = new Database(dbPath);
    try {
      scaleFixtureCleanup(db);
      const after = db.prepare(STARSEA_GROUND_TRUTH_SQL).get().n;
      assert.equal(after, scaleBaselineCount, "清理后星海数据源应回到夹具前基线");
    } finally {
      db.close();
    }
  });

  check("formal test never writes root Next configuration sources", () => {
    const source = formalTestSource();
    const writeCall = ["write", "File", "Sync"].join("");
    const restoreCall = ["restore", "Source", "Configs"].join("");
    assert.equal(source.includes(writeCall), false);
    assert.equal(source.includes(restoreCall), false);
  });

  check("shutdown wait is pre-registered and covers exit plus close", () => {
    const source = formalTestSource();
    assert.match(source, /function waitForExit\(child\)/);
    assert.match(source, /child\.once\("exit"/);
    assert.match(source, /child\.once\("close"/);
  });
}

// Task 8（携项 a）：Windows 下 Next 子进程退出后仍可能有句柄延迟释放（EBUSY），
// rmSync 重试后仍失败会把全绿的运行翻成非零退出。清理做有界重试 + 退避，
// 全部失败只告警留目录，绝不计入 failures / 翻转退出码。
async function removeTempRootWithRetry() {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      return;
    } catch (error) {
      const code = error && error.code ? error.code : "UNKNOWN";
      console.warn(`WARN temp cleanup attempt ${attempt}/6 failed (${code}); retrying…`);
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }
  console.warn(`WARN could not remove temp dir (Windows file lock): ${tempRoot} — not counted as a test failure`);
}

try {
  await main();
} catch (error) {
  failures += 1;
  console.error(`FATAL ${error.stack || error}`);
} finally {
  if (server && !server.killed && server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM");
  }
  if (serverExitPromise) {
    let shutdownTimer;
    const timeout = new Promise((_, reject) => {
      shutdownTimer = setTimeout(() => reject(new Error("server shutdown timeout")), 5000);
    });
    try {
      await Promise.race([serverExitPromise, timeout]);
      clearTimeout(shutdownTimer);
    } catch (error) {
      failures += 1;
      console.error(`FAIL shutdown: ${error.message}`);
      if (server && server.exitCode === null && server.signalCode === null) {
        server.kill("SIGKILL");
        // SIGKILL 后等真正退出再清目录（Windows 下文件锁未释放会导致 rmSync 失败）
        await withTimeout(serverExitPromise, 5000, "server ignored SIGKILL");
      }
      clearTimeout(shutdownTimer);
    }
  }
  await removeTempRootWithRetry();
}

console.log(`Formal StarSea: ${passes} passed, ${failures} failed`);
process.exitCode = failures === 0 ? 0 : 1;
