// P2/P3 smoke test: AI offering generation + quota, custom upload, markdown bio, public garden
// usage: node tools/smoke-p2.mjs  (expects dev server on :3002)
import sharp from "sharp";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { createApiClient, createCookieJar, createReporter, resolveBaseUrl, resolveDbPath } from "./smoke/support.mjs";

const client = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: "p2" });
const reporter = createReporter({ suite: "p2" });
const check = reporter.check;
const api = (pathname, options) => client.request(pathname, options);
const generatedFiles = [];

// login
const rc = await api("/api/auth/request-code", { method: "POST", body: { channel: "email", target: "test@example.com" }, auth: false });
await api("/api/auth/verify", { method: "POST", body: { channel: "email", target: "test@example.com", code: rc.json.devCode }, auth: false });
check("login ok", client.cookieJar.has("bian_session"));

// memorial + markdown biography
const cm = await api("/api/memorials", { method: "POST", body: { name: "测试逝者P2", type: "person", biography: "## 生平\n**慈爱**的母亲，[纪念文](https://example.com)\n\n平凡一生。" } });
const mid = cm.json.id;
const bioPage = await api(`/zh/memorial/${mid}`);
check("markdown bold rendered", bioPage.text.includes("<strong"), true);
check("markdown link rendered", bioPage.text.includes('href="https://example.com"'), true);
check("markdown heading rendered", bioPage.text.includes("<h3"), true);

// AI generate (mock provider) x3 ok, 4th quota exceeded
let lastGen = null;
for (let i = 0; i < 3; i++) {
  lastGen = await api("/api/items/generate", { method: "POST", body: { prompt: "一束白色马蹄莲" } });
  if (i === 0) {
    check("generate provider mock", lastGen.json?.provider, "mock");
    check("generate 4 candidates", lastGen.json?.candidates?.length, 4);
    check("candidate url shape", lastGen.json?.candidates?.[0]?.startsWith("/uploads/items/"), true);
  }
  generatedFiles.push(...(lastGen.json?.candidates || []));
}
const quotaHit = await api("/api/items/generate", { method: "POST", body: { prompt: "再来一束" } });
check("4th generate quota 429", quotaHit.status, 429);
check("quota error code", quotaHit.json?.error, "quota_exceeded");

// candidate image actually served
const candResp = await fetch(`${resolveBaseUrl()}${lastGen.json.candidates[0]}`);
check("candidate image served", candResp.status, 200);

// claim candidate
const claim = await api("/api/items/claim", { method: "POST", body: { url: lastGen.json.candidates[0], prompt: "一束白色马蹄莲" } });
check("claim ok", claim.json?.ok, true);
const customItemId = claim.json.id;

// upload custom item
const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 60, b: 60 } } }).png().toBuffer();
const form = new FormData();
form.append("name", "红酒一瓶");
form.append("file", new Blob([png], { type: "image/png" }), "wine.png");
const up = await api("/api/items/upload", { method: "POST", form });
check("upload custom item ok", up.json?.ok, true);
generatedFiles.push(up.json?.url);

// memorial page shows custom items (RSC serialized props)
const page = await api(`/zh/memorial/${mid}`);
check("page has claimed item", page.text.includes("一束白色马蹄莲"), true);
check("page has uploaded item", page.text.includes("红酒一瓶"), true);
check("page has offer panel", page.text.includes("官方祭品"), true);

// tribute with custom item (form post)
const tr = await fetch(`${resolveBaseUrl()}/api/tribute`, {
  method: "POST",
  body: new URLSearchParams({ memorial_id: mid, lang: "zh", item_id: customItemId, message: "ai 花给你" }),
  redirect: "manual",
});
check("tribute with custom item redirects", tr.status >= 300 && tr.status < 400, true);
const wall = await api(`/zh/memorial/${mid}`);
check("wall shows custom item image", wall.text.includes("/uploads/items/"), true);

// garden flow
const notPublic = await api(`/api/memorials/${mid}/garden`, { method: "POST", body: { in_garden: true } });
check("garden place requires public", notPublic.status, 400);
check("garden error code", notPublic.json?.error, "visibility_required");
await api(`/api/memorials/${mid}`, { method: "PATCH", body: { visibility: "public" } });
const place = await api(`/api/memorials/${mid}/garden`, { method: "POST", body: { in_garden: true } });
check("garden place ok", place.json?.ok, true);
check("garden slot assigned", place.json?.slot >= 1, true);
const gardenPage = await api("/zh/garden", { auth: false });
check("garden page shows memorial", gardenPage.text.includes("测试逝者P2"), true);
check("garden page has section", gardenPage.text.includes("松涛区"), true);
const gardenApi = await api("/api/garden?q=P2", { auth: false });
check("garden api search finds it", gardenApi.json?.memorials?.some((m) => m.id === mid), true);
const gardenApiMiss = await api("/api/garden?q=不存在的人", { auth: false });
check("garden api search miss", gardenApiMiss.json?.memorials?.length, 0);
const remove = await api(`/api/memorials/${mid}/garden`, { method: "POST", body: { in_garden: false } });
check("garden remove ok", remove.json?.ok, true);
const gardenPage2 = await api("/zh/garden", { auth: false });
check("garden empty after remove", gardenPage2.text.includes("测试逝者P2"), false);

// cleanup
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
  db.prepare("DELETE FROM items WHERE owner_user_id = ?").run(uid);
  db.prepare("DELETE FROM ai_quotas WHERE user_id = ?").run(uid);
  db.prepare("DELETE FROM group_members WHERE user_id = ?").run(uid);
  db.prepare("DELETE FROM groups WHERE owner_user_id = ?").run(uid);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(uid);
  db.prepare("DELETE FROM users WHERE id = ?").run(uid);
}
db.prepare("DELETE FROM login_codes WHERE target LIKE 'test%@example.com'").run();
db.prepare("DELETE FROM group_members WHERE group_id NOT IN (SELECT id FROM groups)").run();
db.close();
for (const url of generatedFiles) {
  if (typeof url === "string" && url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "data", url);
    try { fs.unlinkSync(filePath); } catch {}
  }
}
console.log("cleanup done");
console.log(reporter.failures === 0 ? "ALL PASS" : `${reporter.failures} FAILURES`);
process.exit(reporter.failures === 0 ? 0 : 1);
