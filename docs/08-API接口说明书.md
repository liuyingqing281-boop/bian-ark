# 彼岸 · API 接口说明书

> 依据：`prototype/index.html`（10 屏高保真原型）+《前端具体设计流程.md》逐屏拆解交互所得。
> 现状基准：Next.js App Router 路由层（`src/app/api/**/route.ts`）已实现并过冒烟的接口，本文如实标注「已实现 / 部分实现 / 待实现」。
> 通用约定：JSON 请求/响应；鉴权基于 Cookie 会话（`sessions` 表）；所有用户输入过 `moderateText` 审核；时间字段为 UTC ISO 串（前端做时区换算）；错误统一 `{ "error": "<code>" }`。
> 红线约束：接口/字段层面不出现虚拟币、充值、打榜、倒计时促销等任何设计；付费一律「一口价」订单。

---

## 一、交互 → 接口总览（按 10 屏拆解）

| 屏 | 页面 | 关键交互 | 依赖接口 |
|---|---|---|---|
| 01 | 纪念馆首页 | 浏览 TA 资料/照片；主 CTA「和 TA 说说话」；⋯ 菜单（分享/编辑/协作/举报）；时间线【+】；最近纪念流；免费三项供奉；灯亮状态 | `GET /api/memorials/[id]`、`GET /api/timeline`、`GET /api/hall/feed`、`POST /api/tribute`、`GET /api/items` |
| 02 | 想念页 | 类型单选（留言/悄悄话/悼文）；500 字计数；提交；「你留下的」列表 | `GET/POST /api/messages` |
| 03 | 身份说明页 | 纯声明页，按钮 = 确认边界（本地态即可）；埋点 | `POST /api/hall/chat`（进入后）；埋点 `events` |
| 04 | 对话页 | 发消息；TA 回复 + 依据链接 + 推测角标；快捷 chip；重试；「补充记忆」闭环；清空对话 | `POST /api/hall/chat`、`GET /api/hall/chat/history`（待实现）、`POST /api/memories`（source=chat） |
| 05 | 记忆档案页 | 5 分区浏览 + 总条数；点击编辑；左滑删除；底部固定添加 | `GET/POST /api/memories`、`PATCH/DELETE /api/memories/[id]` |
| 06 | 添加记忆抽屉 | 选分区 → 录入（≤500 字）→ 保存 → toast 回跳 | `POST /api/memories` |
| 07 | 祭奠页 | 免费三项直接供奉；付费三项弹确认；供桌/灯态展示；礼物入口 | `GET /api/items`、`POST /api/tribute` |
| 08 | 一口价确认弹窗 | 白名单元素展示；【供奉】→ 下单支付；【取消】 | `POST /api/stripe`（下单）、`POST /api/stripe/webhook`（回调）、`POST /api/tribute`（order_id 关联） |
| 09 | AI 生成纪念物 | 三步流；「帮我写」（每日限量）；「帮我准备」（幂等）；收藏/分享/再来一件；失败自动退费 | `POST /api/items/prompt`、`POST /api/items/generate`、`POST /api/items/claim` |
| 10 | 我的页 | 用户卡片（守护数/天数）；我的纪念（馆主/协作/纪念过）；订单流水；设置 | `GET /api/me`、`GET /api/me/memorials`、订单列表（待补查询接口） |

另：亲友共同纪念（分享链接/邀请码/协作）走 `groups` 族接口；发现页（园中园）走 `garden` 族接口。

---

## 二、鉴权与通用规则

- **会话**：`POST /api/auth/request-code` 发验证码 → `POST /api/auth/verify` 换会话 Cookie（`sessions` 表）；微信扫码走 `/api/auth/wechat/*`。未登录 = 访客态，只读公开内容。
- **角色**：`owner`（馆主）> `collaborator`（协作人，经 `groups`/`group_members`）> `member/visitor`（普通登录用户）> 游客。
- **可见性**：`memorials.visibility` + `canViewMemorial()` 服务端强制；悄悄话（`msg_type=private`）仅作者本人可读，越权返回空集而非 403（避免泄露存在性）——当前实现返回过滤后列表。
- **打码**：库内存原文，接口输出层统一打码 `首字 + **`（见 `/api/hall/feed` 的 `maskName`），任何列表不得返回完整真实姓名。
- **审核**：所有写接口先过 `moderateText`，不过返回 `422 content_rejected`；申诉走 `POST /api/moderation/appeals`。
- **限长**：留言/悄悄话/悼文 ≤ 500 字；记忆 ≤ 500 字；对话消息 ≤ 500 字（服务端截断）。

