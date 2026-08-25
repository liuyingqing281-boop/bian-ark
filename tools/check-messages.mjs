// 想念页消息接口冒烟：正例 + 可见性/越权负例（/api/messages）
import { spawn } from "node:child_process";
import path from "node:path";
import Database from "better-sqlite3";

const BASE = "http://localhost:7300";
const dbPath = process.env.SMOKE_DB_PATH || path.resolve(process.cwd(), "data", "bian.db");

// 全局 fetch 超时兜底：并发冒烟/僵尸端口时避免无超时 fetch 永久挂起
const rawFetch = globalThis.fetch;
globalThis.fetch = (url, opts = {}) => rawFetch(url, { ...opts, signal: opts.signal || AbortSignal.timeout(30_000) });

const child = await (async () => {
  // 重试探测：dev 服务器重编译期间首探可能 >2s，避免误判后重复起服撞端口
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
const ownerEmail = `msg-owner-${stamp}@smoke.test`;
const otherEmail = `msg-other-${stamp}@smoke.test`;

async function login(email) {
  const rc = await (await fetch(`${BASE}/api/auth/request-code`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "email", target: email }),
  })).json();
  const vr = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "email", target: email, code: rc.devCode, intent: "register", password: "Test1234!ok", agreed: true }),
  });
  return (vr.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
}

const db = new Database(dbPath);
const cleanup = [];
try {
  const ownerCookie = await login(ownerEmail);
  const otherCookie = await login(otherEmail);
  check("两用户登录成功", !!ownerCookie && !!otherCookie);
  const owner = db.prepare("SELECT id FROM users WHERE email = ?").get(ownerEmail);
  const other = db.prepare("SELECT id FROM users WHERE email = ?").get(otherEmail);

  const memId = `smoke-msg-${stamp}`;
  db.prepare("INSERT INTO memorials (id, name, type, user_id, visibility) VALUES (?, ?, 'person', ?, 'public')")
    .run(memId, `冒烟想念馆${stamp}`, owner.id);
  cleanup.push(["memorials", memId]);
  const authed = (cookie) => ({ "Content-Type": "application/json", Cookie: cookie });
  const post = (cookie, msg_type, content) =>
    fetch(`${BASE}/api/messages`, {
      method: "POST", headers: cookie ? authed(cookie) : { "Content-Type": "application/json" },
      body: JSON.stringify({ memorial_id: memId, msg_type, content }),
    });

  // --- POST 正例：三类型 ---
  const pPub = await post(ownerCookie, "public", "愿您在彼岸安好");
  const dPub = await j(pPub);
  check("馆主 POST public → 201 {id}", pPub.status === 201 && !!dPub.id);
  cleanup.push(["messages", dPub.id]);
  const pPrv = await post(otherCookie, "private", "爷爷，我考上大学了");
  const dPrv = await j(pPrv);
  check("普通用户 POST private → 201", pPrv.status === 201 && !!dPrv.id);
  cleanup.push(["messages", dPrv.id]);
  const pEul = await post(ownerCookie, "eulogy", "悼文：一生温厚如春风");
  const dEul = await j(pEul);
  check("馆主 POST eulogy → 201", pEul.status === 201 && !!dEul.id);
  cleanup.push(["messages", dEul.id]);

  // --- POST 负例 ---
  check("游客 POST → 401", (await post(null, "public", "x")).status === 401);
  check("非法 msg_type → 400", (await post(ownerCookie, "secret", "x")).status === 400);
  check("超 500 字 → 400", (await post(ownerCookie, "public", "长".repeat(501))).status === 400);
  check("空内容 → 400", (await post(ownerCookie, "public", "  ")).status === 400);
  check("缺 memorial_id → 400", (await fetch(`${BASE}/api/messages`, {
    method: "POST", headers: authed(ownerCookie),
    body: JSON.stringify({ msg_type: "public", content: "x" }),
  })).status === 400);

  // --- GET 可见性：游客看不到 private，eulogy 置顶 ---
  const gGuest = await fetch(`${BASE}/api/messages?memorial_id=${memId}`);
  const dGuest = await j(gGuest);
  check("游客 GET 200", gGuest.status === 200);
  const guestContents = dGuest.items.map((i) => i.content);
  check("游客看不到 private 悄悄话", !guestContents.includes("爷爷，我考上大学了"));
  check("游客可见 public/eulogy", guestContents.includes("愿您在彼岸安好") && guestContents.includes("悼文：一生温厚如春风"));
  check("eulogy 置顶", dGuest.items[0]?.msg_type === "eulogy");
  check("条目契约字段 {id,msg_type,content,created_at}", dGuest.items.every((i) => i.id && i.msg_type && i.content && i.created_at));

  // --- GET 可见性：作者本人可见 private ---
  const gOther = await fetch(`${BASE}/api/messages?memorial_id=${memId}`, { headers: authed(otherCookie) });
  const dOther = await j(gOther);
  check("private 作者本人可见", dOther.items.some((i) => i.content === "爷爷，我考上大学了"));
  check("馆主也看不到他人 private", !(await j(await fetch(`${BASE}/api/messages?memorial_id=${memId}`, { headers: authed(ownerCookie) })))
    .items.some((i) => i.content === "爷爷，我考上大学了"));

  // --- GET 负例 ---
  check("GET 缺 memorial_id → 400", (await fetch(`${BASE}/api/messages`)).status === 400);
  check("GET 不存在的馆 → 404", (await fetch(`${BASE}/api/messages?memorial_id=no-such`)).status === 404);

  // --- private 馆可见性 ---
  const privMemId = `smoke-msgp-${stamp}`;
  db.prepare("INSERT INTO memorials (id, name, type, user_id, visibility) VALUES (?, ?, 'person', ?, 'private')")
    .run(privMemId, `冒烟私馆${stamp}`, owner.id);
  cleanup.push(["memorials", privMemId]);
  check("游客 GET private 馆 → 403", (await fetch(`${BASE}/api/messages?memorial_id=${privMemId}`)).status === 403);
  check("非本人 GET private 馆 → 403", (await fetch(`${BASE}/api/messages?memorial_id=${privMemId}`, { headers: authed(otherCookie) })).status === 403);
  check("馆主 GET private 馆 → 200", (await fetch(`${BASE}/api/messages?memorial_id=${privMemId}`, { headers: authed(ownerCookie) })).status === 200);
} finally {
  for (const [table, id] of cleanup.reverse()) {
    try { db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id); } catch {}
  }
  db.close();
  if (child) child.kill();
}

console.log(`\nmessages 冒烟: ${fail ? `${fail} 项失败` : "全部通过"} (${pass}/${pass + fail})`);
process.exitCode = fail ? 1 : 0;
