// 记忆档案接口冒烟：正例 + 越权负例（/api/memories, /api/memories/:id）
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
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
      if (r.ok) return null; // 已有 dev 服务器，复用
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
const ownerEmail = `mem-owner-${stamp}@smoke.test`;
const otherEmail = `mem-other-${stamp}@smoke.test`;

async function login(email) {
  const rc = await (await fetch(`${BASE}/api/auth/request-code`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "email", target: email }),
  })).json();
  const vr = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "email", target: email, code: rc.devCode, intent: "register", agreed: true }),
  });
  const cookie = (vr.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  return cookie;
}

const db = new Database(dbPath);
const cleanup = [];
try {
  const ownerCookie = await login(ownerEmail);
  const otherCookie = await login(otherEmail);
  check("两用户登录成功", !!ownerCookie && !!otherCookie);
  const owner = db.prepare("SELECT id FROM users WHERE email = ?").get(ownerEmail);
  const other = db.prepare("SELECT id FROM users WHERE email = ?").get(otherEmail);

  // 直建测试馆（public），登记清理
  const memId = `smoke-mem-${stamp}`;
  db.prepare("INSERT INTO memorials (id, name, type, user_id, visibility) VALUES (?, ?, 'person', ?, 'public')")
    .run(memId, `冒烟记忆馆${stamp}`, owner.id);
  cleanup.push(["memorials", memId]);
  const authed = (cookie) => ({ "Content-Type": "application/json", Cookie: cookie });

  // --- 负例：参数与不存在 ---
  check("GET 缺 memorial_id → 400", (await fetch(`${BASE}/api/memories`)).status === 400);
  check("GET 不存在的馆 → 404", (await fetch(`${BASE}/api/memories?memorial_id=no-such`)).status === 404);

  // --- GET 空馆结构 ---
  const g0 = await fetch(`${BASE}/api/memories?memorial_id=${memId}`);
  const d0 = await j(g0);
  check("GET 游客可读 public 馆 200", g0.status === 200 && d0.total === 0);
  check("sections 含全部 5 分区", ["personality", "relation", "likes", "speech", "profile"].every((s) => Array.isArray(d0.sections?.[s])));

  // --- POST 正例：馆主录入 ---
  const p1 = await fetch(`${BASE}/api/memories`, {
    method: "POST", headers: authed(ownerCookie),
    body: JSON.stringify({ memorial_id: memId, section: "personality", content: "一生乐观，爱讲笑话" }),
  });
  const d1 = await j(p1);
  check("馆主 POST → 201 {id}", p1.status === 201 && !!d1.id);
  cleanup.push(["memories", d1.id]);

  // --- POST 正例：普通登录用户 source=chat（对话闭环） ---
  const p2 = await fetch(`${BASE}/api/memories`, {
    method: "POST", headers: authed(otherCookie),
    body: JSON.stringify({ memorial_id: memId, section: "likes", content: "最爱茉莉花茶", source: "chat" }),
  });
  const d2 = await j(p2);
  check("普通登录用户 source=chat POST → 201", p2.status === 201 && !!d2.id);
  cleanup.push(["memories", d2.id]);

  // --- POST 负例 ---
  check("游客 POST → 403", (await fetch(`${BASE}/api/memories`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memorial_id: memId, section: "likes", content: "x", source: "chat" }),
  })).status === 403);
  check("普通用户无 source=chat POST → 403", (await fetch(`${BASE}/api/memories`, {
    method: "POST", headers: authed(otherCookie),
    body: JSON.stringify({ memorial_id: memId, section: "likes", content: "x" }),
  })).status === 403);
  check("非法 section → 400", (await fetch(`${BASE}/api/memories`, {
    method: "POST", headers: authed(ownerCookie),
    body: JSON.stringify({ memorial_id: memId, section: "bad", content: "x" }),
  })).status === 400);
  check("超 500 字 → 400", (await fetch(`${BASE}/api/memories`, {
    method: "POST", headers: authed(ownerCookie),
    body: JSON.stringify({ memorial_id: memId, section: "likes", content: "长".repeat(501) }),
  })).status === 400);

  // --- GET 汇总 ---
  const g1 = await fetch(`${BASE}/api/memories?memorial_id=${memId}`);
  const d1b = await j(g1);
  check("GET total=2 且分区归位", d1b.total === 2 && d1b.sections.personality.length === 1 && d1b.sections.likes.length === 1);
  check("entries 提供 id 供增删", d1b.entries?.length === 2 && d1b.entries.every((e) => e.id && e.section && e.content));

  // --- PATCH/DELETE 越权负例：非协作人 ---
  check("非协作人 PATCH → 403", (await fetch(`${BASE}/api/memories/${d1.id}`, {
    method: "PATCH", headers: authed(otherCookie),
    body: JSON.stringify({ content: "篡改" }),
  })).status === 403);
  check("非协作人 DELETE → 403", (await fetch(`${BASE}/api/memories/${d1.id}`, {
    method: "DELETE", headers: authed(otherCookie),
  })).status === 403);
  check("游客 PATCH → 403", (await fetch(`${BASE}/api/memories/${d1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "篡改" }),
  })).status === 403);

  // --- PATCH/DELETE 正例：馆主 ---
  const pa = await fetch(`${BASE}/api/memories/${d1.id}`, {
    method: "PATCH", headers: authed(ownerCookie),
    body: JSON.stringify({ content: "一生乐观，特别疼爱孙辈" }),
  });
  check("馆主 PATCH → {ok:true}", pa.status === 200 && (await j(pa)).ok === true);
  const de = await fetch(`${BASE}/api/memories/${d1.id}`, { method: "DELETE", headers: authed(ownerCookie) });
  check("馆主 DELETE → {ok:true}", de.status === 200 && (await j(de)).ok === true);
  const g2 = await j(await fetch(`${BASE}/api/memories?memorial_id=${memId}`));
  check("删除后 total=1 且内容更新可见", g2.total === 1 && g2.sections.likes[0] === "最爱茉莉花茶");
} finally {
  for (const [table, id] of cleanup.reverse()) {
    try { db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id); } catch {}
  }
  db.close();
  if (child) child.kill();
}

console.log(`\nmemories 冒烟: ${fail ? `${fail} 项失败` : "全部通过"} (${pass}/${pass + fail})`);
process.exitCode = fail ? 1 : 0;
