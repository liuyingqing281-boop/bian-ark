import Database from "better-sqlite3";
import { createApiClient, createCookieJar, createReporter, createRunContext, prepareSmokeSuite, resolveBaseUrl, resolveDbPath } from "./smoke/support.mjs";

const context = createRunContext("payment");
await prepareSmokeSuite(context);
const client = createApiClient({ baseUrl: resolveBaseUrl(), cookieJar: createCookieJar(), suite: `payment-${context.runId}` });
const reporter = createReporter({ suite: "payment" });
const db = new Database(resolveDbPath());
const email = context.testEmail("owner");
try {
  const code = await client.request("/api/auth/request-code", { method: "POST", json: { channel: "email", target: email }, auth: false });
  const verify = await client.request("/api/auth/verify", { method: "POST", json: { channel: "email", target: email, code: code.json?.devCode }, auth: false });
  reporter.assert(verify.status === 200 && client.cookieJar.has("bian_session"), "payment login");
  const memorial = await client.request("/api/memorials", { method: "POST", json: { name: `支付测试-${context.runId}` } });
  const memorialId = memorial.json?.id;
  const health = await client.request("/api/health", { auth: false });
  const configuredMock = process.env.PAYMENT_PROVIDER === "mock";
  const created = await client.request("/api/payment", { method: "POST", json: { provider: "mock", kind: "dh_redo", memorial_id: memorialId } });
  if (!configuredMock) {
    reporter.assert(created.status === 503 && created.json?.error === "payment_not_configured", "unconfigured payment fails closed", created.json);
  } else {
    reporter.assert(created.status === 200 && created.json?.session_id, "mock payment created", created.json);
    const order = db.prepare("SELECT id, provider_session_id FROM orders WHERE user_id = (SELECT id FROM users WHERE email = ?) ORDER BY created_at DESC LIMIT 1").get(email);
    const event = { id: `evt-${context.runId}`, type: "paid", sessionId: order.provider_session_id, paymentId: `pay-${context.runId}`, amountCents: 2999, currency: "CNY" };
    const callback = await client.request("/api/payment/webhook/mock", { method: "POST", json: event, auth: false });
    reporter.assert(callback.status === 200, "mock callback succeeds", callback.json);
    const duplicate = await client.request("/api/payment/webhook/mock", { method: "POST", json: event, auth: false });
    reporter.assert(duplicate.status === 200 && duplicate.json?.duplicates === 1, "duplicate callback idempotent", duplicate.json);
    const paid = db.prepare("SELECT status FROM orders WHERE id = ?").get(order.id);
    const credit = db.prepare("SELECT COUNT(*) AS count FROM dh_redo_credits WHERE memorial_id = ?").get(memorialId);
    reporter.assert(paid?.status === "paid", "order paid", paid);
    reporter.assert(credit?.count === 1, "redo credit issued once", credit);
  }
} finally {
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (user) {
    db.prepare("DELETE FROM payment_order_meta WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)").run(user.id);
    db.prepare("DELETE FROM payment_events WHERE provider_event_id LIKE ?").run(`%evt-${context.runId}`);
    db.prepare("DELETE FROM dh_redo_credits WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM orders WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM memorials WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  }
  db.prepare("DELETE FROM login_codes WHERE target = ?").run(email);
  db.close();
}
console.log(`\nPayment smoke: ${reporter.passes} passed, ${reporter.failures} failed`);
process.exit(reporter.failures ? 1 : 0);
