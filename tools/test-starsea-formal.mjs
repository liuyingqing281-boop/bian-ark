import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { migrateUp, verifyDatabase } from "../src/lib/migrations.mjs";

const root = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(root, ".starsea-formal-"));
const dbPath = path.join(tempRoot, "formal.db");
const appRoot = path.join(tempRoot, "app");
const distPath = path.join(appRoot, ".next-starsea-formal");
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
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("server shutdown timeout")), 5000));
    try { await Promise.race([serverExitPromise, timeout]); }
    catch (error) {
      failures += 1;
      console.error(`FAIL shutdown: ${error.message}`);
      if (server && server.exitCode === null && server.signalCode === null) server.kill("SIGKILL");
    }
  }
  fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3 });
}

console.log(`Formal StarSea: ${passes} passed, ${failures} failed`);
process.exitCode = failures === 0 ? 0 : 1;