---

## 三、接口明细

### 3.1 纪念馆

#### `GET /api/memorials/[id]` ✅ 已实现
首页沉浸区 + 页面标题数据源。

**响应 200**
```json
{
  "id": "m_xxx",
  "name": "林守拙",
  "birth_date": "1940",
  "death_date": "2023",
  "epitaph": "想念从未离开",
  "biography": "……",
  "avatar_url": "…/portrait.png",
  "cover_url": "",
  "visibility": "public",
  "viewer_role": "owner | collaborator | member | guest",
  "candle_lit": true,
  "candle_lit_hours": 3
}
```
> 待确认①：`candle_lit`（你点的灯还亮着 · 已持续 N 小时）目前由 `tributes.is_burning` 推断，是否固化为接口字段。

**错误**：`404 not_found`（不存在或未发布/无权可见）。

#### `GET /api/memorials` ✅ / `POST /api/memorials` ✅ / `PATCH /api/memorials/[id]` ✅
建馆/编辑资料（馆主）。编辑资料对应 01 屏 ⋯ 菜单「编辑纪念馆资料」。字段同表结构（见《数据库设计》§2.1）。

---

### 3.2 生平时间线

#### `GET /api/timeline?memorial_id=` ✅ 已实现
01 屏「TA 的人生」列表。

**响应 200**：`{ "items": [{ "id", "year": "1965", "title": "结婚", "description": "", "media_url": "" }] }`（按 year 升序）。

#### `POST /api/timeline` ✅（馆主/协作人）
对应时间线【+】：`{ memorial_id, year, title, description? }` → `201 { id }`。

---

### 3.3 记忆档案（P0 核心）

分区枚举：`personality`（TA 是怎样的人）/ `relation`（我和 TA）/ `likes`（TA 喜欢什么）/ `speech`（TA 怎么说话）/ `profile`（基础资料）。

#### `GET /api/memories?memorial_id=` ✅ 已实现
**响应 200**
```json
{
  "total": 32,
  "sections": { "personality": ["温和、幽默……"], "relation": [], "likes": [], "speech": [], "profile": [] },
  "entries": [{ "id", "section", "content", "source": "manual|chat", "created_at" }]
}
```
权限：馆可见即可读。空分区返回空数组（前端渲染空状态文案）。

#### `POST /api/memories` ✅ 已实现
**请求**：`{ "memorial_id", "section", "content" (≤500), "source?": "chat" }`

权限规则（已实现）：
- 馆主/协作人：任意录入，`source` 记 `manual`；
- 普通登录用户：仅允许 `source=chat`（对话页「补充记忆」闭环）；
- 游客：`403 forbidden`。

**响应**：`201 { "id" }`；错误 `400 invalid_section / empty_content / content_too_long`，`422 content_rejected`。

#### `PATCH /api/memories/[id]` ✅ / `DELETE /api/memories/[id]` ✅
编辑/删除（仅馆主与协作人）；删除前端必经二次确认（赭红）。错误 `403 forbidden`、`404 not_found`。

---

### 3.4 留言 / 悄悄话 / 悼文

类型枚举：`public`（留言，进纪念流）/ `private`（悄悄话，🔒 仅本人）/ `eulogy`（悼文，馆内置顶）。

#### `GET /api/messages?memorial_id=` ✅ 已实现
服务端按可见性过滤后返回：**eulogy 置顶**，其余按时间倒序。
```json
{ "items": [{ "id", "msg_type": "public|private|eulogy", "content", "created_at" }] }
```
`private` 仅当 `user_id = 当前用户` 时出现。

#### `POST /api/messages` ✅ 已实现
**请求**：`{ "memorial_id", "msg_type", "content" (≤500) }`，需登录（`401 unauthorized`）。
**响应**：`201 { "id" }` → 前端 toast「已留下」+ 刷新列表。
> 待确认②：eulogy「置顶」目前是排序规则，是否需要 `is_pinned` 字段支持馆主手动置顶/取消。

---

### 3.5 混合纪念流

#### `GET /api/hall/feed?memorial_id=` ✅ 已实现
01 屏「最近的纪念」：tributes ∪ messages(public/eulogy) 合并、时间倒序、上限 50 条、发送人已打码。
```json
{
  "items": [{
    "kind": "tribute | message",
    "icon": "🌸",
    "label": "献上鲜花 | 留下思念 | 写下悼文",
    "senderMasked": "李**",
    "message": "",
    "isBurning": false,
    "createdAt": "2026-08-22T13:47:00Z"
  }]
}
```
> 待确认③：超过 5 条折叠「查看全部纪念」目前前端截断；若需要分页，是否加 `cursor` 参数（当前无分页）。

