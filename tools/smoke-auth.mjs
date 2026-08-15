import Database from "better-sqlite3";
import { cleanupResources, createResourceRegistry } from "./smoke/cleanup.mjs";
import { createApiClient, createCookieJar, createRunContext, prepareSmokeSuite, resolveBaseUrl, resolveDbPath } from "./smoke/support.mjs";

const context = createRunContext("auth");
await prepareSmokeSuite(context);
const email = context.testEmail("owner");
const resources = createResourceRegistry("auth", context.runId);
resources.register("userEmails", email);
const db = new Database(resolveDbPath());
const client = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: `auth-${context.runId}` });
const api = (pathname, options) => client.request(pathname, options);
let failures = 0;
const check = (name, condition) => {
  console.log(`[auth] ${condition ? "PASS" : "FAIL"} ${name}`);
  if (!condition) failures += 1;
};

try {
  const requested = await api("/api/auth/request-code", { method: "POST", json: { channel: "email", target: email }, auth: false });
  check("request code succeeds", requested.status === 200 && /^\d{6}$/.test(requested.json?.devCode || ""));
  const repeated = await api("/api/auth/request-code", { method: "POST", json: { channel: "email", target: email }, auth: false });
  check("repeat request is rate limited", repeated.status === 429 && repeated.json?.error === "too_frequent");

  for (let attempt = 1; attempt <= 5; attempt++) {
    const wrong = await api("/api/auth/verify", { method: "POST", json: { channel: "email", target: email, code: "000000" }, auth: false });
    check(`wrong code ${attempt} is generic`, wrong.status === 400 && wrong.json?.error === "invalid_code");
  }
  const locked = await api("/api/auth/verify", { method: "POST", json: { channel: "email", target: email, code: requested.json.devCode }, auth: false });
  check("locked code rejects correct value", locked.status === 429 && locked.json?.error === "too_many_attempts");

  db.prepare("UPDATE login_codes SET attempts = 0, locked_until = '' WHERE target = ?").run(email);
  const verified = await api("/api/auth/verify", { method: "POST", json: { channel: "email", target: email, code: requested.json.devCode }, auth: false });
  check("login succeeds after unlock", verified.status === 200 && client.cookieJar.has("bian_session"));
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  resources.registerUser(email, user?.id);

  const logout = await api("/api/auth/logout", { method: "POST" });
  check("logout succeeds", logout.status === 200 && logout.json?.ok === true);
  check("logout revokes database session", !db.prepare("SELECT 1 FROM sessions WHERE user_id = ?").get(user.id));
} finally {
  cleanupResources(db, resources);
  db.close();
}

console.log(`Auth smoke: ${failures ? `${failures} failed` : "all passed"}`);
process.exitCode = failures ? 1 : 0;
