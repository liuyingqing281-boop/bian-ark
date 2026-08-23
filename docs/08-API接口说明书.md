# 彼岸 · API 接口说明书（前后端分离版）

> 依据：`prototype/index.html`（单屏互动原型，11 屏 → 9 视图 + 4 浮层，见《10-单屏互动原型改造方案》；屏01 登录注册屏见《前端具体设计流程.md》§2.0）+《前端具体设计流程.md》逐屏拆解；与《09-数据库设计》配套：09 上篇定义的视图模型（F1–F6）即本文的响应体契约。
> 分界原则：**前端只消费视图模型（camelCase、已打码、已换算权限）**；snake_case 物理字段、SQL、表关系属于后端装配层（见 09 下篇 B0 装配表），接口文档中仅在后端实现注记中出现。
> 现状标注：✅ 已实现并过冒烟｜🟡 部分实现/待开接口｜❌ 未做。响应示例按目标契约书写；已实现接口若当前返回 snake_case，由适配层统一转 camelCase（见 §八适配说明）。
> 通用约定：JSON；Cookie 会话鉴权；所有用户输入过 `moderateText`；时间一律 UTC ISO 串下发（前端换算时区/相对时间）；错误统一 `{ "error": "<code>" }`。
> 红线：接口与字段层面不出现虚拟币/充值/礼包/打榜/倒计时促销；付费一律一口价订单。

---

## 一、交互 → 接口总览（按 11 屏拆解）

| 屏 | 页面 | 关键交互 | 依赖接口 | 视图模型 |
|---|---|---|---|---|
| 01 | 登录注册屏（第一屏） | 通道切换（手机/邮箱）；获取验证码（60s 倒计时）；验证码校验（登录即注册）；微信扫码；「先看看」访客态 | `POST /api/auth/request-code`、`POST /api/auth/verify`、`POST /api/auth/logout`、`GET /api/auth/wechat/qrcode`🟡、回调 `GET /api/auth/wechat/callback`🟡、`GET /api/me`（启动判登录态） | —（无馆数据，§3.0） |
| 02 | 纪念馆首页 | TA 资料/照片；主 CTA；⋯ 菜单（分享/编辑/协作/举报）；时间线【+】；最近纪念流；免费三项供奉；灯亮状态 | `GET /api/memorials/[id]`、`GET /api/timeline`、`GET /api/hall/feed`、`GET /api/items`、`POST /api/tribute` | F1 / F2 / F3 / F6 |
| 03 | 想念页 | 类型单选（留言/悄悄话/悼文）；500 字计数；提交；「你留下的」 | `GET/POST /api/messages` | F3 同源 |
| 04 | 身份说明页 | 纯声明页，按钮=确认边界（前端本地态）+ 埋点 | 无数据接口 | — |
| 05 | 对话页 | 发消息；依据链接；推测角标；快捷 chip；重试；补充记忆闭环；清空对话 | `POST /api/hall/chat`、`GET/DELETE /api/hall/chat/history`🟡、`POST /api/memories`(source=chat) | F5 / F4 |
| 06 | 记忆档案页 | 5 分区 + 总条数；编辑；左滑删除 | `GET/POST /api/memories`、`PATCH/DELETE /api/memories/[id]` | F4 |
| 07 | 添加记忆抽屉 | 选分区→录入→保存→toast 回跳 | `POST /api/memories` | F4 |
| 08 | 祭奠页 | 免费三项直接供奉；付费三项弹确认；供桌灯态 | `GET /api/items`、`POST /api/tribute` | F6 |
| 09 | 一口价确认弹窗 | 白名单元素展示；【供奉】→下单支付；【取消】 | `POST /api/stripe`、webhook、`POST /api/tribute`(orderId) | F6 |
| 10 | AI 生成纪念物 | 三步流；帮我写（限量）；帮我准备（幂等）；收藏/分享/再来一件；失败退费 | `POST /api/items/prompt`、`POST /api/items/generate`、`GET /api/items/generate?jobId=`、`POST /api/items/claim` | F6 GiftJobView |
| 11 | 我的页 | 用户卡片；我的纪念；订单流水；设置 | `GET /api/me`、`GET /api/me/memorials`、`GET /api/me/orders`🟡 | F1/F6 |

