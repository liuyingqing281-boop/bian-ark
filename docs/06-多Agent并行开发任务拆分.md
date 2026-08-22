# 多 Agent 并行开发任务拆分（4 路）

> 上游文档：`docs/05-前后端对接改造方案.md`（差距分析与完整改动清单）、`docs/前端具体设计流程.md`（界面规范与文案红线）。
> 基准界面：`prototype/index.html`（单屏互动原型，见 `docs/10-单屏互动原型改造方案.md`）、`prototype/pc.html`。
> 本文是 4 个 Agent 的唯一任务书：各自只动自己名下的文件，按 §三契约对齐，完成后按 §四合并。

---

## 一、共享背景（每个 Agent 开工前必读）

1. 项目：Next.js 16 + React 19 + Tailwind 4 + better-sqlite3，工作区 `E:\彼岸`。
2. 多语言路由：`src/app/[lang]/`（lang = zh/en）；`src/proxy.ts` 会把无语言前缀的路径重定向到 `/{lang}`（`/api/*` 与 `/prototype` 除外）。**页面一律放 `[lang]` 下**。
3. 相对路径深度陷阱：`src/app/api/<a>/<b>/route.ts` 引用 lib 要写 `../../../../lib/xxx`（4 层）；`src/app/[lang]/<a>/[id]/page.tsx` 同理 4 层。写错会直接 500。
4. 数据库：`data/bian.db`；迁移走 `tools/db-migrate.mjs`（`node tools/db-migrate.mjs up/status/verify`），**新表只能新增 migration 文件，禁止手改 db、禁止改既有 migration**。
5. 审核：所有用户文本入库前过 `lib/moderation.ts` 的 `moderateText`；权限用 `lib/permissions.ts`。
6. LLM：`lib/llm.ts` 的 `chat(system, user, opts)`，ark 在线 / 无 key 自动 mock；**不要在 route 里用全局 fetch 调外部 LLM（Next dev 会滞塞），必须走 lib/llm**。
7. 文案红线：禁止「AI 聊天/数字人/复活逝者」字样；推测回答必须可标注「基于 TA 的资料推测」；禁止虚拟币/充值/打榜。
8. 昵称打码在展示层做；`sender_name` 库内存原文。
9. 验证：dev 服务器 `npm run dev`（固定 7300 端口）；每个交付必须附 `tools/` 下可复跑的冒烟脚本，且跑通才算完成。
10. **禁止改动对方名下文件**；需要新共享工具函数时，在自己目录内新建，合并时由我归并。

## 二、四路任务划分

### 任务 A → GLM 5.3：数据层（记忆 + 留言消息）

**目标**：产出两张新表的 migration + 两组 REST 接口。

**文件所有权**
- `tools/migrations/`（或既有 migration 目录）新增：`xxxx_memories.sql`、`xxxx_messages.sql`（表结构严格按 `docs/05` §三 T1/T2）
- `src/app/api/memories/route.ts`、`src/app/api/memories/[id]/route.ts`（新建目录）
- `src/app/api/messages/route.ts`（新建目录）
- `src/lib/memories.ts`、`src/lib/messages.ts`（数据访问函数）
- `tools/check-memories.mjs`、`tools/check-messages.mjs`（冒烟脚本）

**要求**
- memories：GET 按分区分组返回 + 总数；POST 支持 `source=chat`（对话闭环，普通登录用户可写）；PATCH/DELETE 仅馆主/协作人。
- messages：msg_type 三值；GET 时服务端强制可见性（private 仅本人；eulogy 置顶）；POST 需登录 + moderateText。
- 越权负例必须写进冒烟脚本（游客读 private → 403/空；非协作人 PATCH → 403）。
- 不碰：`/api/hall/*`、`tributes`、任何前端页面。

**完成定义**：`db-migrate up` 后 verify 通过；两个冒烟脚本全绿（含负例）。

### 任务 B → ChatGPT-5.6sol：对话证据化

**目标**：`/api/hall/chat` 升级为「记忆装配 + 依据引用 + 补充记忆闭环」。

**文件所有权**
- `src/app/api/hall/chat/route.ts`（重写）
- `src/lib/chat-prompt.ts`（新建：system prompt 装配）
- migration 新增：`xxxx_chat_messages.sql`（按 `docs/05` §三 T3，与 A 的迁移文件不重叠）
- `tools/check-chat.mjs`

**要求**
- prompt 从 `memories` 表按分区装配（**通过 §三契约的内存数据结构注入，不直接 import A 的 lib**——为并行安全，B 自己写一段只读 SQL 查询 memories 表）；无记忆时回落生平/墓志铭/大事记。
- 让模型以 JSON 返回 `{ "text", "evidence_memory_id" | null, "ask_memory": bool, "followup_question" | null }`；解析失败回落纯文本。
- 接口返回：`{ text, evidence: {memory_id, quote, created_at} | null, inferred: true, askMemory: bool, followupQuestion }`。无依据时 `evidence` 必须为 null（禁止空链接）。
- 登录用户落库 `chat_messages`；游客只返回不落库。
- 保留既有红线 system 约束（不是本人/推测语气/不知道就承认）。
- 不碰：前端组件、memories/messages 接口。

**完成定义**：冒烟覆盖 4 例——有记忆可引用（evidence 非空）、无资料问题（askMemory=true 且不编造）、敏感词（422）、游客调用。

### 任务 C → opus-5：前端三页 + hall 升级

**目标**：按原型实现想念页、记忆档案页，并升级 hall 页与对话面板。

