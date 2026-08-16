// P4 smoke: digital human pipeline (mock provider) — create → poll → review → publish
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const { cleanupResources, createResourceRegistry, registerUpload } = await import("./smoke/cleanup.mjs");
const { createApiClient, createCookieJar, createReporter, createRunContext, prepareSmokeSuite, resolveBaseUrl, resolveDbPath, waitFor } = await import("./smoke/support.mjs");
const context = createRunContext("p4");
await prepareSmokeSuite(context);
const client = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: `p4-${context.runId}` });
const reporter = createReporter({ suite: "p4" });
const api = (pathname, options = {}) => client.request(pathname, options);

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
function dhForm({ consent, script, useBio, withPhoto = true, withAudio = false, memorialId }) {
  const fd = new FormData();
  fd.set("memorial_id", memorialId);
  if (consent) fd.set("consent", "1");
  if (useBio) fd.set("use_biography", "1");
  if (script != null) fd.set("script", script);
  if (withPhoto) fd.set("photo", new Blob([PNG], { type: "image/png" }), "face.png");
  if (withAudio) fd.set("audio", new Blob([Buffer.from("ID3mockaudio")], { type: "audio/mpeg" }), "voice.mp3");
  return fd;
}

const stamp = Date.now();
const email = context.testEmail("owner");
const memorialName = `P4测试-${context.runId}`;
const db = new Database(resolveDbPath());
const resources = createResourceRegistry("p4", context.runId);
resources.register("userEmails", email);
let memorialId = null;
let taskId = null;

