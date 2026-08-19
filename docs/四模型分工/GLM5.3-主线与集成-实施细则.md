# GLM5.3 主线任务 · 实施细则（可执行版）

> 上游：`GLM5.3-主线与集成.md` ｜ 本文把每项任务拆到文件、函数、键名、命令级别
> 执行纪律：**每次 git 操作前先 `git branch --show-current` 核对在 master**；一次任务一个 commit

---

## 任务 A：数字人错误提示友好化（Issue #4）

**预计 30 分钟 ｜ 涉及 2 文件 ｜ 前置：无**

### A1. 词典追加（`src/app/[lang]/dictionaries.ts`）

在 zh 的 `digitalHuman` 对象内、`mockNote` 键**之后**追加（只加不改）：

```ts
err_ark_key_missing: "生成服务尚未配置，请联系管理员",
err_ark_http_404: "生成模型暂不可用（可能未开通），请稍后再试",
err_ark_http_429: "生成请求过于频繁，请稍后再试",
err_ark_timeout: "生成超时，额度已退还，请重试",
err_ark_task_failed: "生成失败，额度已退还",
err_ark_empty_video: "生成结果异常，额度已退还，请重试",
err_ark_create_failed: "生成请求失败，请稍后再试",
err_ark_job_not_found: "生成任务丢失，额度已退还，请重试",
err_photo_missing: "照片素材缺失，请重新上传",
err_worker_timeout: "生成超时，额度已退还",
```

在 en 的 `digitalHuman` 对应位置追加：

```ts
err_ark_key_missing: "Generation service is not configured. Please contact the administrator.",
err_ark_http_404: "Generation model is unavailable (possibly not activated). Please try later.",
err_ark_http_429: "Too many generation requests. Please try later.",
err_ark_timeout: "Generation timed out; your credit has been refunded. Please retry.",
err_ark_task_failed: "Generation failed; your credit has been refunded.",
err_ark_empty_video: "Generation returned an empty result; credit refunded. Please retry.",
err_ark_create_failed: "Failed to submit the generation request. Please try later.",
err_ark_job_not_found: "The generation job was lost; credit refunded. Please retry.",
err_photo_missing: "Photo material is missing. Please upload again.",
err_worker_timeout: "Generation timed out; credit refunded.",
```

> 键名规则：取 `src/lib/digitalhuman.ts` 与 `tools/dh-worker.mjs` 中实际写入 `error` 字段的字符串（`ark_http_404: ModelNotOpen` 取冒号前段）加 `err_` 前缀。

### A2. 前端映射（`src/components/DigitalHumanPanel.tsx`）

1. 组件函数体内（`const statusLabel = ...` 附近）加：

```tsx
const friendlyError = (raw: string) => {
  const code = raw.split(":")[0].trim();
  return labels["err_" + code] || raw || labels.errGeneric;
};
```

2. 把 failed 分支（约 150 行处）：

```tsx
{task.status === "failed" && (
  <p className="text-xs text-red-400">{task.error || labels.errGeneric}</p>
)}
```

改为：

```tsx
{task.status === "failed" && task.error && (
  <p className="text-xs text-red-400">{friendlyError(task.error)}</p>
)}
```

### A3. 验收

```bash
npx tsc --noEmit                 # 通过
npm run smoke                    # 3/3
# 手工：dev 库造一条 failed 任务（error='ark_http_404: ModelNotOpen'），馆主登录打开
# /zh/memorial/<id>，任务卡片应显示「生成模型暂不可用（可能未开通），请稍后再试」
node -e "const D=require('better-sqlite3');const db=new D('data/bian.db');
db.prepare(\"UPDATE digital_humans SET status='failed',error='ark_http_404: ModelNotOpen' WHERE id=(SELECT id FROM digital_humans LIMIT 1)\").run();db.close()"
```

**Commit**：`feat: 数字人错误提示友好化（Issue #4）`

---

## 任务 B：方舟 LLM 地基（Issue #7）

**预计 1.5 小时 ｜ 新建 1 文件 + 改 .env.example**

### B1. 新建 `src/lib/llm.ts`

```ts
// 方舟对话模型客户端（Issue #7）：无 ARK_API_KEY 时 mock 回落
import crypto from "crypto";

export function llmProvider(): string {
  if (process.env.LLM_PROVIDER) return process.env.LLM_PROVIDER;
  return process.env.ARK_API_KEY ? "ark" : "mock";
}

export interface ChatOptions { maxTokens?: number; temperature?: number; timeoutMs?: number }

export async function chat(system: string, user: string, opts: ChatOptions = {}): Promise<{ text: string; provider: string; durationMs: number }> {
  const started = Date.now();
  const provider = llmProvider();
  const text = provider === "ark" ? await chatArk(system, user, opts) : mockChat(system, user);
  return { text, provider, durationMs: Date.now() - started };
}

async function chatArk(system: string, user: string, opts: ChatOptions): Promise<string> {
  const key = process.env.ARK_API_KEY;
  if (!key) throw new Error("llm_key_missing");
  const resp = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.ARK_LLM_MODEL || "doubao-seed-2-1-turbo-260628",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 512,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = body as { error?: { code?: string; message?: string } } | null;
    throw new Error(`llm_http_${resp.status}${err?.error?.code ? `: ${err.error.code}` : ""}`);
  }
  const text = (body as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> }> } })
    ?.choices?.[0]?.message?.content;
  const out = typeof text === "string" ? text : Array.isArray(text) ? text.map((p) => p.text || "").join("") : "";
  if (!out.trim()) throw new Error("llm_empty");
  return out.trim();
}

function mockChat(_system: string, user: string): string {
  // 确定性模拟：以【模拟扩写】开头，E2E 以此断言；不 sleep（测试要快）
  const seed = crypto.createHash("md5").update(user).digest("hex").slice(0, 4);
  return `【模拟扩写】${user}，写实摄影风格，柔光，深色背景，居中构图（种子 ${seed}）`;
}
```

