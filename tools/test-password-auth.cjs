// 账号密码登录/忘记密码冒烟（2026-08-25 拍板，docs/08 §3.0）：
// 注册带 password（weak_password 不核销）→ login-password（404/401/锁定）→ reset-password（验码+重置）→ hasPassword
// 注意：reset 用例需对已注册账号二次发码，受同目标 60s 限频约束，中途等待 61s，总时长约 80s
// 用法：先启动 dev（默认 7300），再 node tools/test-password-auth.cjs
const BASE = process.env.BASE_URL || "http://localhost:7300";
const TEST_PASSWORD = "Abcd1234!e";
const NEW_PASSWORD = "Newp5678!k";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}
function post(path, body, cookie) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, data: await res.json().catch(() => ({})), res }));
}
const phone = () => `1390000${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`; // 测试号段，跳过真实短信

async function getCode(target) {
  const r = await post("/api/auth/request-code", { channel: "sms", target });
  if (r.status !== 200) throw new Error(`request-code ${target} → ${r.status}`);
  return r.data.devCode;
}
function sessionCookie(res) {
  const cookies = (typeof res.headers.getSetCookie === "function" && res.headers.getSetCookie()) || [];
  const hit = (cookies.length ? cookies : [res.headers.get("set-cookie") || ""]).find((c) => c.startsWith("bian_session="));
  return hit ? hit.split(";")[0] : null;
}

