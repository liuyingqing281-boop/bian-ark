// P2/P3 smoke test: AI offering generation + quota, custom upload, markdown bio, public garden
// usage: node tools/smoke-p2.mjs  (expects dev server on :3002)
import sharp from "sharp";
import Database from "better-sqlite3";
import { cleanupResources, createResourceRegistry, registerUpload } from "./smoke/cleanup.mjs";
import { createApiClient, createCookieJar, createReporter, createRunContext, resolveBaseUrl, resolveDbPath } from "./smoke/support.mjs";

const context = createRunContext("p2");
const email = context.testEmail("owner");
const client = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: `p2-${context.runId}` });
const reporter = createReporter({ suite: "p2" });
const check = reporter.check;
const api = (pathname, options) => client.request(pathname, options);
const resources = createResourceRegistry("p2", context.runId);
resources.register("userEmails", email);
const db = new Database(resolveDbPath());
const offeringPrompt = `一束白色马蹄莲，运行标识 ${context.runId}`;
const offeringName = `马蹄莲-${context.runId.slice(-6)}`;

function requireResponse(name, response, { status = 200, validate = () => true, expected = "valid JSON response" } = {}) {
  const statusOk = response.status === status;
  const structureOk = validate(response.json);
  check(`${name} status`, response.status, status);
  check(`${name} response structure`, structureOk, true);
  if (!statusOk || !structureOk) {
    const summary = JSON.stringify(response.json ?? response.text).slice(0, 500);
    throw new Error(`[p2 ${context.runId}] ${name} failed: expected ${expected}; status=${response.status}; response=${summary}`);
  }
  return response.json;
}

try {
// login
const rc = await api("/api/auth/request-code", { method: "POST", body: { channel: "email", target: email }, auth: false });
const requestCode = requireResponse("request code", rc, {
  validate: (json) => json?.ok === true && typeof json.devCode === "string",
  expected: "HTTP 200 with ok and devCode",
});
const verify = await api("/api/auth/verify", { method: "POST", body: { channel: "email", target: email, code: requestCode.devCode }, auth: false });
requireResponse("verify login", verify, {
  validate: (json) => json?.ok === true,
  expected: "HTTP 200 with ok=true",
});
check("login ok", client.cookieJar.has("bian_session"));
resources.registerUser(email, db.prepare("SELECT id FROM users WHERE email = ?").get(email)?.id);

// memorial + markdown biography
const memorialName = `测试逝者P2-${context.runId}`;
const cm = await api("/api/memorials", { method: "POST", body: { name: memorialName, type: "person", biography: `## 生平\n**慈爱**的母亲，[纪念文](https://example.com)\n\n平凡一生。\n\n运行标识：${context.runId}` } });
if (process.env.SMOKE_FORCE_MISSING_ID === "memorial" && cm.json) {
  resources.register("memorialIds", cm.json.id);
  delete cm.json.id;
}
const memorial = requireResponse("create memorial", cm, {
  validate: (json) => json?.ok === true && typeof json.id === "string" && json.id.length > 0,
  expected: "HTTP 200 with ok=true and memorial id",
});
const mid = memorial.id;
resources.register("memorialIds", mid);
const bioPage = await api(`/zh/memorial/${mid}`);
check("biography page status", bioPage.status, 200);
check("biography page shows run data", bioPage.text.includes(context.runId), true);
check("markdown bold rendered", bioPage.text.includes("<strong"), true);
check("markdown link rendered", bioPage.text.includes('href="https://example.com"'), true);
check("markdown heading rendered", bioPage.text.includes("<h3"), true);

// AI generate (mock provider) x3 ok, 4th quota exceeded
let lastGen = null;
for (let i = 0; i < 3; i++) {
  const generated = await api("/api/items/generate", { method: "POST", body: { prompt: offeringPrompt } });
  lastGen = requireResponse(`generate offerings ${i + 1}`, generated, {
    validate: (json) => json?.ok === true && Array.isArray(json.candidates) && json.candidates.length === 4
      && json.candidates.every((url) => typeof url === "string" && url.startsWith("/uploads/items/")),
    expected: "HTTP 200 with four /uploads/items/ candidates",
  });
  if (i === 0) {
    check("generate provider mock", lastGen.provider, "mock");
  }
  registerUpload(resources, ...lastGen.candidates);
}
const quotaHit = await api("/api/items/generate", { method: "POST", body: { prompt: "再来一束" } });
requireResponse("4th generate quota", quotaHit, {
  status: 429,
  validate: (json) => json?.error === "quota_exceeded",
  expected: "HTTP 429 with quota_exceeded",
});

// candidate image actually served
const candidateUrl = lastGen.candidates[0];
const candResp = await fetch(`${resolveBaseUrl()}${candidateUrl}`);
check("candidate image served", candResp.status, 200);

// claim candidate
const claim = await api("/api/items/claim", { method: "POST", body: { url: candidateUrl, prompt: offeringPrompt, name: offeringName } });
const claimedItem = requireResponse("claim offering", claim, {
  validate: (json) => json?.ok === true && typeof json.id === "string" && json.id.length > 0,
  expected: "HTTP 200 with ok=true and item id",
});
const customItemId = claimedItem.id;
resources.register("itemIds", customItemId);

// upload custom item
const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 60, b: 60 } } }).png().toBuffer();
const form = new FormData();
const customItemName = `红酒一瓶-${context.runId}`;
form.append("name", customItemName);
form.append("file", new Blob([png], { type: "image/png" }), "wine.png");
const up = await api("/api/items/upload", { method: "POST", form });
const uploadedItem = requireResponse("upload custom item", up, {
  validate: (json) => json?.ok === true && typeof json.id === "string" && typeof json.url === "string",
  expected: "HTTP 200 with ok=true, item id and upload URL",
});
resources.register("itemIds", uploadedItem.id);
registerUpload(resources, uploadedItem.url, uploadedItem.thumbUrl);
if (process.env.SMOKE_FORCE_FAILURE === "p2") throw new Error("forced_failure_after_upload");

