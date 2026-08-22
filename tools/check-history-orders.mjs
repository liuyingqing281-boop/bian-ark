// 冒烟：M1–M3 迁移 + GET/DELETE /api/hall/chat/history + GET /api/me/orders
import { spawn } from "node:child_process";

const BASE = "http://localhost:7300";
const PUBLIC_MEMORIAL = "4fc5e476-cae8-4ff7-9b3a-4a2b8693a265"; // 王老先生（public）

const child = await (async () => {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return null;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  const c = spawn("npx", ["next", "dev", "-p", "7300"], { shell: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  c.stdout.on("data", (d) => (log += d));
  c.stderr.on("data", (d) => (log += d));
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return c;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.error("server not ready", log.slice(-1500));
  process.exit(1);
})();

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  | " + extra : ""}`);
  ok ? pass++ : fail++;
};
const j = (r) => r.json().catch(() => ({}));

const stamp = Date.now().toString(36);
async function login(email) {
  const rc = await fetch(`${BASE}/api/auth/request-code`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "email", target: email }),
  }).then((r) => r.json());
  const vr = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "email", target: email, code: rc.devCode }),
  });
  return (vr.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
}

try {
  const a = await login(`hist-a-${stamp}@smoke.test`);
  const b = await login(`hist-b-${stamp}@smoke.test`);
  const authed = (c) => ({ "Content-Type": "application/json", Cookie: c });
  check("两用户登录成功", !!a && !!b);

  // 1. A 发起一轮对话（llm mock 回落亦可），产生历史
  const chat = await fetch(`${BASE}/api/hall/chat`, {
    method: "POST", headers: authed(a),
    body: JSON.stringify({ memorialId: PUBLIC_MEMORIAL, message: "你好，我想念 TA。" }),
  }).then(j);
  check("POST /api/hall/chat 返回文本", typeof chat.text === "string" && chat.text.length > 0);

  // 2. A 读历史：camelCase 契约，user/ta 成对
  const h1 = await fetch(`${BASE}/api/hall/chat/history?memorialId=${PUBLIC_MEMORIAL}`, { headers: authed(a) }).then(j);
  check("GET history 返回条目", Array.isArray(h1.items) && h1.items.length >= 2, `n=${h1.items?.length}`);
  const it = h1.items?.[0] || {};
  check("history 条目为 camelCase 视图", "createdAt" in it && "evidenceMemoryId" in it && !("created_at" in it));
  check("history 角色枚举合法", h1.items?.every((x) => x.role === "user" || x.role === "ta"));

  // 3. 兼容 snake_case 参数
  const h1b = await fetch(`${BASE}/api/hall/chat/history?memorial_id=${PUBLIC_MEMORIAL}`, { headers: authed(a) }).then(j);
  check("兼容 memorial_id 参数", h1b.items?.length === h1.items?.length);

  // 4. B 读同一馆历史：隔离，恒空
  const h2 = await fetch(`${BASE}/api/hall/chat/history?memorialId=${PUBLIC_MEMORIAL}`, { headers: authed(b) }).then(j);
  check("他人历史隔离（空）", Array.isArray(h2.items) && h2.items.length === 0);

  // 5. 游客读历史：200 空集
  const h3 = await fetch(`${BASE}/api/hall/chat/history?memorialId=${PUBLIC_MEMORIAL}`).then(j);
  check("游客历史恒空", Array.isArray(h3.items) && h3.items.length === 0);

  // 6. 缺参 400
  const hBad = await fetch(`${BASE}/api/hall/chat/history`, { headers: authed(a) });
  check("缺 memorialId 返回 400", hBad.status === 400);

  // 7. A 清空对话 → 204 → 再读为空；B 无权限语义不受影响
  const del = await fetch(`${BASE}/api/hall/chat/history?memorialId=${PUBLIC_MEMORIAL}`, { method: "DELETE", headers: authed(a) });
  check("DELETE history 返回 204", del.status === 204);
  const h4 = await fetch(`${BASE}/api/hall/chat/history?memorialId=${PUBLIC_MEMORIAL}`, { headers: authed(a) }).then(j);
  check("清空后历史为空", h4.items?.length === 0);

  // 8. 游客 DELETE → 401
  const delG = await fetch(`${BASE}/api/hall/chat/history?memorialId=${PUBLIC_MEMORIAL}`, { method: "DELETE" });
  check("游客清空返回 401", delG.status === 401);

  // 9. 订单流水
  const og = await fetch(`${BASE}/api/me/orders`);
  check("游客订单返回 401", og.status === 401);
  const oa = await fetch(`${BASE}/api/me/orders`, { headers: authed(a) }).then(j);
  check("GET /api/me/orders 返回数组", Array.isArray(oa.items));
  if (oa.items?.length) {
    const o = oa.items[0];
    check("订单为 OrderView 契约", "amountCents" in o && "itemName" in o && "createdAt" in o && !("amount_cents" in o));
  } else {
    check("订单为 OrderView 契约（无单跳过）", true);
  }
} finally {
  if (child) child.kill("SIGTERM");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
