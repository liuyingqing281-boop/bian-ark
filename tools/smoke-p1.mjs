// P1 smoke test: auth, memorials, visibility, groups, media gallery, tribute
// usage: node tools/smoke-p1.mjs  (expects dev server on :3002)
import sharp from "sharp";
import Database from "better-sqlite3";
import { cleanupResources, createResourceRegistry, registerUpload } from "./smoke/cleanup.mjs";
import { createApiClient, createCookieJar, createReporter, createRunContext, prepareSmokeSuite, resolveBaseUrl, resolveDbPath } from "./smoke/support.mjs";

const context = createRunContext("p1");
await prepareSmokeSuite(context);
const ownerEmail = context.testEmail("owner");
const memberEmail = context.testEmail("member");
const ownerClient = createApiClient({
  baseUrl: resolveBaseUrl(),
  cookieJar: createCookieJar(),
  suite: `p1-${context.runId}`,
  identity: "owner",
});
const memberClient = createApiClient({
  baseUrl: resolveBaseUrl(),
  cookieJar: createCookieJar(),
  suite: `p1-${context.runId}`,
  identity: "member",
});
const anonymousClient = createApiClient({
  baseUrl: resolveBaseUrl(),
  cookieJar: createCookieJar(),
  suite: `p1-${context.runId}`,
  identity: "anonymous",
});
const reporter = createReporter({ suite: "p1" });
const check = reporter.check;
const ownerApi = (pathname, options) => ownerClient.request(pathname, options);
const memberApi = (pathname, options) => memberClient.request(pathname, options);
const anonymousApi = (pathname, options = {}) => anonymousClient.request(pathname, { ...options, auth: false });
const resources = createResourceRegistry("p1", context.runId);
resources.register("userEmails", ownerEmail);
resources.register("userEmails", memberEmail);
const db = new Database(resolveDbPath());

try {
const rc = await ownerApi("/api/auth/request-code", { method: "POST", body: { channel: "email", target: ownerEmail }, auth: false });
check("request-code ok", rc.json?.ok, true);
check("request-code devCode present", typeof rc.json?.devCode === "string" && rc.json.devCode.length === 6);

const vf = await ownerApi("/api/auth/verify", { method: "POST", body: { channel: "email", target: ownerEmail, code: rc.json.devCode }, auth: false });
check("verify ok", vf.json?.ok, true);
check("session cookie set", ownerClient.cookieJar.has("bian_session"));
resources.registerUser(ownerEmail, db.prepare("SELECT id FROM users WHERE email = ?").get(ownerEmail)?.id);

const memorialName = `测试逝者-${context.runId}`;
const cm = await ownerApi("/api/memorials", { method: "POST", body: { name: memorialName, type: "person", epitaph: `一路走好-${context.runId}` } });
check("create memorial id", typeof cm.json?.id === "string");
const mid = cm.json.id;
resources.register("memorialIds", mid);

const anon1 = await anonymousApi(`/zh/memorial/${mid}`);
check("anon blocked from private memorial", anon1.text.includes(memorialName), false);
const own1 = await ownerApi(`/zh/memorial/${mid}`);
check("owner sees private memorial", own1.text.includes(memorialName), true);
check("owner sees gallery panel", own1.text.includes("影像记忆"), true);

const groupName = `家人-${context.runId}`;
const cg = await ownerApi("/api/groups", { method: "POST", body: { name: groupName } });
check("create group invite_code", typeof cg.json?.invite_code === "string");
const gid = cg.json.id;
resources.register("groupIds", gid);

// second user should not view private memorial
const rc2 = await memberApi("/api/auth/request-code", { method: "POST", body: { channel: "email", target: memberEmail }, auth: false });
await memberApi("/api/auth/verify", { method: "POST", body: { channel: "email", target: memberEmail, code: rc2.json.devCode }, auth: false });
resources.registerUser(memberEmail, db.prepare("SELECT id FROM users WHERE email = ?").get(memberEmail)?.id);
const stranger = await memberApi(`/zh/memorial/${mid}`);
check("stranger blocked from private memorial", stranger.text.includes(memorialName), false);
const joinRes = await memberApi("/api/groups/join", { method: "POST", body: { invite_code: cg.json.invite_code } });
check("stranger joins group via invite", joinRes.json?.ok, true);
const memberView = await memberApi(`/zh/memorial/${mid}`);
check("group member still blocked before grant", memberView.text.includes(memorialName), false);
// owner grants group visibility
const patch1 = await ownerApi(`/api/memorials/${mid}`, { method: "PATCH", body: { visibility: "group", group_ids: [gid] } });
check("patch visibility=group ok", patch1.json?.ok, true);
const memberView2 = await memberApi(`/zh/memorial/${mid}`);
check("group member can view after grant", memberView2.text.includes(memorialName), true);
const anon2 = await anonymousApi(`/zh/memorial/${mid}`);
check("anon blocked from group memorial", anon2.text.includes(memorialName), false);

// back to owner, make public
await ownerApi(`/api/memorials/${mid}`, { method: "PATCH", body: { visibility: "public" } });
const anon3 = await anonymousApi(`/zh/memorial/${mid}`);
check("anon sees public memorial", anon3.text.includes(memorialName), true);

// media upload
const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 180, b: 120 } } }).png().toBuffer();
const form = new FormData();
form.append("memorial_id", mid);
form.append("caption", `测试照片-${context.runId}`);
form.append("files", new Blob([png], { type: "image/png" }), "test.png");
const mu = await ownerApi("/api/media", { method: "POST", form });
check("media upload saved 1", mu.json?.saved?.length, 1);
check("media upload no errors", (mu.json?.errors || []).length, 0);
const mediaId = mu.json.saved[0].id;
registerUpload(resources, mu.json.saved[0].url, mu.json.saved[0].thumbUrl);
if (process.env.SMOKE_FORCE_FAILURE === "p1") throw new Error("forced_failure_after_upload");
const own2 = await ownerApi(`/zh/memorial/${mid}`);
check("gallery renders uploaded media", own2.text.includes("/uploads/media/"), true);
const thumb = await fetch(`${resolveBaseUrl()}${mu.json.saved[0].thumbUrl}`);
check("thumbnail accessible", thumb.status, 200);

const del = await ownerApi("/api/media", { method: "DELETE", body: { id: mediaId } });
check("media delete ok", del.json?.ok, true);
const own3 = await ownerApi(`/zh/memorial/${mid}`);
check("gallery empty after delete", own3.text.includes("/uploads/media/"), false);

// anonymous tribute on public memorial (form post, expect redirect 30x)
const tributeForm = new URLSearchParams({ memorial_id: mid, lang: "zh", message: "安息" });
const tr = await anonymousApi("/api/tribute", { method: "POST", body: tributeForm, redirect: "manual" });
check("anon tribute redirects", tr.status >= 300 && tr.status < 400, true);

const me = await ownerApi("/api/me");
check("me.memorials count", me.json?.memorials?.length >= 1, true);
check("me.groups count", me.json?.groups?.length >= 1, true);

const mePage = await ownerApi(`/zh/me`);
check("me page shows memorial", mePage.text.includes(memorialName), true);
const loginPage = await anonymousApi(`/zh/login`);
check("login page renders", loginPage.status, 200);
} finally {
  cleanupResources(db, resources);
  db.close();
}
console.log(reporter.failures === 0 ? "ALL PASS" : `${reporter.failures} FAILURES`);
process.exit(reporter.failures === 0 ? 0 : 1);