// memorial page shows custom items (RSC serialized props)
const page = await api(`/zh/memorial/${mid}`);
check("custom items page status", page.status, 200);
check("page has claimed item", page.text.includes(offeringName), true);
check("page has uploaded item", page.text.includes(customItemName), true);

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
requireResponse("private memorial garden rejection", notPublic, {
  status: 400,
  validate: (json) => json?.error === "visibility_required",
  expected: "HTTP 400 with visibility_required",
});
const publish = await api(`/api/memorials/${mid}`, { method: "PATCH", body: { visibility: "public" } });
requireResponse("publish memorial", publish, {
  validate: (json) => json?.ok === true,
  expected: "HTTP 200 with ok=true",
});
const place = await api(`/api/memorials/${mid}/garden`, { method: "POST", body: { in_garden: true } });
const placement = requireResponse("place memorial in garden", place, {
  validate: (json) => json?.ok === true && json.in_garden === true && Number.isInteger(json.slot)
    && json.slot >= 1 && typeof json.section === "string",
  expected: "HTTP 200 with garden slot and section",
});
const gardenPage = await api("/zh/garden", { auth: false });
check("garden page status", gardenPage.status, 200);
check("garden page shows memorial", gardenPage.text.includes(memorialName), true);
const gardenApi = await api(`/api/garden?q=${encodeURIComponent(context.runId)}`, { auth: false });
const gardenResult = requireResponse("search garden by run id", gardenApi, {
  validate: (json) => Array.isArray(json?.memorials),
  expected: "HTTP 200 with memorials array",
});
const gardenRecord = gardenResult.memorials.find((record) => record.id === mid);
check("garden api record id", gardenRecord?.id, mid);
check("garden api record section", gardenRecord?.garden_section, placement.section);
check("garden api record slot", gardenRecord?.garden_slot, placement.slot);
const gardenApiMiss = await api("/api/garden?q=不存在的人", { auth: false });
const gardenMiss = requireResponse("search missing garden memorial", gardenApiMiss, {
  validate: (json) => Array.isArray(json?.memorials),
  expected: "HTTP 200 with memorials array",
});
check("garden api search miss", gardenMiss.memorials.length, 0);
const remove = await api(`/api/memorials/${mid}/garden`, { method: "POST", body: { in_garden: false } });
requireResponse("remove memorial from garden", remove, {
  validate: (json) => json?.ok === true && json.in_garden === false,
  expected: "HTTP 200 with in_garden=false",
});
const gardenPage2 = await api("/zh/garden", { auth: false });
check("garden empty after remove", gardenPage2.text.includes(memorialName), false);
} finally {
  cleanupResources(db, resources);
  db.close();
}
console.log(reporter.failures === 0 ? "ALL PASS" : `${reporter.failures} FAILURES`);
process.exit(reporter.failures === 0 ? 0 : 1);
