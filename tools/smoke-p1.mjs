// P1 smoke test: auth, memorials, visibility, groups, media gallery, tribute
// usage: node tools/smoke-p1.mjs  (expects dev server on :3002)
import sharp from "sharp";
import Database from "better-sqlite3";
import { createApiClient, createCookieJar, createReporter, resolveBaseUrl, resolveDbPath } from "./smoke/support.mjs";

const owner = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: "p1-owner" });
const member = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: "p1-member" });
const anonymous = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: "p1-anonymous" });
const reporter = createReporter({ suite: "p1" });
const check = reporter.check;
const api = (pathname, options) => owner.request(pathname, options);
const memberApi = (pathname, options) => member.request(pathname, options);
const anonApi = (pathname, options = {}) => anonymous.request(pathname, { ...options, auth: false });

const rc = await api("/api/auth/request-code", { method: "POST", body: { channel: "email", target: "test@example.com" }, auth: false });
check("request-code ok", rc.json?.ok, true);
check("request-code devCode present", typeof rc.json?.devCode === "string" && rc.json.devCode.length === 6);

const vf = await api("/api/auth/verify", { method: "POST", body: { channel: "email", target: "test@example.com", code: rc.json.devCode }, auth: false });
check("verify ok", vf.json?.ok, true);
check("session cookie set", owner.cookieJar.has("bian_session"));

const cm = await api("/api/memorials", { method: "POST", body: { name: "测试逝者", type: "person", epitaph: "一路走好" } });
check("create memorial id", typeof cm.json?.id === "string");
const mid = cm.json.id;

const anon1 = await anonApi(`/zh/memorial/${mid}`);
check("anon blocked from private memorial", anon1.text.includes("测试逝者"), false);
const own1 = await api(`/zh/memorial/${mid}`);
check("owner sees private memorial", own1.text.includes("测试逝者"), true);
check("owner sees gallery panel", own1.text.includes("影像记忆"), true);

const cg = await api("/api/groups", { method: "POST", body: { name: "家人" } });
check("create group invite_code", typeof cg.json?.invite_code === "string");
const gid = cg.json.id;

// second user should not view private memorial
const rc2 = await memberApi("/api/auth/request-code", { method: "POST", body: { channel: "email", target: "test2@example.com" }, auth: false });
await memberApi("/api/auth/verify", { method: "POST", body: { channel: "email", target: "test2@example.com", code: rc2.json.devCode }, auth: false });
const stranger = await memberApi(`/zh/memorial/${mid}`);
check("stranger blocked from private memorial", stranger.text.includes("测试逝者"), false);
const joinRes = await memberApi("/api/groups/join", { method: "POST", body: { invite_code: cg.json.invite_code } });
check("stranger joins group via invite", joinRes.json?.ok, true);
const memberView = await memberApi(`/zh/memorial/${mid}`);
check("group member still blocked before grant", memberView.text.includes("测试逝者"), false);
// owner grants group visibility
const patch1 = await api(`/api/memorials/${mid}`, { method: "PATCH", body: { visibility: "group", group_ids: [gid] } });
check("patch visibility=group ok", patch1.json?.ok, true);
const memberView2 = await memberApi(`/zh/memorial/${mid}`);
check("group member can view after grant", memberView2.text.includes("测试逝者"), true);
const anon2 = await anonApi(`/zh/memorial/${mid}`);
check("anon blocked from group memorial", anon2.text.includes("测试逝者"), false);

// back to owner, make public
await api(`/api/memorials/${mid}`, { method: "PATCH", body: { visibility: "public" } });
const anon3 = await anonApi(`/zh/memorial/${mid}`);
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
const thumb = await fetch(`${resolveBaseUrl()}${mu.json.saved[0].thumbUrl}`);
check("thumbnail accessible", thumb.status, 200);

const del = await api("/api/media", { method: "DELETE", body: { id: mediaId } });
check("media delete ok", del.json?.ok, true);
const own3 = await api(`/zh/memorial/${mid}`);
check("gallery empty after delete", own3.text.includes("/uploads/media/"), false);

// anonymous tribute on public memorial (form post, expect redirect 30x)
const tributeForm = new URLSearchParams({ memorial_id: mid, lang: "zh", message: "安息" });
const tr = await fetch(`${resolveBaseUrl()}/api/tribute`, { method: "POST", body: tributeForm, redirect: "manual" });
check("anon tribute redirects", tr.status >= 300 && tr.status < 400, true);

const me = await api("/api/me");
check("me.memorials count", me.json?.memorials?.length >= 1, true);
check("me.groups count", me.json?.groups?.length >= 1, true);

const mePage = await api(`/zh/me`);
check("me page shows memorial", mePage.text.includes("测试逝者"), true);
const loginPage = await api(`/zh/login`, { auth: false });
check("login page renders", loginPage.status, 200);

// cleanup test data
const db = new Database(resolveDbPath());
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
console.log(reporter.failures === 0 ? "ALL PASS" : `${reporter.failures} FAILURES`);
process.exit(reporter.failures === 0 ? 0 : 1);
