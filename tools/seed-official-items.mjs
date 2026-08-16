// Seed realistic official offering images via Aliyun Tongyi Wanxiang (dashscope).
// Usage: set DASHSCOPE_API_KEY in .env.local, then: node tools/seed-official-items.mjs
// Without a key the script exits with a clear message — official items stay emoji-style.
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const sharp = require("sharp");

// minimal .env.local loader (no dotenv dep)
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const API_KEY = process.env.DASHSCOPE_API_KEY;
if (!API_KEY) {
  console.error("DASHSCOPE_API_KEY missing — put it in .env.local, then rerun.");
  process.exit(1);
}
const MODEL = process.env.DASHSCOPE_MODEL || "wan2.6-t2i";
const STYLE = "，单个主体，写实产品摄影风格，正面略俯视 15 度，左上方柔和主光，右下方轻微接触阴影，居中构图，主体占画布 72%，纯白无缝背景，无文字，无水印，无边框，庄重克制";

const ITEMS = [
  ["flower_white", "一束白色菊花"],
  ["flower_rose", "一朵红玫瑰"],
  ["flower_lily", "一支白色百合花"],
  ["candle", "一支点燃的白色蜡烛，火焰清晰"],
  ["incense", "一炉檀香，青烟袅袅"],
  ["joss_paper", "一叠传统纸钱"],
  ["fruit", "一盘新鲜水果供品（苹果橙子）"],
  ["wine", "一壶中式白酒与两只小酒杯"],
  ["teddy", "一只棕色泰迪熊玩偶"],
  ["letter", "一封手写信件与信封"],
  ["premium_custom_statue", "一尊白色大理石半身雕像"],
  ["premium_gold_ingot", "一枚金元宝"],
  ["premium_virtual_home", "一座中式庭院微缩模型"],
  ["premium_music", "一台复古木质八音盒"],
  ["premium_sky_lantern", "一盏升空的孔明灯，夜景"],
];

const outDir = path.join(process.cwd(), "data", "uploads", "items", "official");
fs.mkdirSync(outDir, { recursive: true });

async function generateSync(prompt) {
  const resp = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: { messages: [{ role: "user", content: [{ text: prompt + STYLE }] }] },
      parameters: { prompt_extend: true, watermark: false, n: 1, size: "1280*1280" },
    }),
  });
  const body = await resp.json();
  if (!resp.ok) throw new Error(body?.code || body?.message || "sync_failed");
  const parts = body?.output?.choices?.[0]?.message?.content;
  const url = Array.isArray(parts) ? parts.find((p) => p?.image)?.image : body?.output?.results?.[0]?.url;
  if (!url) throw new Error("empty_result");
  return url;
}

async function generate(prompt) {
  if (MODEL.startsWith("wan2.6")) return generateSync(prompt);
  const create = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: MODEL,
      input: { prompt: prompt + STYLE },
      parameters: { size: "1024*1024", n: 1 },
    }),
  });
  const created = await create.json();
  const taskId = created?.output?.task_id;
  if (!create.ok || !taskId) throw new Error(created?.message || "create_failed");

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const status = await poll.json();
    const s = status?.output?.task_status;
    if (s === "SUCCEEDED") return status.output.results[0].url;
    if (s === "FAILED" || s === "CANCELED") throw new Error(status?.output?.message || "task_failed");
  }
  throw new Error("timeout");
}

const db = new Database(path.join(process.cwd(), "data", "bian.db"));
const update = db.prepare("UPDATE items SET image_url = ?, style = 'realistic' WHERE id = ?");

let done = 0;
let failed = 0;
for (const [id, prompt] of ITEMS) {
  const row = db.prepare("SELECT id, image_url FROM items WHERE id = ?").get(id);
  if (!row) { console.log(`SKIP ${id} (not in items table)`); continue; }
  if (row.image_url && process.argv.includes("--skip-existing")) { console.log(`SKIP ${id} (has image)`); continue; }
  try {
    const url = await generate(prompt);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("download_" + resp.status);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const name = `${id}.webp`;
    await sharp(buffer)
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 84, alphaQuality: 90 })
      .toFile(path.join(outDir, name));
    update.run(`/uploads/items/official/${name}`, id);
    done++;
    console.log(`OK   ${id}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${id}: ${err.message}`);
  }
}
db.close();
console.log(`\ndone: ${done} generated, ${failed} failed`);
process.exit(failed ? 1 : 0);