---

### 3.6 和 TA 说说话（AI 对话，P0）

#### `POST /api/hall/chat` ✅ 已实现（证据化改造完成）
**请求**：`{ "memorial_id", "message" (≤500) }`

**行为**：
1. 输入先过审核（`422 blocked`）；
2. System prompt 由 `memories` 5 分区装配，无记忆时回落生平/大事记（`lib/chat-prompt.ts`）；
3. 模型以 JSON 模式返回 `{ text, evidence_memory_id, ask_memory, followup_question }`；
4. 登录用户双端落库 `chat_messages`（user/ta 两条）；游客不持久化。

**响应 200**
```json
{
  "text": "如果是以前，爷爷大概会先问你有没有好好吃饭。",
  "evidence": { "memory_id": "…", "quote": "爷爷每次打电话都会问……", "created_at": "2026-08-12" } ,
  "inferred": true,
  "askMemory": false,
  "followupQuestion": null
}
```
- `evidence = null` 时前端**不显示**依据链接（禁止空链接）；
- `inferred` 恒为 true → 前端渲染「基于 TA 的资料推测」角标（不可关闭）；
- `askMemory = true` 时前端显示「添加一段关于 TA 的记忆」按钮 + `followupQuestion` 引导文案（如「爷爷什么时候开始喜欢钓鱼？」），点击后走 3.3 POST（`source=chat`），保存后 toast 回对话。

**错误**：`503 llm_unavailable`（前端显示「刚才没说上话，再试一次」+【重试】）；`422 blocked`（敏感内容 → 「这个话题我们轻轻带过」）。

#### `GET /api/hall/chat/history?memorial_id=` 🟡 待实现
04 屏刷新不丢对话历史（G4，P1）。表已建（`chat_messages`），查询接口未开。
**拟定响应**：`{ "items": [{ "role": "user|ta", "content", "evidence_memory_id": null, "created_at" }] }`，仅本人可见，游客恒空。
> 待确认④：历史保留策略（全量 or 近 90 天？）与是否提供「清空对话」接口（04 屏 ⋯ 菜单有「清空对话」）。

---

### 3.7 祭奠与一口价

#### `GET /api/items?memorial_id=` ✅ 已实现
07 屏宫格数据源。返回官方祭品目录 + 该馆已收藏的生成物：
```json
{ "items": [{ "id", "name": "献花", "icon", "image_url", "price_cents": 0, "is_premium": 0, "sort_order" }] }
```
前端规则：`price_cents = 0` → 「免费」角标；否则直接标 `¥X`（点击前可见，不做隐藏定价）。

#### `POST /api/tribute` ✅ 已实现（含 order_id 校验）
**请求**：`{ "memorial_id", "item_id", "message?": "", "sender_name?": "匿名→访客", "order_id?": null }`

规则：
- 免费项（`price_cents=0`）：直接落库 `tributes`；`item_id` 为「点灯」类时置 `is_burning=1`（24 小时自然熄灭由查询层按时间窗判断）；
- 付费项：必须携带 `order_id`，且订单 `status='paid'` 且归属当前用户，否则 `402 payment_required`（hall-check C1–C3 已覆盖）。

**响应**：`201 { "id" }` → 前端供桌/纪念流即时刷新 + ≤1.2s 温和动效。

#### `POST /api/stripe` ✅ / `POST /api/stripe/webhook` ✅
08 屏【供奉】→ 创建 Checkout Session（一口价 `price_cents`，无订阅/无自动续费）→ webhook 置 `orders.status='paid'` → 前端回调后调 3.7 tribute 落库。
> 待确认⑤：真实 Stripe 下单→回调→tribute 全链路目前仅 mock 冒烟，未做端到端验证（联调记录已知待办 #2）。

---

### 3.8 AI 生成纪念物（实验，P1）

#### `POST /api/items/prompt` ✅ 已实现（每日限量）
09 屏第 2 步【帮我写】：`{ "memorial_id", "wish": "想送 TA 一套特别的茶具" }` → `200 { "prompt": "粗陶质地、暖柚木托盘……" }`。
限量：`prompt_quota` 表按用户/日计数，超量 `429 quota_exceeded`（前端「明天再来」）。