亲友共同纪念走 `groups` 族（§3.10）；发现页走 `garden` 族（§3.11）。

---

## 二、鉴权与通用规则

- **会话**：`POST /api/auth/request-code` → `POST /api/auth/verify` 换 Cookie 会话；微信扫码 `/api/auth/wechat/*`。未登录 = 访客态，只读公开内容。
- **角色**：`owner > collaborator > member > guest`。前端不自行推断权限，一律读视图模型中的 `viewerRole`（由后端 `lib/permissions.ts` 装配）。
- **可见性**：服务端强制；悄悄话越权返回过滤后列表而非 403（不泄露存在性）。
- **打码**：只在后端输出层做（`maskName`），前端直接渲染 `senderMasked`/`nameMasked`，任何接口不返回完整真实姓名。
- **审核**：写接口先过审核，不过 `422 content_rejected`；申诉 `POST /api/moderation/appeals`。
- **限长**：留言/悄悄话/悼文/记忆/对话消息 ≤ 500 字（服务端截断或拒绝）。
- **错误码总表**：`400 bad_request/invalid_json/missing_*`、`401 unauthorized`、`402 payment_required`、`403 forbidden`、`404 not_found`、`422 content_rejected/blocked`、`429 quota_exceeded`、`503 llm_unavailable`。

---

## 三、接口明细

### 3.0 认证（屏01 登录注册屏，登录即注册）

#### `POST /api/auth/request-code` ✅
**请求**：`{ "channel": "sms" | "email", "target": "1xxxxxxxxxx 或邮箱" }`
- 手机号正则 `^1\d{10}$`、邮箱标准格式，不符 `400 invalid_phone / invalid_email`。
- 限频：同通道同目标 60s 内重发 `429 too_frequent`；同 IP 日上限（默认 100，`AUTH_IP_DAILY_LIMIT` 可配）`429 rate_limited`。
- 验证码 6 位数字，10 分钟有效；新码生成即作废旧码。

**响应 200**：`{ "ok": true, "delivered": true, "devCode?": "123456" }`
> `devCode` 仅非生产环境且未接真实短信/邮件网关时返回，原型用它自动回填，生产绝不下发。

#### `POST /api/auth/verify` ✅
**请求**：`{ "channel", "target", "code": "6 位", "name?": "" }`
- 全角数字自动归一；错 5 次锁 15 分钟（`429 too_many_attempts`）；过期/不符 `400 invalid_code`。
- 校验通过 → 查 `users` 按 email/phone 找账号，**无则自动建号（登录即注册）** → 写 Cookie 会话 → 埋点 `login`。

**响应 200**：`{ "ok": true }` → 前端进「纪念馆首页」。

#### `POST /api/auth/logout` ✅
销毁会话 Cookie → `200 { "ok": true }`（我的页「设置 → 退出登录」用）。

#### 微信扫码 🟡
`GET /api/auth/wechat/qrcode` → `{ "qrcodeUrl", "ticket" }` → 前端弹层展示二维码，轮询 `GET /api/auth/wechat/callback?ticket=` 换会话。依赖微信开放平台配置（`WECHAT_*` 环境变量），原型态为占位按钮。

#### `GET /api/me` ✅
启动判登录态：`200 { "user": { "id", "name", "email", "phone" } }`；未登录 `401`——原型据此决定第一屏落「登录注册屏」还是直达「纪念馆首页」。

---

### 3.1 纪念馆（F1 MemorialView）

#### `GET /api/memorials/[id]` ✅
首页沉浸区 + 对话页顶栏数据源。
**响应 200**
```json
{
  "id": "m_xxx",
  "name": "林守拙",
  "appellation": "爷爷",
  "birthDate": "1940",
  "deathDate": "2023",
  "epitaph": "想念从未离开",
  "biography": "……",
  "avatarUrl": "…/portrait.png",
  "coverUrl": "",
  "viewerRole": "owner",
  "candleLit": true,
  "candleLitHours": 3
}
```
- `appellation` 空串时前端回落「TA」（依赖迁移 M1，待确认⑧）。
- `candleLit/candleLitHours` 由后端按点灯记录 24h 窗口装配（待确认①）。
- `404 not_found`：不存在/未发布/无权可见。

