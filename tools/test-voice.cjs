// 语音接口冒烟（FR-13/14，docs/08 §3.14）：不依赖 MiMo key，验证鉴权/校验/降级路径
// 用法：先启动 dev（默认 7300），再 node tools/test-voice.cjs
const BASE = process.env.BASE_URL || "http://localhost:7300";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
  // 1. ASR 未登录 → 401
  let r = await post("/api/voice/asr", { audio: "data:audio/wav;base64,AAAA" });
  check("asr 未登录 401", r.status === 401, `got ${r.status}`);

  // 2. TTS 坏请求 → 400
  r = await post("/api/voice/tts", {});
  check("tts 缺参数 400", r.status === 400, `got ${r.status}`);

  // 3. TTS 不存在的馆 → 404（或无 key 时 503 也算降级正确）
  r = await post("/api/voice/tts", { memorialId: "nonexistent", text: "你好" });
  check("tts 不存在馆 404/降级503", r.status === 404 || r.status === 503, `got ${r.status} ${r.data.error || ""}`);

  // 4. preview 未登录 → 401
  r = await post("/api/voice/preview", { voice: "白桦", line: 0 });
  check("preview 未登录 401", r.status === 401, `got ${r.status}`);

  // 5. memorials voice 未登录 → 401
  r = await post("/api/memorials/nonexistent/voice", { mode: "preset", voice: "白桦" });
  check("voice 配置未登录 401", r.status === 401, `got ${r.status}`);

  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed}/${results.length} 通过`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
