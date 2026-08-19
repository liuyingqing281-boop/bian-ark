# GLM5.3 · 主线与集成 任务书

> 角色：主线全栈开发 + 四方集成与发布唯一执行人 ｜ 分支：master
> 开工前必读：`docs/四模型分工/README.md`（协作总纲与通用约定）

## 一、任务清单

### 1. 数字人持久化任务 worker（Issue #2，P0）

**现状**：`src/lib/digitalhuman.ts` 的 `pollArkTask` 是进程内轮询，服务重启后任务永久卡在 processing，只能等 60 分钟 `tools/dh-worker.mjs` 超时置 failed。

**要求**：
- 扩展 `tools/dh-worker.mjs`：对 processing 且有真实 provider_job_id（非占位符）的任务，查询方舟任务状态（复用 `src/lib/ark.ts` 的 `arkGet`）
- succeeded → 下载转存（幂等：先查 result_video_url 已存在则跳过）→ 置 reviewing；failed → 置 failed + `refundRedoCredit`（逻辑已存在 lib，脚本内联同款 SQL）
- 与进程内轮询的幂等：下载与状态变更以数据库为唯一事实源，重复执行不产生重复结果/重复退额

**验收**：
- [ ] 手动制造 processing 任务 → 重启 dev 服务 → 跑 dh-worker → 任务到达终态
- [ ] 同一任务连跑两次 dh-worker，结果一致（无重复下载/退额）
- [ ] `npm run smoke` 3/3（p4 数字人链路不回归）

### 2. 数字人错误提示友好化（Issue #4，P1）

**要求**：
- `dictionaries.ts` 的 `digitalHuman` section 内追加映射键（**只加不改**）：`err_ark_key_missing`/`err_ark_http_404`（含 ModelNotOpen 语义）/`err_ark_timeout`/`err_ark_task_failed`/`err_ark_empty_video`
- `DigitalHumanPanel.tsx` 展示 `task.error` 时先查词典，命中显示人话（zh/en），未命中回退原文
- 服务端错误写入时归一化前缀（保持 `ark_*` 原样，映射在前端做）

**验收**：
- [ ] 未开通模型场景下，任务失败显示中文人话（可用现有 failed 任务验证）
- [ ] en 页面同样有映射

### 3. 方舟 LLM 地基（Issue #7，P0）

**要求**：
- 新建 `src/lib/llm.ts`：调方舟 `POST /api/v3/chat/completions`（模型 env `ARK_LLM_MODEL`，默认 `doubao-seed-1-6-flash-250828`，以控制台可开模型为准）
- 适配器惯例：无 `ARK_API_KEY` 时 mock 回落（返回结构化假文案，可测）；错误码 `llm_*` snake_case
- 入参：system prompt + user text；出参：string；超时 30s
- `moderationEnabled()` 时对输出过 `moderateText`（生成文本审核）

**验收**：
- [ ] 无 key：单元冒烟脚本返回 mock 文案
- [ ] 有 key：真实调用一次成功（费用分币级）

### 4. 祭品提示词助手（Issue #8，P0）

**要求**：
- 新 API `POST /api/items/prompt`：登录必须；入参 `{idea}`（≤60字）；走 LLM 扩写为 ≤120 字祭品生图提示词（system prompt 约束：写实静物、庄重、不出现人物）；过 moderation；`trackEvent("prompt_generated", {scene:"offering", durationMs})`；限频同用户 10 次/天（login_codes 式或内存表均可，但需持久）
- `OfferPanel.tsx` 生成入口旁加「帮我写」：输入想法 → 返回扩写 → 可编辑 → 一键填入生成框
- 词典：`prompt:` 新 section（zh/en 全量）

**验收**：
- [ ] E2E 新增断言：登录用户「帮我写」流程（mock LLM 即可）
- [ ] `npm run smoke` 回归无损

### 5. 集成与发布（持续职责）

- 合并顺序：feat/visual-polish → feat/payment → master 主线新提交
- 每次合并前：取 Opus-5 评审意见，处理完全部「阻断」级
- 合并后跑三重回归（tsc / smoke / E2E 双端 / 移动审计），全绿后服务器 `bash deploy/deploy.sh`，验证 `https://bianmuyuan.cn/api/health` 与关键页 200
- 冲突处理原则：词典冲突按「双方键都保留」；其余以功能分支 rebase 主线为主
- 发布后在对应 Issue 评论记录（含 commit hash 与验收结果）

## 二、边界

**可改**：`src/lib/digitalhuman.ts`、`src/lib/ark.ts`（扩展）、`src/lib/llm.ts`（新建）、`src/app/api/items/prompt/`（新建）、`src/app/api/digitalhumans/*`、`tools/dh-worker.mjs`、`tools/smoke-p4.mjs`、`tests/e2e/`（新增）、`dictionaries.ts`（仅 `prompt:` section 与 `digitalHuman.err_ark_*`）、`.env.example`（新变量）
**禁改**：支付相关（GPT 域）、纯视觉组件样式（Kimi 域）

## 三、时间盒建议

第 1 周：#2 → #4 → #7 → #8；集成动作随三分支就绪随时插入。