#### `GET/POST /api/memorials`、`PATCH /api/memorials/[id]` ✅
建馆/编辑资料（馆主）。写接口请求体同名字段（snake/camel 由适配层统一，见 §八）。

---

### 3.2 生平时间线（F2 TimelineItem）

#### `GET /api/timeline?memorialId=` ✅
```json
{ "items": [{ "id", "year": "1965", "title": "结婚", "description": "", "imageUrl": null }] }
```
升序。空数组 → 前端空状态 + 引导按钮。

#### `POST /api/timeline` ✅（馆主/协作人）
`{ "memorialId", "year", "title", "description?", "mediaId?" }` → `201 { "id" }`。
> `mediaId`（图文卡片配图）依赖待确认⑨，V1 可省。

---

### 3.3 记忆档案（F4 MemoryArchiveView，P0 核心）

分区枚举：`personality / relation / likes / speech / profile`。

#### `GET /api/memories?memorialId=` ✅
```json
{
  "total": 32,
  "sections": {
    "personality": [{ "id", "section": "personality", "content": "温和、幽默……", "source": "manual", "createdAt": "…" }],
    "relation": [], "likes": [], "speech": [], "profile": []
  }
}
```
- 契约变更：09 上篇 F4 要求**按分组成对象数组**（带 id 供编辑/删除）。当前实现返回 `sections: Record<string, string[]>` + 平铺 `entries[]`，适配层需重组为 F4 结构（契约只增不减，旧字段保留至前端迁移完成）。
- 权限：馆可见即可读；空分区恒返回 `[]`。

#### `POST /api/memories` ✅
**请求**：`{ "memorialId", "section", "content" (≤500), "source?": "chat" }`

权限（已实现）：馆主/协作人任意录入（`source=manual`）；普通登录用户仅允许 `source=chat`（对话补充记忆闭环）；游客 `403`。
**响应**：`201 { "id" }`；错误 `400 invalid_section / empty_content / content_too_long`、`422 content_rejected`。

#### `PATCH/DELETE /api/memories/[id]` ✅
仅馆主与协作人；删除前端必经二次确认。`403 forbidden` / `404 not_found`。

---

### 3.4 留言 / 悄悄话 / 悼文

类型：`public`（进纪念流）/ `private`（🔒仅本人）/ `eulogy`（置顶）。

#### `GET /api/messages?memorialId=` ✅
```json
{ "items": [{ "id", "msgType": "public", "content", "senderMasked": "李**", "isMine": false, "createdAt": "…" }] }
```
eulogy 置顶、其余倒序；`private` 仅作者本人出现（`isMine=true` 供「我」标识）。
> 契约增量：当前响应无 `senderMasked/isMine`，适配层补齐（打码后端做）。

#### `POST /api/messages` ✅
`{ "memorialId", "msgType", "content" (≤500) }`，需登录（`401`）→ `201 { "id" }` → toast「已留下」。
> 待确认②：悼文置顶 V1 只用排序规则，不加 `isPinned`。

---

### 3.5 混合纪念流（F3 FeedItem）

#### `GET /api/hall/feed?memorialId=` ✅
```json
{
  "items": [{
    "kind": "tribute",
    "icon": "🌸",
    "label": "献上鲜花",
    "senderMasked": "李**",
    "message": "",
    "isMine": false,
    "isBurning": false,
    "createdAt": "2026-08-22T13:47:00Z"
  }]
}
```
tributes ∪ messages(public/eulogy) 合并、倒序、上限 50、发送人打码。
> 待确认③：分页——V1 固定 50 条，前端超 5 条折叠「查看全部纪念」，不加 cursor。

---

### 3.6 和 TA 说说话（F5 ChatReply，P0）

