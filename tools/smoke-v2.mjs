// V2 smoke: life timeline + moderation fail-open + garden 2.5D scene render
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name} ${extra}`); }
}

const jar = new Map();
function storeCookies(res) {
  const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of set) {
    const pair = c.split(";")[0];
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function api(pathname, { method = "GET", json } = {}) {
  const headers = { cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") };
  let body;
  if (json) { headers["content-type"] = "application/json"; body = JSON.stringify(json); }
  const res = await fetch(BASE + pathname, { method, headers, body, redirect: "manual" });
  storeCookies(res);
  const text = await res.text();
  let parsed = {};
  try { parsed = JSON.parse(text); } catch { /* html or empty */ }
  return { status: res.status, body: parsed, raw: text };
}

const stamp = Date.now();
const email = `v2-${stamp}@test.local`;
const db = new Database(path.join(process.cwd(), "data", "bian.db"));
let memorialId = null;
let eventId = null;

try {
  const rc = await api("/api/auth/request-code", { method: "POST", json: { channel: "email", target: email } });
  const vr = await api("/api/auth/verify", { method: "POST", json: { channel: "email", target: email, code: rc.body.devCode, intent: "register", agreed: true } });
  check("login ok", vr.status === 200 && jar.has("bian_session"));

  const cm = await api("/api/memorials", { method: "POST", json: { name: `V2测试-${stamp}`, biography: "平凡而伟大的一生。" } });
  memorialId = cm.body.id;
  check("memorial created", cm.status === 200 && !!memorialId);

  // timeline add x2
  let res = await api("/api/timeline", { method: "POST", json: { memorial_id: memorialId, year: "1968", title: "出生", description: "生于江南小镇" } });
  eventId = res.body.id;
  check("timeline add 1", res.status === 200 && res.body.ok === true);
  res = await api("/api/timeline", { method: "POST", json: { memorial_id: memorialId, year: "1990", title: "参加工作" } });
  check("timeline add 2", res.status === 200);

  // invalid + forbidden
  res = await api("/api/timeline", { method: "POST", json: { memorial_id: memorialId, year: "", title: "x" } });
  check("timeline invalid rejected", res.status === 400);

  // page renders timeline
  const page1 = await api(`/zh/memorial/${memorialId}`);
  check("page shows timeline title", page1.raw.includes("生平时间轴"));
  check("page shows event", page1.raw.includes("1968") && page1.raw.includes("出生"));

  // delete event
  res = await api("/api/timeline", { method: "DELETE", json: { id: eventId } });
  check("timeline delete ok", res.status === 200 && res.body.ok === true);
  const page2 = await api(`/zh/memorial/${memorialId}`);
  check("event gone after delete", !page2.raw.includes("生于江南小镇"));

  // moderation fail-open: tribute with normal message still works (no keys configured)
  const fd = new FormData();
  fd.set("memorial_id", memorialId);
  fd.set("item_id", "flower_white");
  fd.set("message", "一路走好");
  fd.set("lang", "zh");
  const tr = await fetch(BASE + "/api/tribute", {
    method: "POST",
    headers: { cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") },
    body: fd,
    redirect: "manual",
  });
  check("tribute passes moderation (fail-open)", [302, 303, 307, 308].includes(tr.status), String(tr.status));

  // garden 2.5D scene renders
  const pv = await api(`/api/memorials/${memorialId}`, { method: "PATCH", json: { visibility: "public" } });
  check("visibility public ok", pv.status === 200 && pv.body.ok === true, JSON.stringify(pv.body));
  const g = await api(`/api/memorials/${memorialId}/garden`, { method: "POST", json: { in_garden: true } });
  check("garden place ok", g.status === 200 && g.body.ok === true && g.body.in_garden === true, JSON.stringify(g.body));
  const garden = await api("/zh/garden");
  check("garden scene 2.5D markers", garden.raw.includes("garden-twinkle") && garden.raw.includes("garden-firefly") && garden.raw.includes("garden-mist"));
  check("garden shows test memorial", garden.raw.includes(`V2测试-${stamp}`));
} finally {
  db.prepare("DELETE FROM life_events WHERE memorial_id = ?").run(memorialId || "");
  db.prepare("DELETE FROM tributes WHERE memorial_id = ?").run(memorialId || "");
  db.prepare("DELETE FROM memorials WHERE id = ?").run(memorialId || "");
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (user) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  }
  db.prepare("DELETE FROM login_codes WHERE target = ?").run(email);
  db.close();
}

console.log(`\nV2 smoke: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);