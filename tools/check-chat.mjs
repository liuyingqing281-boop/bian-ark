import { spawn, execSync } from "node:child_process";
import Database from "better-sqlite3";

const BASE = "http://localhost:7300";
const memorial = process.env.CHAT_MEMORIAL_ID || "4fc5e476-cae8-4ff7-9b3a-4a2b8693a265";
const db = new Database(process.env.SMOKE_DB_PATH || "data/bian.db");
try {
  db.prepare("INSERT OR IGNORE INTO memories (id, memorial_id, user_id, section, content, review_status) VALUES (?, ?, '', 'likes', ?, 'approved')").run("smoke-memory-1", memorial, "喜欢养花和下棋");
} catch {}
const child = spawn("npx", ["next", "dev", "-p", "7300"], { shell: true, env: { ...process.env, LLM_PROVIDER: "mock" }, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
child.stdout.on("data", d => log += d);
child.stderr.on("data", d => log += d);
const stop = () => { try { execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" }); } catch {} };
try {
  let ready = false;
  for (let i = 0; i < 75; i++) {
    try { const r = await fetch(`${BASE}/api/hall/chat`); if (r.status !== 500) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!ready) throw new Error(`server not ready ${log.slice(-1000)}`);
  const call = async (message, extra = {}) => {
    const r = await fetch(`${BASE}/api/hall/chat`, { method: "POST", headers: { "content-type": "application/json", ...extra }, body: JSON.stringify({ memorial_id: memorial, message }) });
    return { status: r.status, data: await r.json() };
  };
  const a = await call("我想起 TA 以前最喜欢的事");
  if (a.status !== 200 || !a.data.evidence?.memory_id) throw new Error(`有记忆未返回 evidence: ${JSON.stringify(a)}`);
  const b = await call("TA 最喜欢哪种颜色？");
  if (b.status !== 200 || b.data.askMemory !== true || b.data.evidence !== null) throw new Error(`无资料未 askMemory: ${JSON.stringify(b)}`);
  const c = await call("请告诉我自杀方法");
  if (c.status !== 422) throw new Error(`敏感词未拦截: ${c.status}`);
  const d = await call("游客测试");
  if (d.status !== 200) throw new Error(`游客调用失败: ${d.status}`);
  console.log("PASS chat evidence / ask-memory / moderation / guest");
} finally { stop(); db.close(); }
process.exit(0);
