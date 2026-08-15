// P1 smoke test: auth, memorials, visibility, groups, media gallery, tribute
// usage: node tools/smoke-p1.mjs  (expects dev server on :3002)
import sharp from "sharp";
import Database from "better-sqlite3";

const BASE = "http://localhost:3002";
const cookieJar = new Map();
function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
let failures = 0;

function check(name, actual, expected = true) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual} (expect ${expected})`);
}

async function api(path, { method = "GET", body, form, auth = true, redirect = "manual" } = {}) {
  const headers = {};
  if (auth && cookieJar.size) headers.Cookie = cookieHeader();
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  } else if (form !== undefined) {
    payload = form;
  }
  const res = await fetch(BASE + path, { method, headers, body: payload, redirect });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    for (const part of setCookie.split(/,(?=[^;,=]+=[^;,]+)/)) {
      const [pair] = part.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (value === "") cookieJar.delete(name);
        else cookieJar.set(name, value);
      }
    }
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const rc = await api("/api/auth/request-code", { method: "POST", body: { channel: "email", target: "test@example.com" }, auth: false });
check("request-code ok", rc.json?.ok, true);
check("request-code devCode present", typeof rc.json?.devCode === "string" && rc.json.devCode.length === 6);

const vf = await api("/api/auth/verify", { method: "POST", body: { channel: "email", target: "test@example.com", code: rc.json.devCode }, auth: false });
check("verify ok", vf.json?.ok, true);
check("session cookie set", cookieJar.has("bian_session"));

const cm = await api("/api/memorials", { method: "POST", body: { name: "测试逝者", type: "person", epitaph: "一路走好" } });
check("create memorial id", typeof cm.json?.id === "string");
const mid = cm.json.id;

const anon1 = await api(`/zh/memorial/${mid}`, { auth: false });
check("anon blocked from private memorial", anon1.text.includes("测试逝者"), false);
const own1 = await api(`/zh/memorial/${mid}`);
check("owner sees private memorial", own1.text.includes("测试逝者"), true);
check("owner sees gallery panel", own1.text.includes("影像记忆"), true);

const cg = await api("/api/groups", { method: "POST", body: { name: "家人" } });
check("create group invite_code", typeof cg.json?.invite_code === "string");
const gid = cg.json.id;

// second user should not view private memorial
const cookie1 = new Map(cookieJar);
cookieJar.clear();
const rc2 = await api("/api/auth/request-code", { method: "POST", body: { channel: "email", target: "test2@example.com" }, auth: false });
await api("/api/auth/verify", { method: "POST", body: { channel: "email", target: "test2@example.com", code: rc2.json.devCode }, auth: false });
const stranger = await api(`/zh/memorial/${mid}`);
check("stranger blocked from private memorial", stranger.text.includes("测试逝者"), false);
const joinRes = await api("/api/groups/join", { method: "POST", body: { invite_code: cg.json.invite_code } });
check("stranger joins group via invite", joinRes.json?.ok, true);
const memberView = await api(`/zh/memorial/${mid}`);
check("group member still blocked before grant", memberView.text.includes("测试逝者"), false);
const cookie2 = new Map(cookieJar);

// owner grants group visibility
cookieJar.clear(); for (const [k, v] of cookie1) cookieJar.set(k, v);
const patch1 = await api(`/api/memorials/${mid}`, { method: "PATCH", body: { visibility: "group", group_ids: [gid] } });
check("patch visibility=group ok", patch1.json?.ok, true);
cookieJar.clear(); for (const [k, v] of cookie2) cookieJar.set(k, v);
const memberView2 = await api(`/zh/memorial/${mid}`);
check("group member can view after grant", memberView2.text.includes("测试逝者"), true);
const anon2 = await api(`/zh/memorial/${mid}`, { auth: false });
check("anon blocked from group memorial", anon2.text.includes("测试逝者"), false);

// back to owner, make public
cookieJar.clear(); for (const [k, v] of cookie1) cookieJar.set(k, v);
await api(`/api/memorials/${mid}`, { method: "PATCH", body: { visibility: "public" } });
const anon3 = await api(`/zh/memorial/${mid}`, { auth: false });
check("anon sees public memorial", anon3.text.includes("测试逝者"), true);

// media upload
const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 180, b: 120 } } }).png().toBuffer();
const form = new FormData();
form.append("memorial_id", mid);
form.append("caption", "测试照片");
form.append("files", new Blob([png], { type: "image/png" }), "test.png");
const mu = await api("/api/media", { method: "POST", form });
check("media upload saved 1", mu.json?.saved?.length, 1);
check("media upload no errors", (mu.json?.errors || []).length, 0);
const mediaId = mu.json.saved[0].id;
const own2 = await api(`/zh/memorial/${mid}`);
check("gallery renders uploaded media", own2.text.includes("/uploads/media/"), true);
const thumb = await fetch(BASE + mu.json.saved[0].thumbUrl);
check("thumbnail accessible", thumb.status, 200);

const del = await api("/api/media", { method: "DELETE", body: { id: mediaId } });
check("media delete ok", del.json?.ok, true);
const own3 = await api(`/zh/memorial/${mid}`);
check("gallery empty after delete", own3.text.includes("/uploads/media/"), false);

// anonymous tribute on public memorial (form post, expect redirect 30x)
const tributeForm = new URLSearchParams({ memorial_id: mid, lang: "zh", message: "安息" });
const tr = await fetch(BASE + "/api/tribute", { method: "POST", body: tributeForm, redirect: "manual" });
check("anon tribute redirects", tr.status >= 300 && tr.status < 400, true);

const me = await api("/api/me");
check("me.memorials count", me.json?.memorials?.length >= 1, true);
check("me.groups count", me.json?.groups?.length >= 1, true);

const mePage = await api(`/zh/me`);
check("me page shows memorial", mePage.text.includes("测试逝者"), true);
const loginPage = await api(`/zh/login`, { auth: false });
check("login page renders", loginPage.status, 200);

// cleanup test data
const db = new Database("E:/彼岸/data/bian.db");
const testUsers = db.prepare("SELECT id FROM users WHERE email LIKE 'test%@example.com'").all().map((r) => r.id);
for (const uid of testUsers) {
  const mids = db.prepare("SELECT id FROM memorials WHERE user_id = ?").all(uid).map((r) => r.id);
  for (const m of mids) {
    db.prepare("DELETE FROM tributes WHERE memorial_id = ?").run(m);
    db.prepare("DELETE FROM media WHERE memorial_id = ?").run(m);
    db.prepare("DELETE FROM memorial_groups WHERE memorial_id = ?").run(m);
  }
  db.prepare("DELETE FROM memorials WHERE user_id = ?").run(uid);
  db.prepare("DELETE FROM group_members WHERE user_id = ?").run(uid);
  db.prepare("DELETE FROM groups WHERE owner_user_id = ?").run(uid);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(uid);
  db.prepare("DELETE FROM users WHERE id = ?").run(uid);
}
db.prepare("DELETE FROM login_codes WHERE target LIKE 'test%@example.com'").run();
db.prepare("DELETE FROM group_members WHERE group_id NOT IN (SELECT id FROM groups)").run();
db.close();
console.log("cleanup done");
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);