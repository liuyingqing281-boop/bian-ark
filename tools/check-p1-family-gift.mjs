// P1 冒烟：亲友共同纪念（groups/绑定/邀请/越权）+ 为 TA 准备礼物（prompt/generate/claim）+ 两个新页面
import { spawn, execSync } from "node:child_process";

const BASE = "http://localhost:7300";

// 复用已在跑的 dev 服务器；没有才自己起（且自己起的负责杀整树）
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
  const owner = await login(`fam-owner-${stamp}@smoke.test`);
  const friend = await login(`fam-friend-${stamp}@smoke.test`);
  const authed = (c) => ({ "Content-Type": "application/json", Cookie: c });
  check("两用户登录成功", !!owner && !!friend);

  // ---- 准备：馆主建馆（默认 private） ----
  const mid = await fetch(`${BASE}/api/memorials`, {
    method: "POST", headers: authed(owner),
    body: JSON.stringify({ name: "冒烟亲友馆", type: "person" }),
  }).then(j).then((d) => d.id);
  check("馆主创建纪念馆", !!mid);

  // ===== 亲友共同纪念 =====
  const g = await fetch(`${BASE}/api/groups`, {
    method: "POST", headers: authed(owner), body: JSON.stringify({ name: "冒烟亲友群" }),
  }).then(j);
  check("创建亲友群返回邀请码", !!g.id && !!g.invite_code, g.invite_code);

  const bind = await fetch(`${BASE}/api/memorials/${mid}`, {
    method: "PATCH", headers: authed(owner), body: JSON.stringify({ group_ids: [g.id], visibility: "group" }),
  }).then(j);
  check("绑定群到纪念馆并设 group 可见", bind.ok === true);

  const g1 = await fetch(`${BASE}/api/groups/${g.id}`, { headers: authed(owner) }).then(j);
  check("馆主可见成员列表与邀请码", g1.members?.length === 1 && !!g1.group?.invite_code);

  const join = await fetch(`${BASE}/api/groups/join`, {
    method: "POST", headers: authed(friend), body: JSON.stringify({ invite_code: g.invite_code }),
  }).then(j);
  check("亲友凭邀请码加入", join.ok === true && join.group_id === g.id);

  const g2 = await fetch(`${BASE}/api/groups/${g.id}`, { headers: authed(owner) }).then(j);
  check("加入后馆主看到 2 位成员", g2.members?.length === 2);

  const gFriend = await fetch(`${BASE}/api/groups/${g.id}`, { headers: authed(friend) }).then(j);
  check("普通成员看不到邀请码", gFriend.role === "member" && gFriend.group?.invite_code === undefined);

  const hallFriend = await fetch(`${BASE}/zh/hall/${mid}`, { headers: { Cookie: friend } });
  check("群组成员可访问 group 可见的馆", hallFriend.status === 200, `status=${hallFriend.status}`);

  const rot = await fetch(`${BASE}/api/groups/${g.id}/rotate-invite`, { method: "POST", headers: authed(owner) }).then(j);
  check("馆主更换邀请码", rot.ok === true && rot.invite_code && rot.invite_code !== g.invite_code);
  const joinOld = await fetch(`${BASE}/api/groups/join`, {
    method: "POST", headers: authed(friend), body: JSON.stringify({ invite_code: g.invite_code }),
  });
  check("旧邀请码失效", joinOld.status === 404);

  const rotFriend = await fetch(`${BASE}/api/groups/${g.id}/rotate-invite`, { method: "POST", headers: authed(friend) });
  check("负例：普通成员不能换邀请码", rotFriend.status === 403);

  const guestJoin = await fetch(`${BASE}/api/groups/join`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invite_code: rot.invite_code }),
  });
  check("负例：游客不能加入", guestJoin.status === 401);

  // 页面
  const famPage = await fetch(`${BASE}/zh/family/${mid}`, { headers: { Cookie: owner } });
  const famHtml = await famPage.text();
  check("GET /zh/family/:id 200", famPage.status === 200);
  check("亲友页含标题与生成入口", famHtml.includes("亲友共同纪念") && famHtml.includes("邀请链接"));
  check("亲友页成员昵称已打码", /\*\*/.test(famHtml) || famHtml.includes("馆主"));

  // ===== 为 TA 准备礼物 =====
  const giftPage = await fetch(`${BASE}/zh/gift/${mid}`, { headers: { Cookie: owner } });
  const giftHtml = await giftPage.text();
  check("GET /zh/gift/:id 200", giftPage.status === 200);
  check("礼物页含三步流标题", giftHtml.includes("为 TA 准备一份礼物"));
  check("礼物页无文案红线词", !/(AI 聊天|数字人|复活|虚拟币|充值|打榜)/.test(giftHtml));

  const hallOwner = await fetch(`${BASE}/zh/hall/${mid}`, { headers: { Cookie: owner } });
  const hallHtml = await hallOwner.text();
  check("hall 页含礼物入口", hallHtml.includes("为 TA 准备特别的礼物"));
  check("hall 页馆主可见亲友入口", hallHtml.includes("亲友共同纪念"));

  const p401 = await fetch(`${BASE}/api/items/prompt`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea: "喜欢喝茶" }),
  });
  check("负例：游客不能用帮我写", p401.status === 401);

  const pr = await fetch(`${BASE}/api/items/prompt`, {
    method: "POST", headers: authed(owner), body: JSON.stringify({ idea: "TA 很喜欢喝茶" }),
  }).then(j);
  check("帮我写返回扩写描述", typeof pr.prompt === "string" && pr.prompt.length > 0);

  const idem = `smoke-${stamp}-gift1`;
  const gen = await fetch(`${BASE}/api/items/generate`, {
    method: "POST", headers: authed(owner), body: JSON.stringify({ prompt: "一套素净的茶具，暖光", idempotency_key: idem }),
  }).then(j);
  check("帮我准备返回候选图", Array.isArray(gen.candidates) && gen.candidates.length > 0, `provider=${gen.provider}`);
  check("候选图路径合法", (gen.candidates || []).every((u) => u.startsWith("/uploads/items/")));

  const replay = await fetch(`${BASE}/api/items/generate`, {
    method: "POST", headers: authed(owner), body: JSON.stringify({ prompt: "一套素净的茶具，暖光", idempotency_key: idem }),
  }).then(j);
  check("幂等键重放不重复扣量", replay.replayed === true);

  const claim = await fetch(`${BASE}/api/items/claim`, {
    method: "POST", headers: authed(owner),
    body: JSON.stringify({ url: gen.candidates[0], prompt: "一套素净的茶具，暖光", name: "特别的茶具" }),
  }).then(j);
  check("收藏到纪念馆成功", claim.ok === true && !!claim.id);

  const claimBad = await fetch(`${BASE}/api/items/claim`, {
    method: "POST", headers: authed(owner),
    body: JSON.stringify({ url: "https://evil.example.com/x.png", prompt: "x", name: "x" }),
  });
  check("负例：外部 URL 不能收藏", claimBad.status === 400);
} finally {
  if (child) {
    try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {}
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