try {
  // 1. login (dev code echo)
  const rc = await api("/api/auth/request-code", { method: "POST", json: { channel: "email", target: email } });
  reporter.assert(rc.status === 200 && !!rc.body.devCode, "request-code returns devCode", rc.body);
  const vr = await api("/api/auth/verify", { method: "POST", json: { channel: "email", target: email, code: rc.body.devCode } });
  reporter.assert(vr.status === 200 && client.cookieJar.has("bian_session"), "verify sets session");
  resources.registerUser(email, db.prepare("SELECT id FROM users WHERE email = ?").get(email)?.id);

  // 2. create memorial
  const cm = await api("/api/memorials", {
    method: "POST",
    json: { name: memorialName, biography: `他一生善良正直，深受家人爱戴。运行标识：${context.runId}` },
  });
  memorialId = cm.body.id;
  resources.register("memorialIds", memorialId);
  reporter.assert(cm.status === 200 && !!memorialId, "memorial created", cm.body);

  // 3. free user blocked
  let res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "大家好", memorialId }) });
  reporter.assert(res.status === 403 && res.body.error === "premium_only", "free user rejected premium_only", { status: res.status, body: res.body });

  // 4. upgrade to premium directly in db
  db.prepare("UPDATE users SET membership_tier = 'premium' WHERE email = ?").run(email);

  // 5. consent required
  res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: false, script: "大家好", memorialId }) });
  reporter.assert(res.status === 400 && res.body.error === "consent_required", "consent required", { status: res.status });

  // 6. script required
  res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "", memorialId }) });
  reporter.assert(res.status === 400 && res.body.error === "script_required", "script required", { status: res.status });

  // 7. create task (photo + audio + custom script)
  // 真实 provider（ark 等）会真实生成（分钟级 + 花费）：改为直接伪造 reviewing 任务，保住后续审核链路覆盖
  const health = await fetch(`${resolveBaseUrl()}/api/health`).then((r) => r.json()).catch(() => ({}));
  const dhProvider = health?.checks?.digitalHuman?.detail || "mock";
  const mockPipeline = dhProvider === "mock";
  if (mockPipeline) {
    res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "孩子们，我很想你们。", withAudio: true, memorialId }) });
    taskId = res.body.id;
    registerUpload(resources, ...(res.body.uploadUrls || []));
    reporter.assert(res.status === 200 && res.body.ok === true && !!taskId, "task created", res.body);
  } else {
    console.log(`[p4 ${context.runId}] SKIP real digital-human generation: provider = ${dhProvider} (fabricate reviewing task instead)`);
    taskId = `p4fake-${context.runId}`;
    const userId = db.prepare("SELECT id FROM users WHERE email = ?").get(email)?.id;
    db.prepare(
      `INSERT INTO digital_humans (id, memorial_id, user_id, status, photo_url, script, provider, consent_accepted)
       VALUES (?, ?, ?, 'reviewing', '', '孩子们，我很想你们。', 'p4-fabricated', 1)`
    ).run(taskId, memorialId, userId);
  }
  resources.register("taskIds", taskId);
  if (process.env.SMOKE_FORCE_FAILURE === "p4") throw new Error("forced_failure_after_task");

  // 8. poll until reviewing (mock pipeline ~4s)
  if (mockPipeline) {
    const task = await waitFor(async () => {
      const g = await api(`/api/digitalhumans?memorial_id=${memorialId}`);
      const candidate = (g.body.tasks || []).find((t) => t.id === taskId);
      return candidate && (candidate.status === "reviewing" || candidate.status === "failed") ? candidate : null;
    }, { timeoutMs: 40_000, intervalMs: 1_500, label: `digital-human:${taskId}` });
    reporter.assert(task && task.status === "reviewing", "mock pipeline reaches reviewing", task || "no task");
    reporter.assert(!!task?.result_video_url, "result asset generated", task?.result_video_url || "");
  }

  // 9. second task blocked (one per memorial)
  res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "again", memorialId }) });
  reporter.assert(res.status === 409 && res.body.error === "quota_used", "quota_used on second task", { status: res.status });

  // 10. webhook requires secret
  res = await api("/api/digitalhumans/callback", { method: "POST", json: { provider_job_id: "x", status: "succeeded" } });
  reporter.assert(res.status === 401, "callback rejected without secret", { status: res.status });

  // 11. admin review queue contains task, approve it
  const adminGet = await api("/api/admin");
  const inQueue = (adminGet.body.digitalHumans || []).find((d) => d.id === taskId);
  reporter.assert(!!inQueue && inQueue.status === "reviewing", "task in admin review queue", inQueue || null);
  res = await api("/api/admin", { method: "POST", json: { action: "review_digital_human", id: taskId, decision: "approve" } });
  reporter.assert(res.status === 200 && res.body.success === true, "admin approve ok");

  // 12. status done + asset served
  const g2 = await api(`/api/digitalhumans?memorial_id=${memorialId}`);
  const done = (g2.body.tasks || []).find((t) => t.id === taskId);
  reporter.assert(done?.status === "done", "task done after approve", done?.status);
  // 13. admin API rejects anonymous
  const anon = await fetch(`${resolveBaseUrl()}/api/admin`);
  reporter.assert(anon.status === 403, "admin API rejects anonymous", { status: anon.status });

  // 14. stripe checkout fails closed without keys
  res = await api("/api/stripe", { method: "POST", json: { kind: "dh_redo", memorial_id: memorialId } });
  reporter.assert(res.status === 503 && res.body.error === "payment_not_configured", "checkout payment_not_configured", { status: res.status, body: res.body });

  // 15. events tracked in admin stats
  const adminGet2 = await api("/api/admin");
  const statTypes = (adminGet2.body.stats || []).map((s) => s.type);
  const expectedEvents = mockPipeline ? ["login", "dh_create", "dh_job"] : ["login"];
  reporter.assert(expectedEvents.every((x) => statTypes.includes(x)), `events tracked (${expectedEvents.join(", ")})`, statTypes);

  if (mockPipeline) {
    const asset = await fetch(`${resolveBaseUrl()}${done.result_video_url}`);
    reporter.assert(asset.status === 200, "result asset served over /uploads", { status: asset.status });
  }
} finally {
  cleanupResources(db, resources);
  db.close();
}

console.log(`\nP4 smoke: ${reporter.passes} passed, ${reporter.failures} failed`);
process.exit(reporter.failures ? 1 : 0);