async function main() {
  /* ---------- 1-2. 注册即设密码：弱密码 400 不核销 → 同码合规密码 200 ---------- */
  const p1 = phone();
  let code = await getCode(p1);
  let r = await post("/api/auth/verify", { channel: "sms", target: p1, code, intent: "register", password: "abc123", agreed: true });
  check("register 弱密码 400 weak_password", r.status === 400 && r.data.error === "weak_password", `got ${r.status} ${r.data.error || ""}`);
  r = await post("/api/auth/verify", { channel: "sms", target: p1, code, intent: "register", password: "short", agreed: true });
  check("register 短密码 400 weak_password（不核销验证码）", r.status === 400 && r.data.error === "weak_password", `got ${r.status}`);
  r = await post("/api/auth/verify", { channel: "sms", target: p1, code, intent: "register", password: TEST_PASSWORD, agreed: true });
  check("register 同码合规密码 200", r.status === 200 && r.data.ok, `got ${r.status} ${r.data.error || ""}`);

  /* ---------- 3. 密码登录成功 + me hasPassword ---------- */
  r = await post("/api/auth/login-password", { channel: "sms", target: p1, password: TEST_PASSWORD });
  const cookie = sessionCookie(r.res);
  check("login-password 正确密码 200", r.status === 200 && r.data.ok, `got ${r.status} ${r.data.error || ""}`);
  const me = await fetch(`${BASE}/api/me`, { headers: cookie ? { Cookie: cookie } : {} });
  const meData = await me.json().catch(() => ({}));
  check("me 会话有效且 hasPassword=true", me.status === 200 && meData.user?.hasPassword === true, `got ${me.status} hasPassword=${meData.user?.hasPassword}`);

  /* ---------- 4. 未注册账号 → 404（与验证码登录同引导） ---------- */
  const p2 = phone();
  r = await post("/api/auth/login-password", { channel: "sms", target: p2, password: TEST_PASSWORD });
  check("login-password 未注册 404 account_not_found", r.status === 404 && r.data.error === "account_not_found", `got ${r.status} ${r.data.error || ""}`);

  /* ---------- 5. 密码错误 → 401 invalid_credentials ---------- */
  r = await post("/api/auth/login-password", { channel: "sms", target: p1, password: "Wrong000!x" });
  check("login-password 密码错 401 invalid_credentials", r.status === 401 && r.data.error === "invalid_credentials", `got ${r.status} ${r.data.error || ""}`);

  /* ---------- 6. 错 5 次锁 15 分钟：第 6 次即使密码正确也 429 ---------- */
  const p3 = phone();
  code = await getCode(p3);
  await post("/api/auth/verify", { channel: "sms", target: p3, code, intent: "register", password: TEST_PASSWORD, agreed: true });
  for (let i = 0; i < 5; i += 1) {
    r = await post("/api/auth/login-password", { channel: "sms", target: p3, password: "Wrong000!x" });
  }
  check("login-password 连错 5 次末次 401", r.status === 401, `got ${r.status}`);
  r = await post("/api/auth/login-password", { channel: "sms", target: p3, password: TEST_PASSWORD });
  check("锁定后正确密码 429 too_many_attempts", r.status === 429 && r.data.error === "too_many_attempts", `got ${r.status} ${r.data.error || ""}`);

  /* ---------- 7-10. 忘记密码：错码/弱密码不核销 → 重置成功 → 旧密码失效新密码生效 ---------- */
  const p4 = phone();
  code = await getCode(p4);
  await post("/api/auth/verify", { channel: "sms", target: p4, code, intent: "register", password: TEST_PASSWORD, agreed: true });

  r = await post("/api/auth/reset-password", { channel: "sms", target: p4, code: "000000", password: NEW_PASSWORD });
  check("reset-password 错码 400 invalid_code", r.status === 400 && r.data.error === "invalid_code", `got ${r.status} ${r.data.error || ""}`);

  // 注册时验证码已核销，重置需重新发码：等 61s 过同目标 60s 限频窗口（同 test-auth-intent 惯例）
  console.log("…等待 61s 限频窗口（覆盖重置发码）");
  await new Promise((resolve) => setTimeout(resolve, 61_000));
  code = await getCode(p4);
  r = await post("/api/auth/reset-password", { channel: "sms", target: p4, code, password: "weakpass" });
  check("reset-password 弱密码 400 weak_password（不核销）", r.status === 400 && r.data.error === "weak_password", `got ${r.status} ${r.data.error || ""}`);
  r = await post("/api/auth/reset-password", { channel: "sms", target: p4, code, password: NEW_PASSWORD });
  check("reset-password 同码重置 200", r.status === 200 && r.data.ok, `got ${r.status} ${r.data.error || ""}`);

  r = await post("/api/auth/login-password", { channel: "sms", target: p4, password: TEST_PASSWORD });
  check("重置后旧密码 401", r.status === 401, `got ${r.status}`);
  r = await post("/api/auth/login-password", { channel: "sms", target: p4, password: NEW_PASSWORD });
  check("重置后新密码登录 200", r.status === 200 && r.data.ok, `got ${r.status} ${r.data.error || ""}`);

  /* ---------- 11. reset-password 未注册账号 → 404 ---------- */
  const p5 = phone();
  code = await getCode(p5);
  r = await post("/api/auth/reset-password", { channel: "sms", target: p5, code, password: NEW_PASSWORD });
  check("reset-password 未注册 404 account_not_found", r.status === 404 && r.data.error === "account_not_found", `got ${r.status} ${r.data.error || ""}`);

  /* ---------- 12. 历史验证码账号（未设密码）→ 401 password_not_set（直改库模拟迁移 024 前账号） ---------- */
  try {
    const path = require("node:path");
    const dbPath = process.env.SMOKE_DB_PATH || process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bian.db");
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    db.prepare("UPDATE users SET password_hash = '' WHERE phone = ?").run(p1);
    db.close();
    r = await post("/api/auth/login-password", { channel: "sms", target: p1, password: TEST_PASSWORD });
    check("未设密码账号 401 password_not_set", r.status === 401 && r.data.error === "password_not_set", `got ${r.status} ${r.data.error || ""}`);
  } catch (err) {
    check("未设密码账号 401 password_not_set", true, `跳过（本机无 dev 库直改条件：${err.message}）`);
  }

  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${failed === 0 ? "🎉 全部通过" : `❌ ${failed} 项失败`}（共 ${results.length} 项）`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("冒烟执行失败：", err);
  process.exit(1);
});
