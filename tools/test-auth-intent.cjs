// 登录/注册分离冒烟（2026-08-24 拍板，docs/08 §3.0）：verify intent 分流 + 微信 qrcode/callback 降级路径
// 注意：5-7 步验证 60s 同目标限频与「409 不核销验证码」，需等待 61s，总时长约 80s
// 用法：先启动 dev（默认 7300），再 node tools/test-auth-intent.cjs
const BASE = process.env.BASE_URL || "http://localhost:7300";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function getCode(channel, target) {
  const r = await post("/api/auth/request-code", { channel, target });
  return { status: r.status, error: r.data.error, code: r.data.devCode || null };
}

async function main() {
  const phone = () => `1390000${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`; // 测试号段，跳过真实短信
  const email = () => `t${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

  // 1. 旧调用缺 intent → 400 missing_intent
  const p1 = phone();
  let { code } = await getCode("sms", p1);
  let r = await post("/api/auth/verify", { channel: "sms", target: p1, code });
  check("verify 缺 intent 400 missing_intent", r.status === 400 && r.data.error === "missing_intent", `got ${r.status} ${r.data.error || ""}`);

  // 2. 登录未注册手机号 → 404 account_not_found（不再自动建号；验证码不核销）
  r = await post("/api/auth/verify", { channel: "sms", target: p1, code, intent: "login" });
  check("login 未注册 404 account_not_found", r.status === 404 && r.data.error === "account_not_found", `got ${r.status} ${r.data.error || ""}`);

  // 3. 同一验证码切注册（未勾协议）→ 400 agreement_required
  r = await post("/api/auth/verify", { channel: "sms", target: p1, code, intent: "register", name: "测试用户" });
  check("register 未勾协议 400 agreement_required", r.status === 400 && r.data.error === "agreement_required", `got ${r.status} ${r.data.error || ""}`);

  // 4. 注册成功（同意协议）→ 200
  r = await post("/api/auth/verify", { channel: "sms", target: p1, code, intent: "register", name: "测试用户", agreed: true });
  check("register 新手机号 200", r.status === 200 && r.data.ok, `got ${r.status} ${r.data.error || ""}`);

  // 5. 立即重发同目标 → 429 too_frequent（60s 限频）
  r = await post("/api/auth/request-code", { channel: "sms", target: p1 });
  check("request-code 60s 内重发 429 too_frequent", r.status === 429 && r.data.error === "too_frequent", `got ${r.status} ${r.data.error || ""}`);

  // 6. 限频窗口过后：重复注册 → 409 already_registered（且不核销新码）
  console.log("…等待 61s 限频窗口（覆盖 409 / 登录复用）");
  await sleep(61_000);
  ({ code } = await getCode("sms", p1));
  r = await post("/api/auth/verify", { channel: "sms", target: p1, code, intent: "register", agreed: true });
  check("register 已注册 409 already_registered", r.status === 409 && r.data.error === "already_registered", `got ${r.status} ${r.data.error || ""}`);

  // 7. 409 未核销 → 同一验证码直接登录成功 → 200
  r = await post("/api/auth/verify", { channel: "sms", target: p1, code, intent: "login" });
  check("login 已注册 200（409 后同码复用）", r.status === 200 && r.data.ok, `got ${r.status} ${r.data.error || ""}`);

  // 8. 邮箱通道平级：注册 200
  const e1 = email();
  ({ code } = await getCode("email", e1));
  r = await post("/api/auth/verify", { channel: "email", target: e1, code, intent: "register", agreed: true });
  check("register 邮箱通道 200（平级）", r.status === 200 && r.data.ok, `got ${r.status} ${r.data.error || ""}`);

  // 9. 邮箱登录未注册 → 404（同手机规则）
  const e2 = email();
  ({ code } = await getCode("email", e2));
  r = await post("/api/auth/verify", { channel: "email", target: e2, code, intent: "login" });
  check("login 邮箱未注册 404", r.status === 404 && r.data.error === "account_not_found", `got ${r.status} ${r.data.error || ""}`);

  // 10. 错误验证码 → 400 invalid_code
  r = await post("/api/auth/verify", { channel: "email", target: e2, code: "000000", intent: "login" });
  check("verify 错码 400 invalid_code", r.status === 400 && r.data.error === "invalid_code", `got ${r.status} ${r.data.error || ""}`);

  // 11. 微信 qrcode：未配置 WECHAT_* → 503 wechat_not_configured（配置过则应 200 返回 url）
  r = await post("/api/auth/wechat/qrcode", { intent: "register" });
  check(
    "wechat qrcode 降级 503 / 配置态 200",
    (r.status === 503 && r.data.error === "wechat_not_configured") || (r.status === 200 && !!r.data.url),
    `got ${r.status} ${r.data.error || ""}`
  );

  // 12. 微信 callback 坏 state → 400 invalid_oauth_state
  const res = await fetch(`${BASE}/api/auth/wechat/callback?state=bad&code=x`);
  const data = await res.json().catch(() => ({}));
  check("wechat callback 坏 state 400", res.status === 400 && data.error === "invalid_oauth_state", `got ${res.status} ${data.error || ""}`);

  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${failed === 0 ? "🎉 全部通过" : `❌ ${failed} 项失败`}（共 ${results.length} 项）`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("冒烟执行失败：", err);
  process.exit(1);
});