#### `POST /api/hall/chat` ✅（证据化已完成）
**请求**：`{ "memorialId", "message" (≤500) }`

**响应 200**
```json
{
  "text": "如果是以前，爷爷大概会先问你有没有好好吃饭。",
  "evidence": { "memoryId": "…", "quote": "爷爷每次打电话都会问……", "createdAt": "2026-08-12" },
  "inferred": true,
  "askMemory": false,
  "followupQuestion": null
}
```
- `evidence=null` → 前端不渲染依据链接（禁止空链接）。
- `inferred` 恒 true → 「基于 TA 的资料推测」角标，不可关闭。
- `askMemory=true` → 渲染「添加一段关于 TA 的记忆」+ `followupQuestion` 引导；保存走 3.3 POST（`source=chat`）后 toast 回对话。
- 登录用户落库对话历史；游客不持久化。

**错误**：`503 llm_unavailable`（「刚才没说上话，再试一次」+【重试】）；`422 blocked`（「这个话题我们轻轻带过」）。

#### `GET /api/hall/chat/history?memorialId=` 🟡 待开
```json
{ "items": [{ "role": "user|ta", "content", "evidenceMemoryId": null, "createdAt": "…" }] }
```
仅本人可见，游客恒空。

#### `DELETE /api/hall/chat/history?memorialId=` 🟡 待开
04 屏 ⋯ 菜单「清空对话」，删除本人该馆历史 → `204`。
> 待确认④：历史保留策略（建议本人全量）与此接口一并排期。

---

### 3.7 祭奠与一口价（F6 ItemView）

#### `GET /api/items?memorialId=` ✅
```json
{ "items": [{ "id", "name": "献花", "imageUrl": "…", "priceCents": 0, "isPremium": false, "sortOrder": 1 }] }
```
`priceCents=0` → 前端「免费」角标；`>0` → 直接标 ¥X（点击前可见，不隐藏定价）。

#### `POST /api/tribute` ✅
**请求**：`{ "memorialId", "itemId", "message?": "", "senderName?": "", "orderId?": null }`
- 免费项直接供奉；点灯类置燃烧态（24h 自然熄灭）。
- 付费项必须带 `orderId` 且订单已支付且属本人，否则 `402 payment_required`。

**响应**：`201 { "id" }` → 供桌/纪念流即时刷新 + ≤1.2s 温和动效。

#### `POST /api/stripe` ✅ / webhook ✅
【供奉】→ 创建 Checkout Session（一口价，无订阅/无自动续费）→ webhook 置订单 paid → 前端回调后调 tribute 落库。
> 待确认⑤：真实链路端到端验证（当前仅 mock 冒烟）。

---

### 3.8 AI 生成纪念物（F6 GiftJobView，P1 实验）

#### `POST /api/items/prompt` ✅（每日限量）
`{ "memorialId", "wish": "想送 TA 一套特别的茶具" }` → `200 { "prompt": "粗陶质地、暖柚木托盘……" }`；超量 `429 quota_exceeded`（前端「明天再来」）。

#### `POST /api/items/generate` ✅（幂等）
`{ "memorialId", "prompt", "idempotencyKey", "orderId" }` → `202 { "jobId" }`。
生成中可离开，完成后站内通知；轮询：
#### `GET /api/items/generate?jobId=` ✅
```json
{ "jobId", "status": "running", "imageUrl": null, "promptUsed": "粗陶质地……" }
```
失败 → 自动退费 + `status=failed`（前端「没有准备好，已退款」）。

#### `POST /api/items/claim` ✅
`{ "jobId", "memorialId" }` → 收藏到纪念馆；审核通过前仅本人可见（前端无需处理，列表接口已过滤）。

---

### 3.9 我的（F1/F6）

#### `GET /api/me` ✅
```json
{ "id", "nameMasked": "林**", "avatarInitial": "林", "memorialCount": 1, "guardDays": 128, "createdAt": "…" }
```
> 待确认⑥：`memorialCount/guardDays` 口径（建议守护=馆主+协作去重，自最早建馆起）——当前接口未含此二字段，需补。