### B2. `.env.example` 的 ARK 段追加一行

```bash
# Doubao chat model for prompt assistance (LLM 地基，Issue #7)
ARK_LLM_MODEL=doubao-seed-2-1-turbo-260628
```

### B3. 验收

```bash
npx tsc --noEmit
# mock 回落（当前无 LLM_PROVIDER）：
node -e "import('./src/lib/llm.ts')" 2>/dev/null || node --experimental-strip-types -e "
const { chat, llmProvider } = await import('./src/lib/llm.ts');
const r = await chat('你是助手', '一束白菊');
console.log(r.provider, r.text.slice(0, 24));"
# 预期：provider=mock，text 以【模拟扩写】开头
# 真实链路（可选，花费分币级）：临时 LLM_PROVIDER=ark 跑同命令，确认 doubao 模型名可用；
# 若返回 ModelNotOpen，换控制台已开通的对话模型名并更新默认值与 .env.example
```

**Commit**：`feat: 方舟 LLM 客户端地基（Issue #7）`

---

## 任务 C：祭品提示词助手（Issue #8）

**预计 3 小时 ｜ 新建 API + 迁移 + 前端 + E2E**

### C1. 迁移 `migrations/011_prompt_quota.sql`

```sql
CREATE TABLE IF NOT EXISTS prompt_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,                -- '2026-08-19'
  used INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
```

### C2. 新建 `src/app/api/items/prompt/route.ts`

处理顺序（逐条实现，任一不过即返回）：

1. `getSessionUser()` 无 → 401 `unauthorized`
2. body `{ idea }`：trim 后 slice(0,60)，长度 <2 → 400 `idea_required`
3. **输入审核**：`moderateText(idea)` 不通过 → 400 `content_blocked`
4. **限频**：`prompt_usage` 当日计数 ≥10 → 429 `quota_exceeded`；否则事务内 `used+1`（upsert）
5. **LLM**：`chat(system, idea, { maxTokens: 256, temperature: 0.8 })`，system 固定为：

```
你是祭品生图提示词专家。把用户的简短想法扩写为一条高质量中文生图提示词，要求：
写实静物摄影风格、庄重克制、适合纪念场合；只描写物品本身与光线构图，禁止出现人物、
文字、水印；长度不超过 120 字；直接输出提示词本身，不要任何解释或引号。
```

6. **输出审核**：`moderateText(result)` 不通过 → 400 `content_blocked`
7. `trackEvent("prompt_generated", { scene: "offering", provider, durationMs, ok: true }, user.id)`
8. 返回 `{ ok: true, prompt: result, provider }`
9. catch：`trackEvent(... ok: false, error)` + 502 `{ error: message }`（llm_* 错误码透传）

**env 检查**：`moderation.ts`、`events.ts` 的既有导出直接用；无需新 env。

### C3. 前端 `src/components/OfferPanel.tsx`

> 实施前先通读该文件 AI 生成区块（含 `quotaHint`/`loginToCustom` 的部分），把助手插在**生成输入框上方**，不动既有生成逻辑。

新增局部 state 与区块（要点）：

```tsx
const [idea, setIdea] = useState("");
const [expanded, setExpanded] = useState("");
const [busy, setBusy] = useState(false);
const [pErr, setPErr] = useState("");
// labels 来自 props 的 dict.prompt（见 C4），无则回退隐藏整个区块（向后兼容）

async function expand() {
  setBusy(true); setPErr("");
  const res = await fetch("/api/items/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) });
  const data = await res.json().catch(() => ({}));
  setBusy(false);
  if (!res.ok) { setPErr(labels["perr_" + data.error] || labels.perrGeneric); return; }
  setExpanded(data.prompt);
}
// 「用这个生成」：把 expanded 写入既有生成输入框的 value（通过该输入的受控 state 或 form ref）
```

UI：一行输入（placeholder=`labels.promptIdeaPlaceholder`）+「帮我写」按钮（busy 时 `labels.promptLoading`）+ 结果 textarea（受控可改，`labels.promptResultLabel`）+「用这个生成」按钮。仅 `loggedIn` 时渲染。

### C4. 词典（zh 的 `digitalHuman` section 之后新增独立 section；en 同步）

