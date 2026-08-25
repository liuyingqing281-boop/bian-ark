// P2 冒烟：/api/me/memorials 聚合（创建/协作/纪念过）+ 我的页区块
import { spawn, execSync } from "node:child_process";

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
    body: JSON.stringify({ channel: "email", target: email, code: rc.devCode, intent: "register", agreed: true }),
  });
  return (vr.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
}

try {
  const a = await login(`me-a-${stamp}@smoke.test`);
  const b = await login(`me-b-${stamp}@smoke.test`);
  const authed = (c) => ({ "Content-Type": "application/json", Cookie: c });
  check("两用户登录成功", !!a && !!b);

  // A 创建纪念馆（created）
  const ownId = await fetch(`${BASE}/api/memorials`, {
    method: "POST", headers: authed(a), body: JSON.stringify({ name: "A的馆", type: "person" }),
  }).then(j).then((d) => d.id);
  check("A 创建纪念馆", !!ownId);

  // A 供奉公开馆（tributed）
  const fd = new FormData();
  fd.set("memorial_id", PUBLIC_MEMORIAL);
  fd.set("item_id", "flower_white");
  fd.set("lang", "zh");
  const tri = await fetch(`${BASE}/api/tribute`, { method: "POST", body: fd, headers: { Cookie: a }, redirect: "manual" });
  check("A 供奉公开馆", [302, 303, 307].includes(tri.status));

  // B 建馆 + 建群绑定 + A 加入（collaborating）
  const bMid = await fetch(`${BASE}/api/memorials`, {
    method: "POST", headers: authed(b), body: JSON.stringify({ name: "B的协作馆", type: "person" }),
  }).then(j).then((d) => d.id);
  const g = await fetch(`${BASE}/api/groups`, {
    method: "POST", headers: authed(b), body: JSON.stringify({ name: "B的亲友群" }),
  }).then(j);
  await fetch(`${BASE}/api/memorials/${bMid}`, {
    method: "PATCH", headers: authed(b), body: JSON.stringify({ group_ids: [g.id], visibility: "group" }),
  }).then(j);
  const join = await fetch(`${BASE}/api/groups/join`, {
    method: "POST", headers: authed(a), body: JSON.stringify({ invite_code: g.invite_code }),
  }).then(j);
  check("A 加入 B 的亲友群（协作关系成立）", join.ok === true);

  // 聚合接口
  const guest = await fetch(`${BASE}/api/me/memorials`);
  check("负例：游客访问聚合接口 → 401", guest.status === 401);

  const agg = await fetch(`${BASE}/api/me/memorials`, { headers: authed(a) }).then(j);
  check("GET /api/me/memorials 200 且 total 正确", agg.total === 3, `total=${agg.total}`);
  const byId = Object.fromEntries((agg.items || []).map((x) => [x.id, x]));
  check("含我创建的", byId[ownId]?.relation === "created");
  check("含纪念过的", byId[PUBLIC_MEMORIAL]?.relation === "tributed");
  check("含协作中的", byId[bMid]?.relation === "collaborating");
  const sorted = (agg.items || []).every((v, i, arr) => i === 0 || arr[i - 1].last_at >= v.last_at);
  check("按最近动态倒序", sorted);

  // B 视角：只有 1 条（自己创建的），不含 A 供奉的馆
  const aggB = await fetch(`${BASE}/api/me/memorials`, { headers: authed(b) }).then(j);
  check("B 的聚合不含无关馆", aggB.total === 1 && aggB.items[0]?.id === bMid, `total=${aggB.total}`);

  // 我的页
  const me = await fetch(`${BASE}/zh/me`, { headers: { Cookie: a } });
  const meHtml = await me.text();
  check("GET /zh/me 200", me.status === 200);
  check("我的页含「我的纪念」区块", meHtml.includes("我的纪念"));
  check("我的页列出三种关系的馆", meHtml.includes("A的馆") && meHtml.includes("王老先生") && meHtml.includes("B的协作馆"));
  check("关系标签正确展示", meHtml.includes("我创建的") && meHtml.includes("纪念过") && meHtml.includes("协作中"));
  check("我的页含「订单记录」区块", meHtml.includes("订单记录"));
} finally {
  if (child) {
    try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
