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
| 11 | 我的页 | 用户卡片；我的纪念；服务（年卡）；订单流水；亲友共同纪念；通知；隐私；帮助与反馈；设置 | `GET /api/me`、`GET /api/me/memorials`、`GET /api/me/orders`✅、`GET/POST /api/me/notifications`🟡、`POST /api/feedback`🟡、`GET/PATCH /api/me/settings`🟡、`GET/POST /api/me/data`✅、`POST /api/auth/logout`✅、`DELETE /api/memorials/[id]`🟡 | F1/F6 |

亲友共同纪念走 `groups` 族（§3.10）；发现页 = 公共墓园「星海」，走 `GET /api/garden`（§3.11）+ `halls` 族星海/合馆接口（§3.13）；建馆向导编排见 §3.12。

> 2026-08-23 扩展（《11-建馆向导与我的板块方案》R1–R5）：屏02 首页新增空态引导页与「创建新纪念馆」入口；屏06 记忆档案空态可写；底部「发现」落实为公共墓园视图；屏11 按键全部补齐后端。

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

### 3.8 AI 生成纪念物（F6 GiftJobView，2026-08-23 W5/W6 落地真实链路）

#### `POST /api/items/prompt` ✅（每日限量 10 次）
`{ "idea": "想送 TA 一套特别的茶具" }` → `200 { "ok": true, "prompt": "粗陶质地……", "provider": "ark", "remaining": 7 }`（remaining=W5 新增）；超量 `429 quota_exceeded`。

#### `POST /api/items/generate` ✅（W6：异步任务 + 幂等）
`{ "prompt", "idempotency_key" }` → `200 { "jobId", "status": "processing", "completed": 0, "total": 4, "provider": "ark" }`。
后台逐张生成（火山 seedream），每完成一张 `completed+1`；同幂等键重放直接返任务现状。

#### `GET /api/items/generate?jobId=` ✅（W6：真实进度轮询）
```json
{ "jobId", "status": "processing|done|failed", "completed": 2, "total": 4,
  "candidates": ["/uploads/items/…"], "error": null, "provider": "ark" }
```
仅任务属主可读；前端 1.5s 轮询渲染百分比进度条；失败 `status=failed` + 已完成张数保留。

#### `POST /api/items/claim` ✅
`{ "url", "prompt", "name" }` → 收藏为 custom 祭品（`review_status=pending`，审核通过后上供桌）。

#### 想念对话双模式（W3，2026-08-23）
`POST /api/hall/chat` 请求新增可选 `"mode": "companion | roleplay"`（缺省 companion 向后兼容）：
- `companion` 第三方纪念性助手（现状）；`roleplay` 模仿模式，AI 以角色第一人称回应，**仅登录用户**（访客 401 `roleplay_requires_login`）
- 响应回显 `"mode"`；消息落库带 `mode` 列（迁移 019）；埋点 `hall_chat_reply` 加 mode 维度
- 模仿模式提示词：同一资料集 + 语气/性格分区强化第一人称 + 坦白条款（被问身份必须承认 AI）

#### 聊天沉淀为记忆（W4，2026-08-23）
- 对话时注入本馆本人最近 20 条 `chat_messages` 作为「近期对话」上下文
- 每轮后 LLM 异步从**用户消息**抽取关于 TA 的新事实 → `memories(section='chat', source='chat')`；设置页开关 `chatMemory`（默认开）；前端记忆页显示「💬 聊天中记起」分区

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

#### `GET /api/me/orders` ✅
```json
{ "items": [{ "id", "itemName": "敬一杯茶", "amountCents": 600, "currency": "cny",
             "status": "paid", "createdAt": "…" }] }
```
已实现（F6 OrderView 适配，倒序上限 200）；退款单 `status=refunded` 显性展示（待确认⑦）。

#### 屏11 其余按键接口（2026-08-23 全部落地，详见《11》R5）

| 接口 | 状态 | 说明 |
|---|---|---|
| `GET /api/me/notifications`、`POST /api/me/notifications/read` | ✅ 已实现 | 通知中心：审核结论/协作动态/系统；倒序 50 条 + 未读数；写入点已接协作组加入/退出（`lib/notify.ts insertNotification`，尊重用户开关） |
| `POST /api/feedback` | ✅ 已实现 | 帮助与反馈：`{ content ≤500, contact? }` → 201；过审核 + 60s 限频（429） |
| `GET/PATCH /api/me/settings` | ✅ 已实现 | 通知/隐私开关（notifyReview/notifyCollab/privateDefault），存 `users.settings` JSON（迁移 M6），读取与默认值合并 |
| `DELETE /api/memorials/[id]` | ✅ 已实现 | 仅馆主；现实现为硬删（事务级联 + 审计日志 + 上传文件清理）；M7 `deleted_at` 软删列已预留，找回窗待离线任务 |
| `GET/POST /api/me/data` | ✅ | 隐私：全量数据导出 / 注销申请（落 `data_requests`） |
| `POST /api/auth/logout` | ✅ | 设置 → 退出登录 |

屏11 前端：6 个子视图（orders/groups/notifications/privacy/feedback/settings）全部接入真实接口（2026-08-23 回归 14 项通过，`tools/test-r4-profile.cjs`）。

#### 屏05/06 AI 生成祭品（2026-08-23 前端三步流落地）

礼物页由演示态改为真实链路：心意输入 →「帮我写」`POST /api/items/prompt`（火山方舟 LLM 扩写，provider=ark）→ `POST /api/items/generate`（火山 seedream 生图 ×4，幂等键防重复扣额度）→ 选图 → `POST /api/items/claim`（review_status=pending，审核通过后上供桌）。回归脚本 `tools/test-r6-mobile-email-gift.cjs`。