```ts
prompt: {
  title: "提示词助手",
  ideaPlaceholder: "想供奉什么？例：一束白菊",
  expand: "帮我写",
  loading: "扩写中…",
  resultLabel: "扩写结果（可修改后生成）",
  apply: "用这个生成",
  perr_idea_required: "请先填写想法",
  perr_content_blocked: "内容未通过审核，请换一种说法",
  perr_quota_exceeded: "今日 10 次已用完，明天再来",
  perrGeneric: "扩写失败，请重试",
},
```

en 版：`title:"Prompt assistant"` / `ideaPlaceholder:"What would you like to offer? e.g. white chrysanthemums"` / `expand:"Write for me"` / `loading:"Writing…"` / `resultLabel:"Result (editable before generating)"` / `apply:"Generate with this"` / `perr_idea_required:"Please describe your idea first"` / `perr_content_blocked:"Content blocked by moderation, please rephrase"` / `perr_quota_exceeded:"Daily limit of 10 reached, come back tomorrow"` / `perrGeneric:"Failed to expand, please retry"`。

页面传参：`memorial/[id]/page.tsx` 里给 OfferPanel 传 `promptLabels={dict.prompt}`（或并入现有 labels prop 结构，实施时以最小改动为准并保持 en/zh 对称）。

### C5. E2E `tests/e2e/prompt.spec.ts`

```ts
// 旅程：登录 → 打开公开纪念馆 → 帮我写（mock）→ 结果可编辑 → 填入生成框
import { expect, test } from "@playwright/test";
import { apiLogin, createMemorialViaApi, emailOf, patchMemorialViaApi, RUN } from "./helpers";

test("祭品提示词助手（mock LLM）", async ({ browser, page }) => {
  const owner = emailOf("promptowner");
  const ctx = await browser.newContext();
  await apiLogin(ctx.request, owner);
  const mid = await createMemorialViaApi(ctx.request, `${RUN}提示词馆`);
  await patchMemorialViaApi(ctx.request, mid, { visibility: "public" });
  await ctx.close();

  await apiLogin(page.context().request, emailOf("promptuser"));
  await page.goto(`/zh/memorial/${mid}`);
  await page.getByPlaceholder("想供奉什么？例：一束白菊").fill("一束白菊");
  await page.getByRole("button", { name: "帮我写" }).click();
  await expect(page.getByText("扩写结果（可修改后生成）")).toBeVisible({ timeout: 10_000 });
  // mock 输出以【模拟扩写】开头
  const result = page.locator("textarea").nth(1); // 结果框（实施时按实际 DOM 调定位）
  await expect(result).toHaveValue(/【模拟扩写】/, { timeout: 10_000 });
  await page.getByRole("button", { name: "用这个生成" }).click();
  // 断言生成输入框被填充
  await expect(page.locator("textarea").first()).toHaveValue(/【模拟扩写】|白菊/);
});
```

> 注：locator 序号以实施后的真实 DOM 为准调整；原则是断言「结果出现 + 应用后生成框有值」，**不点真生成**（避免花额度）。

### C6. 验收

```bash
npx tsc --noEmit
npm run smoke                                   # 3/3（migration 011 自动执行）
npx playwright test tests/e2e/prompt.spec.ts   # 通过
npx playwright test                             # 全量 40+1 不回归
```

**Commit**：`feat: 祭品提示词助手（Issue #8：API+限频+前端+E2E）`

---

## 任务 D：集成与发布 SOP（每次合并照单执行）

1. **前置检查**：`git branch --show-current` → 必须 `master`；`git status --short` → 必须干净
2. **取分支看差异**：`git fetch origin && git diff master...origin/feat/visual-polish --stat`
3. **评审**：diff 交 Opus-5（按其任务书 checklist），处理完所有「阻断」级意见
4. **合并**（顺序固定 visual → payment）：
   `git merge --no-ff origin/feat/visual-polish -m "merge: 前端工艺线（Kimi-K3）"`
   - 词典冲突解法：**双方键都保留**（union 合并），绝不删键
   - 其他冲突：以功能分支为准 rebase 到 master
5. **三重回归**：`npx tsc --noEmit && npm run smoke && npx playwright test`
6. **发布**（SSH 工具在 `_remote/`，凭据走 env RPASS）：
   `node _remote/run.mjs "cd /var/www/bian && nohup bash deploy/deploy.sh > /var/log/deploy.log 2>&1 & echo ok"`
   → 等 4 分钟 → `curl https://bianmuyuan.cn/api/health` 200 + 首页 200
7. **记录**：对应 Issue 评论 commit hash + 验收结果；任务完结则关单
8. **分支卫生**：合并完的功能分支保留（备查），下轮开发从新 master 重切

---

## 附：本细则未覆盖的边界情况处理原则

- 实施中发现任务书「边界」外必须改的文件：**停手**，记录到本文件末尾「发现上报」节，等用户/集成决策
- 方舟/审核 API 报未知错误码：先如实透传（snake_case），验收后补词典映射
- 任何一步 `npm run smoke` 失败：先修复再继续，禁止带红提交