#### `GET /api/me/memorials` ✅
```json
{ "items": [{ "memorialId", "name", "avatarUrl", "relation": "owner|collaborator|visited",
             "memoryCount": 32, "candleLit": true, "lastActiveAt": "…" }] }
```
创建/协作/供奉过聚合，去重，倒序。

#### `GET /api/me/orders` 🟡 待开
```json
{ "items": [{ "id", "itemName": "敬一杯茶", "amountCents": 600, "currency": "cny",
             "status": "paid", "createdAt": "…" }] }
```
> 待确认⑦：退款单显性展示（`status=refunded` 单独样式）。

---

### 3.10 亲友共同纪念 ✅（P1 已实现）

| 接口 | 说明 |
|---|---|
| `POST /api/groups` | 创建协作组并绑定纪念馆 |
| `POST /api/groups/join` | 凭邀请码加入 |
| `POST /api/groups/[id]/rotate-invite` | 更换邀请链接（旧码失效） |
| `GET /api/groups/[id]` | 成员列表（已打码） |
| `POST /api/groups/[id]/leave`、`DELETE /api/groups/[id]/members/[uid]` | 退出/移除 |
| `POST /api/groups/[id]/transfer` | 转让馆主 |

响应中成员昵称一律 `nameMasked`；访客=看公开内容+留言/献花，协作人=可编辑记忆档案（服务端强制，越权负例已有冒烟）。

### 3.11 其余已实现接口（不动）

`auth/*`、`media`/`upload`、`garden`（发现页）、`digitalhumans/*`（暂缓）、`admin`、`moderation/appeals`、`health`。

---

## 四、埋点（随接口打点）

| 埋点 key | 触发 |
|---|---|
| `hall_chat_entry` | 主 CTA / 身份说明页确认（前端上报） |
| `hall_chat_reply` | chat 成功回复（已打） |
| `hall_chat_first_round` | 首轮对话完成（前端上报） |
| `memory_created_from_chat` | POST memories 且 source=chat |
| `tribute_created` / `tribute_paid` | 免费/付费供奉 |
| `gift_funnel` | prompt→generate→claim→share 各步 |
| `retention_7d/30d` | 离线任务计算 |

---

## 五、待用户确认清单（与 09 同口径）

| # | 问题 | 建议默认值 |
|---|---|---|
| ① | `candleLit/candleLitHours` 固化为 MemorialView 字段 | 固化，24h 窗口装配 |
| ② | 悼文置顶 `isPinned` | V1 只用排序规则 |
| ③ | feed 分页 | V1 固定 50 条前端折叠 |
| ④ | 对话历史策略 + 清空接口 | 本人全量；开 `GET/DELETE history` |
| ⑤ | Stripe 真实链路验证排期 | P1 收尾项 |
| ⑥ | 守护 N 馆 · X 天口径 | 馆主+协作去重；自最早建馆起 |
| ⑦ | 退款单显性展示 | 展示，refunded 单独样式 |
| ⑧ | `appellation` 称谓列（M1 迁移） | 加列，空回落「TA」 |
| ⑨ | 时间线配图 `mediaId` | `life_events` 加可空列 |
| ⑩ | chat 装配超 100 条截断策略 | 分区配额截断，V1 先监控 |

---

## 八、适配层说明（snake_case ↔ camelCase）

当前部分已实现接口返回物理字段名（snake_case，如 `msg_type/created_at/price_cents`），目标契约为视图模型 camelCase。方案：

1. 在 `src/lib/` 新增 `view-models.ts`，集中放置 `toMemorialView / toFeedItem / toChatReply …` 装配函数，路由层统一经其输出；
2. 契约只增不减：迁移期内响应同时携带两套字段（如 `msg_type` 与 `msgType` 并存），前端切到 camelCase 后由后续版本摘除旧字段；
3. 请求体同理：路由层同时接受 `memorialId`/`memorial_id`，内部归一；
4. 每个改造接口补冒烟断言（延续 `tools/hall-check.mjs` 模式），防止契约回退。