#### `POST /api/items/generate` ✅ 已实现（幂等）
【帮我准备】：`{ "memorial_id", "prompt", "idempotency_key", "order_id" }`（一口价 ¥19 前置下单）。
- `UNIQUE(user_id, idempotency_key)` 防重复扣费；
- 异步：返回 `202 { "job_id" }`，生成中可离开，完成后站内通知；轮询 `GET /api/items/generate?job_id=`；
- 失败 → 自动退费 + 状态 `failed`（前端「没有准备好，已退款」）。

#### `POST /api/items/claim` ✅ 已实现
【收藏到纪念馆】：`{ "job_id", "memorial_id" }` → 生成物入 `items`（`review_status='pending'`，审核通过前仅本人可见）→ 供桌/宫格可见。

---

### 3.9 我的

#### `GET /api/me` ✅ 已实现
用户卡片：`{ "id", "nameMasked": "林**", "avatar_initial": "林", "created_at" }`。
> 待确认⑥：「已守护 1 座纪念馆 · 128 天」的统计口径（守护=馆主+协作？天数自注册起？）需固化进接口。

#### `GET /api/me/memorials` ✅ 已实现
「我的纪念」聚合（创建 / 协作 / 供奉过，去重，倒序）：
```json
{ "items": [{ "memorial_id", "name", "avatar_url", "relation": "owner|collaborator|visited",
             "memory_count": 32, "candle_lit": true, "last_active_at": "" }] }
```

#### 订单记录 🟡 部分实现
`orders` 表已有，面向 C 端的 `GET /api/me/orders` 查询接口未单独开。
**拟定响应**：`{ "items": [{ "id", "kind", "amount_cents", "currency": "cny", "status", "item_name", "created_at" }] }`，一口价流水，可查每笔。
> 待确认⑦：是否需要退款单在订单列表中显性展示（礼物生成失败自动退费场景）。

---

### 3.10 亲友共同纪念（P1，已实现）

| 接口 | 说明 |
|---|---|
| `POST /api/groups` | 创建协作组并绑定纪念馆 |
| `POST /api/groups/join` | 凭邀请码加入（亲友打开分享链接） |
| `POST /api/groups/[id]/rotate-invite` | 馆主更换邀请链接（旧码失效） |
| `GET /api/groups/[id]` | 成员列表（打码展示） |
| `POST /api/groups/[id]/leave` / `DELETE /api/groups/[id]/members/[uid]` | 退出/移除成员 |
| `POST /api/groups/[id]/transfer` | 转让馆主 |

权限语义：访客 = 看公开内容 + 留言/献花；协作人 = 可编辑记忆档案；不可看他人悄悄话、不可编辑资料（服务端强制，已有越权负例冒烟）。

---

### 3.11 其他已实现接口（不动）

`auth/*`（验证码/微信/绑定/登出）、`media` / `upload`（照片上传）、`garden`（发现页园中园）、`digitalhumans/*`（暂缓，不接新界面）、`admin`、`moderation/appeals`、`health`。

---

## 四、埋点（events 表，随接口打点）

| 埋点 key | 触发接口/动作 |
|---|---|
| `hall_chat_entry` | 主 CTA / 身份说明页确认（前端上报） |
| `hall_chat_reply` | `/api/hall/chat` 成功回复（已打） |
| `hall_chat_first_round` | 首轮对话完成（前端上报） |
| `memory_created_from_chat` | `POST /api/memories` 且 `source=chat` |
| `tribute_created` / `tribute_paid` | 免费/付费供奉 |
| `gift_funnel` | prompt → generate → claim → share 各步 |
| `retention_7d / 30d` | 离线任务基于会话与访问日志计算 |

---

## 五、待用户确认清单（接口层）

| # | 问题 | 建议默认值 |
|---|---|---|
| ① | `candle_lit`/`candle_lit_hours` 是否固化为 memorial 详情字段 | 固化，由 `tributes.is_burning + created_at` 24h 窗口推断 |
| ② | 悼文置顶是否需要馆主可操作的 `is_pinned` | V1 只用排序规则，不加字段 |
| ③ | feed 是否需要 cursor 分页 | V1 固定 50 条，前端折叠 |
| ④ | 对话历史保留策略与「清空对话」接口 | 保留全量本人历史；加 `DELETE /api/hall/chat/history` |
| ⑤ | Stripe 真实链路端到端验证排期 | 列 P1 收尾项 |
| ⑥ | 「守护 N 馆 · X 天」统计口径 | 守护=馆主+协作去重；天数自最早建馆起 |
| ⑦ | 退款单是否显性展示在订单列表 | 展示，`status='refunded'` 单独样式 |