登录屏邮箱通道：验证码链路已验证可用（request-code email → devCode 回填 → verify 自动建号，`@bian.dev` 测试域跳过真实 SMTP）。

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

`auth/*`、`media`/`upload`、`garden`（发现页 = 公共墓园，`GET /api/garden?q=` ✅ + `PATCH /api/memorials/[id]/garden` ✅ 馆主加入/移出）、`digitalhumans/*`（暂缓）、`admin`、`moderation/appeals`、`health`。

---

### 3.12 建馆向导编排（2026-08-23，R1/R2）

不新开聚合接口，前端三步编排既有接口：

| 步骤 | 调用 | 说明 |
|---|---|---|
| 1 TA 是谁 | `POST /api/media`（选照片）| 得 `mediaId/url` 暂存 |
| 3 生成 | `POST /api/memorials` 🟡 | 请求体新增 `appellation`（称谓 ≤10 字）+ `avatarUrl`；默认 `visibility=private`、`is_published=1`；响应 `201 { "id" }` |
| 3 生成 | `POST /api/memories` × N ✅ | 向导第 2 步暂存的每条记忆一次调用，`source="manual"`（馆主建馆即有权限）；部分失败不阻断，toast 报「N 条已保存，M 条稍后可补」 |
| 失败补偿 | `DELETE /api/memorials/[id]` 🟡 | 复用 R5 软删接口；正常向导流程不调用 |

空态判定：`GET /api/me/memorials` 的 `items` 为空 → 前端落「空态引导页」（无角色，主 CTA 进向导）；判定全在后端，前端不自建规则。
埋点新增：`wizard_step`（1/2/3）、`wizard_completed`（memorialId、memoryCount）。

---

### 3.13 星海与合馆（halls 族，2026-08-23 新增，FR-02b/墓园规格 §8）✅ 灯阵/星海已上线，合祭待开

> 依据：13 号方案（灯阵）+ 墓园规格 §8（星海）+ 09 文档 B17/F7/F8/M8/M9。灯阵四接口与星海两接口已实施并过 14 项回归（tools/test-starsea.cjs）；存量单人馆为 N=1 特例，行为不变；建馆 POST /api/memorials 已同步建 halls 记录并透传 visibility。offer-all 合祭仍待开。

#### `GET /api/halls/[id]` ✅（F7 HallView）

馆内灯阵场景数据源：
```json
{
  "id": "h_xxx", "name": "林家纪念馆", "motto": "", "skin": "lanterns",
  "viewerRole": "owner",
  "lamps": [
    { "memorialId": "m_1", "nameMasked": "林**", "birthDate": "1940", "deathDate": "2023",
      "epitaph": "想念从未离开", "avatarUrl": "…", "candleLit": true, "pos": { "x": 0.42, "y": 0.3 } }
  ]
}
```
- `lamps` 1~6 盏；`nameMasked` 按 `viewerRole` 装配（馆主原文/访客打码）。
- 人物详情仍走既有 `GET /api/memorials/[id]` 等接口（按 `memorialId`），本接口不下发内容数据。
- `404 not_found`：不存在/无权可见。

#### `PATCH /api/halls/[id]/layout` ✅（馆内摆位）

**请求**：`{ "layout": { "m_1": { "x": 0.42, "y": 0.3 } } }`（坐标 0~1）。仅馆主；实现注：摆位坐标落 `memorials.lamp_x/lamp_y` 列（按 memorialId），未用 halls.layout_json 列 → `200 { "ok": true }`。埋点 `lamp_arrange`。

#### `PATCH /api/halls/[id]/garden-pos` ✅（星海择位）

**请求**：`{ "x": 0.63, "y": 0.41 }`；隐式置 `in_garden=1`。仅馆主；前置校验馆可见性 public（否则 `403 forbidden`）；空位冲突检测 `409 position_conflict`（响应附建议邻近空位）。移出星海：`{ "x": null, "y": null }` → `in_garden=0`。埋点 `garden_place`。

#### `GET /api/garden/starsea?zone=&bbox=` ✅（F8 GardenSeaView）

星海分片数据源（LOD）：`zone=public|family|official`；`bbox=x1,y1,x2,y2` 视口分片。
```json
{
  "halls": [
    { "hallId": "h_1", "nameMasked": "林**", "x": 0.63, "y": 0.41, "zone": "public",
      "lampCount": 2, "candleLit": true, "avatarUrl": "…",
      "birthDate": "1940", "deathDate": "2023", "epitaph": "…", "constellationOf": null }
  ]
}
```
- 仅 `in_garden=1` 且 public 的馆；搜索仍走既有 `GET /api/garden?q=` ✅。
- 短缓存 `private, max-age=15`；清明脉冲期可静态化快照。
- `constellationOf`（家族星座连线）M4 祠堂上线前恒 `null`。

#### `POST /api/halls/[id]/offer-all` 🟡（合祭「为全家点灯」）

**请求**：`{ "itemId", "message?": "", "orderId?": null }` → 事务内对馆内每位人物各落一条 `tributes`（付费项共享同一 `orderId`，免费项共享应用层批次号）；任一失败整体回滚。
**响应**：`201 { "batchId", "count": 2 }`。审核/限频同 `POST /api/tribute`；埋点 `offer_all`。

**红线**：本节所有接口无访问量/热度/榜单字段；择位与摆位不计费、不限次；`zone=official` 仅平台后台可写。

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
| `lamp_arrange` / `lamp_focus` | 馆内摆位拖拽 / 聚焦某盏灯（§3.13） |
| `offer_all` | 合祭「为全家点灯」（§3.13） |
| `garden_place` | 星海择位/移出（§3.13） |

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
