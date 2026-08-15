// P4 smoke: digital human pipeline (mock provider) — create → poll → review → publish
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
async function api(pathname, { method = "GET", json, form } = {}) {
  const headers = { cookie: [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ") };
  let body;
  if (json) { headers["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(BASE + pathname, { method, headers, body });
  storeCookies(res);
  const text = await res.text();
  let parsed = {};
  try { parsed = JSON.parse(text); } catch { /* html or empty */ }
  return { status: res.status, body: parsed, raw: text };
}

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
const db = new Database(path.join(process.cwd(), "data", "bian.db"));
let memorialId = null;
let taskId = null;

try {
  // 1. login (dev code echo)
  const rc = await api("/api/auth/request-code", { method: "POST", json: { channel: "email", target: email } });
  check("request-code returns devCode", rc.status === 200 && !!rc.body.devCode, JSON.stringify(rc.body));
  const vr = await api("/api/auth/verify", { method: "POST", json: { channel: "email", target: email, code: rc.body.devCode } });
  check("verify sets session", vr.status === 200 && jar.has("bian_session"));

  // 2. create memorial
  const cm = await api("/api/memorials", {
    method: "POST",
    json: { name: `P4测试-${stamp}`, biography: "他一生善良正直，深受家人爱戴。" },
  });
  memorialId = cm.body.id;
  check("memorial created", cm.status === 200 && !!memorialId, JSON.stringify(cm.body));

  // 3. free user blocked
  let res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "大家好", memorialId }) });
  check("free user rejected premium_only", res.status === 403 && res.body.error === "premium_only", `${res.status} ${JSON.stringify(res.body)}`);

  // 4. upgrade to premium directly in db
  db.prepare("UPDATE users SET membership_tier = 'premium' WHERE email = ?").run(email);

  // 5. consent required
  res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: false, script: "大家好", memorialId }) });
  check("consent required", res.status === 400 && res.body.error === "consent_required", `${res.status}`);

  // 6. script required
  res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "", memorialId }) });
  check("script required", res.status === 400 && res.body.error === "script_required", `${res.status}`);

  // 7. create task (photo + audio + custom script)
  res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "孩子们，我很想你们。", withAudio: true, memorialId }) });
  taskId = res.body.id;
  check("task created", res.status === 200 && res.body.ok === true && !!taskId, JSON.stringify(res.body));

  // 8. poll until reviewing (mock pipeline ~4s)
  let task = null;
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    const g = await api(`/api/digitalhumans?memorial_id=${memorialId}`);
    task = (g.body.tasks || []).find((t) => t.id === taskId);
    if (task && (task.status === "reviewing" || task.status === "failed")) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  check("mock pipeline reaches reviewing", task && task.status === "reviewing", task ? task.status + " " + task.error : "no task");
  check("result asset generated", !!task?.result_video_url, task?.result_video_url || "");

  // 9. second task blocked (one per memorial)
  res = await api("/api/digitalhumans", { method: "POST", form: dhForm({ consent: true, script: "again", memorialId }) });
  check("quota_used on second task", res.status === 409 && res.body.error === "quota_used", `${res.status}`);

  // 10. webhook requires secret
  res = await api("/api/digitalhumans/callback", { method: "POST", json: { provider_job_id: "x", status: "succeeded" } });
  check("callback rejected without secret", res.status === 401, `${res.status}`);

  // 11. admin review queue contains task, approve it
  const adminGet = await api("/api/admin");
  const inQueue = (adminGet.body.digitalHumans || []).find((d) => d.id === taskId);
  check("task in admin review queue", !!inQueue && inQueue.status === "reviewing", JSON.stringify(inQueue || null));
  res = await api("/api/admin", { method: "POST", json: { action: "review_digital_human", id: taskId, decision: "approve" } });
  check("admin approve ok", res.status === 200 && res.body.success === true);

  // 12. status done + asset served
  const g2 = await api(`/api/digitalhumans?memorial_id=${memorialId}`);
  const done = (g2.body.tasks || []).find((t) => t.id === taskId);
  check("task done after approve", done?.status === "done", done?.status);
  // 13. admin API rejects anonymous
  const anon = await fetch(BASE + "/api/admin");
  check("admin API rejects anonymous", anon.status === 403, String(anon.status));

  // 14. stripe checkout fails closed without keys
  res = await api("/api/stripe", { method: "POST", json: { kind: "dh_redo", memorial_id: memorialId } });
  check("checkout payment_not_configured", res.status === 503 && res.body.error === "payment_not_configured", res.status + " " + JSON.stringify(res.body));

  // 15. events tracked in admin stats
  const adminGet2 = await api("/api/admin");
  const statTypes = (adminGet2.body.stats || []).map((s) => s.type);
  check("events tracked (login, dh_create, dh_job)", ["login", "dh_create", "dh_job"].every((x) => statTypes.includes(x)), statTypes.join(","));

  const asset = await fetch(BASE + done.result_video_url);
  check("result asset served over /uploads", asset.status === 200, `${asset.status}`);
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

console.log(`\nP4 smoke: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);