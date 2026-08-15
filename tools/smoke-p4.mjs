// P4 smoke: digital human pipeline (mock provider) — create → poll → review → publish
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const path = require("path");
const { createApiClient, createCookieJar, createReporter, resolveBaseUrl, resolveDbPath, waitFor } = await import("./smoke/support.mjs");
const client = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: "p4" });
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
const email = `p4-${stamp}@test.local`;
const db = new Database(resolveDbPath());
let memorialId = null;
let taskId = null;

try {
  // 1. login (dev code echo)
  const rc = await api("/api/auth/request-code", { method: "POST", json: { channel: "email", target: email } });
  reporter.assert(rc.status === 200 && !!rc.body.devCode, "request-code returns devCode", rc.body);
  const vr = await api("/api/auth/verify", { method: "POST", json: { channel: "email", target: email, code: rc.body.devCode } });
  reporter.assert(vr.status === 200 && client.cookieJar.has("bian_session"), "verify sets session");

  // 2. create memorial
  const cm = await api("/api/memorials", {
    method: "POST",
    json: { name: `P4测试-${stamp}`, biography: "他一生善良正直，深受家人爱戴。" },
  });
  memorialId = cm.body.id;
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
  res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "孩子们，我很想你们。", withAudio: true, memorialId }) });
  taskId = res.body.id;
  reporter.assert(res.status === 200 && res.body.ok === true && !!taskId, "task created", res.body);

  // 8. poll until reviewing (mock pipeline ~4s)
  let task = null;
  task = await waitFor(async () => {
    const g = await api(`/api/digitalhumans?memorial_id=${memorialId}`);
    const candidate = (g.body.tasks || []).find((t) => t.id === taskId);
    return candidate && (candidate.status === "reviewing" || candidate.status === "failed") ? candidate : null;
  }, { timeoutMs: 40_000, intervalMs: 1_500, label: `digital-human:${taskId}` });
  reporter.assert(task && task.status === "reviewing", "mock pipeline reaches reviewing", task || "no task");
  reporter.assert(!!task?.result_video_url, "result asset generated", task?.result_video_url || "");

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
  reporter.assert(["login", "dh_create", "dh_job"].every((x) => statTypes.includes(x)), "events tracked (login, dh_create, dh_job)", statTypes);

  const asset = await fetch(`${resolveBaseUrl()}${done.result_video_url}`);
  reporter.assert(asset.status === 200, "result asset served over /uploads", { status: asset.status });
} finally {
  // cleanup
  if (taskId) {
    const row = db.prepare("SELECT photo_url, audio_url, video_url, result_video_url FROM digital_humans WHERE id = ?").get(taskId);
    db.prepare("DELETE FROM digital_humans WHERE id = ?").run(taskId);
    if (row) {
      const fs = require("fs");
      for (const url of [row.photo_url, row.audio_url, row.video_url, row.result_video_url]) {
        if (url && url.startsWith("/uploads/")) {
          try { fs.unlinkSync(path.join(process.cwd(), "data", url)); } catch { /* gone */ }
        }
      }
    }
  }
  if (memorialId) {
    db.prepare("DELETE FROM tributes WHERE memorial_id = ?").run(memorialId);
    db.prepare("DELETE FROM media WHERE memorial_id = ?").run(memorialId);
    db.prepare("DELETE FROM memorials WHERE id = ?").run(memorialId);
  }
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (user) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  }
  db.prepare("DELETE FROM login_codes WHERE target = ?").run(email);
  db.close();
}

console.log(`\nP4 smoke: ${reporter.passes} passed, ${reporter.failures} failed`);
process.exit(reporter.failures ? 1 : 0);