**文件所有权**
- `src/app/[lang]/miss/page.tsx`（新建，02 想念页）
- `src/app/[lang]/memory/[id]/page.tsx`（新建，05 记忆档案页）
- `src/app/[lang]/hall/[id]/page.tsx`（改造，对齐 01 首页：锚点 Tab / 混合流 / 空状态引导）
- `src/components/hall/*`（HallChat 升级接 evidence/askMemory；HallOffer 微调；新增 MissComposer、MemoryArchive、FeedList 等）
- `src/app/hall-dark.css` 或组件内联样式（暗红熔岩 token 沿用既有 hall 页的色值，参考 `prototype/shared/ui.css`）

**对接契约（§三）先行**：A/B 接口未完成时，前端用 `NEXT_PUBLIC_MOCK_API=1` 或页面内 mock 数据兜底，保证页面可独立验收视觉与交互。

**要求**
- 想念页：类型单选（留言默认/悄悄话🔒/悼文）、500 字计数、空内容置灰、提交 toast「已留下」。
- 记忆档案页：5 分区 + 计数 + 底部固定「＋ 添加记忆」抽屉（选分区→录入→保存→toast）。
- HallChat：依据链接仅在 `evidence` 非空时显示，点击开弹层（quote + 添加日期）；`askMemory` 时显示「添加一段关于 TA 的记忆」→ 抽屉 → POST 契约接口 → toast 回对话。
- 全部暗红熔岩风格；文案过红线表。
- 不碰：任何 API route、migration、proxy.ts。

**完成定义**：`tools/check-pages.mjs`（自建）验证 3 个页面 200 且关键元素存在；mock 模式下交互可走通。

### 任务 D → kimi k3：供奉/feed 链路 + 总回归

**目标**：混合纪念流接口 + 一口价链路串接 + 全量回归脚本。

**文件所有权**
- `src/app/api/hall/feed/route.ts`（新建，G6 混合流：tributes ∪ public/eulogy messages 统一结构，sender 打码）
- `src/app/api/tribute/route.ts`（**最小改动**：仅增加可选 `order_id` 关联，默认行为不变）
- `tools/hall-check.mjs`（扩展为总回归：页面 + chat + tribute + feed）
- `docs/07-联调记录.md`（新建：合并后记录各接口实际返回样例）

**要求**
- feed 条目：`{kind: 'tribute'|'message', icon, label, senderMasked, message, isBurning, createdAt}`；打码规则「李**」。
- tribute 的 `order_id`：仅在 `items.is_premium=1` 时校验订单存在且已支付；免费项路径一行不改。
- 依赖 A 的 messages 表：D 通过 SQL 直读（契约同 §三），不 import A 的 lib。
- 不碰：前端页面、memories/messages/chat 接口实现。

**完成定义**：总回归脚本覆盖 hall 页 8 项 + feed 混合 + 免费供奉 + （mock 订单）付费供奉。

## 三、接口契约（四方共同遵守，开工即冻结）

```
GET  /api/memories?memorial_id=
  → { total, sections: { personality: string[], relation: string[], likes: string[], speech: string[], profile: string[] } }
POST /api/memories        { memorial_id, section, content, source? }      → { id }
PATCH/DELETE /api/memories/:id                                           → { ok }

GET  /api/messages?memorial_id=   → { items: [{ id, msg_type, content, created_at }] }   // 已按可见性过滤
POST /api/messages  { memorial_id, msg_type, content }                   → { id }

POST /api/hall/chat  { memorial_id, message }
  → { text, evidence: { memory_id, quote, created_at } | null, inferred: true,
      askMemory: boolean, followupQuestion: string | null }

GET  /api/hall/feed?memorial_id=
  → { items: [{ kind, icon, label, senderMasked, message, isBurning, createdAt }] }

POST /api/tribute  (formData: memorial_id, item_id, lang, is_burning?, order_id?) → 302 回来源页
```

表结构以 `docs/05-前后端对接改造方案.md` §三 为准；契约字段只增不减。

## 四、合并方案

1. **分支**：每路从 `master` 切 `feat/agent-a-data` / `feat/agent-b-chat` / `feat/agent-c-pages` / `feat/agent-d-feed`。四方文件零重叠（见所有权表）；唯一共享区是 migration 目录——各人新增独立文件名，禁止改别人的。
2. **并行期对齐**：C 用 mock 兜底开发；B/D 用 SQL 直读新表（表结构已冻结在 docs/05）。任何人发现契约不够用，**先改本文档 §三再动手**。
3. **合并顺序**（每步合并后跑该路冒烟 + 之前所有路的冒烟，全绿再合下一路）：
   - ① A（数据层）→ 跑 check-memories / check-messages
   - ② B（对话）→ 跑 check-chat
   - ③ D（feed/tribute）→ 跑 hall-check 总回归
   - ④ C（页面，最后合，此时把 mock 切换为真实接口）→ 跑 check-pages + 总回归
4. **冲突处理**：预期零冲突；若 `package.json`/锁文件被某路改动，以 master 为准手工合并；`AGENTS.md`、`next-env.d.ts` 的自动生成改动一律丢弃不提交。
5. **收尾**：我（主会话）做最终联调：四路冒烟连跑、`docs/07-联调记录.md` 补齐真实返回样例、统一提交并更新《前端具体设计流程》进度。

## 五、交付物清单（每路必须）

1. 名下代码文件 + migration（A/B）
2. 可复跑冒烟脚本且全绿
3. 一段 ≤200 字的交付说明：动了哪些文件、契约有无偏差、已知限制
