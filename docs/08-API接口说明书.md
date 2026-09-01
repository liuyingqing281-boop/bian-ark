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
| 01 | 登录注册屏（第一屏，2026-08-24 登录/注册分离 ✅；2026-08-25 增密码登录/忘记密码 ✅ 已实施（当日落地）） | 默认「登录」tab，内含「密码 / 验证码」两种登录方式切换（密码方式=账号+密码+忘记密码入口；验证码方式=现行：手机/邮箱通道、60s 倒计时）；微信扫码登录、「先看看」访客态；「注册」tab（专门点击进入）：手机/邮箱通道 + 验证码 + **密码/确认密码两行（👁 显隐切换）** + 昵称 + 协议勾选、微信注册 | 已实施：`POST /api/auth/request-code`、`POST /api/auth/verify`（intent 分流 ✅）、`POST /api/auth/logout`、`POST /api/auth/wechat/qrcode`✅、回调 `GET /api/auth/wechat/callback`✅、`POST/DELETE /api/auth/bind`✅、`GET /api/me`（启动判登录态）；已实施（§3.0，2026-08-25 拍板并当日落地）：verify 注册带 `password` ✅、`POST /api/auth/login-password` ✅、`POST /api/auth/reset-password` ✅ | —（无馆数据，§3.0） |
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

- **会话**：`POST /api/auth/request-code` → `POST /api/auth/verify`（`intent` 区分登录/注册，2026-08-24 拍板分离）、账号密码 `POST /api/auth/login-password`（2026-08-25 拍板 ✅）或微信扫码 `/api/auth/wechat/*`（qrcode 同样带 `intent`）换 Cookie 会话；忘记密码走 `POST /api/auth/reset-password`（✅，不写会话）。未登录 = 访客态，只读公开内容。
- **角色**：`owner > collaborator > member > guest`。前端不自行推断权限，一律读视图模型中的 `viewerRole`（由后端 `lib/permissions.ts` 装配）。
- **可见性**：服务端强制；悄悄话越权返回过滤后列表而非 403（不泄露存在性）。
- **打码**：只在后端输出层做（`maskName`），前端直接渲染 `senderMasked`/`nameMasked`，任何接口不返回完整真实姓名。
- **审核**：写接口先过审核，不过 `422 content_rejected`；申诉 `POST /api/moderation/appeals`。
- **限长**：留言/悄悄话/悼文/记忆/对话消息 ≤ 500 字（服务端截断或拒绝）。
- **错误码总表**：`400 bad_request/invalid_json/missing_*`、`401 unauthorized`、`402 payment_required`、`403 forbidden`、`404 not_found`、`422 content_rejected/blocked`、`429 quota_exceeded`、`503 llm_unavailable`。

---

## 三、接口明细

### 3.0 认证（屏01 登录注册屏；2026-08-24 拍板：登录/注册分离 ✅；2026-08-25 拍板：账号密码登录/忘记密码 ✅ 已实施）

> **拍板内容（2026-08-24）**：注册与登录彻底分开，废除「登录即注册」。**手机号 / 邮箱 / 微信三种方式平级**，同等地作为登录与注册通道；默认进登录，注册需专门点击切换 tab。前端默认态为登录（见《前端具体设计流程》§2.0、PC `/login` 见《web/01》§9.4/§9.5）。
> **实施状态（2026-08-24 已落地）**：request-code / verify（含 `intent` 分流）/ logout / bind / wechat qrcode+callback（含 `intent`）全部 ✅ 已实现，迁移 023（M11）已应用；旧调用缺 `intent` 一律 `400 missing_intent`，无自动建号兼容分支。冒烟 `tools/test-auth-intent.cjs` 12/12。
> **2026-08-25 增量拍板（✅ 当日已实施）**：注册即设密码——`verify(intent=register)` 增必填 `password`（前端「密码/确认密码」两行、👁 显隐切换、两次一致才可提交）；**注册后手机号/邮箱即本产品账号**，登录 tab 新增「密码 / 验证码」两种方式切换（验证码方式保留，可继续使用），密码方式直接账号+密码登录；新增「忘记密码」流（账号发码核身 → 重置新密码）。涉及新接口 `login-password` / `reset-password`、迁移 M12（`users.password_hash`，见 09 §B12/B14，✅ 迁移 024 已应用）与前端两端图纸（web/01 §9.5、前端具体设计流程 §2.0）。
> **实施状态**（2026-08-25 已落地）：verify 注册带 `password`、login-password、reset-password、me `hasPassword` 全部 ✅；密码 bcrypt（bcryptjs，cost 10）；冒烟 `tools/test-password-auth.cjs` 16/16（含锁定/重置/未设密码直改库用例，reset 段 61s 限频等待）；回归 test-auth-intent 12/12 + smoke-auth + p1/p2/p4 全过；工具链 21 处 verify 注册调用补 `password`。**实现差异**：① 密码规则另禁空白字符；② login-password 的 `channel` 允许缺省，服务端按账号格式自动推断（前端判定 + 服务端兜底双保险）；③ 顺带修复 /api/me groups 查询既有笔误（`gm.group_id`，未提交工作区版本误写 `g.group_id` 致 500）。

#### `POST /api/auth/request-code` ✅
**请求**：`{ "channel": "sms" | "email", "target": "1xxxxxxxxxx 或邮箱" }`
- 手机号正则 `^1\d{10}$`、邮箱标准格式，不符 `400 invalid_phone / invalid_email`。
- 手机 / 邮箱两条验证码通道**平级同规则**（限频、有效期、锁定一致，按通道独立计数）；登录、注册、绑定换验（bind）、忘记密码（reset-password）四个场景同用本接口（忘记密码发码同样不探测账号存在性）。
- 限频：同通道同目标 60s 内重发 `429 too_frequent`；同 IP 日上限（默认 100，`AUTH_IP_DAILY_LIMIT` 可配）`429 rate_limited`。
- 验证码 6 位数字，10 分钟有效；新码生成即作废旧码。
- 发码阶段**不探测账号是否存在**（不在发码时泄露注册状态）；登录/注册分流统一由 verify 按 `intent` 判定。

**响应 200**：`{ "ok": true, "delivered": true, "devCode?": "123456" }`
> `devCode` 仅非生产环境且未接真实短信/邮件网关时返回，原型用它自动回填，生产绝不下发。短信通道为阿里云直连（`SMS_PROVIDER=aliyun` + RAM 子账号，2026-08-24 开通）；测试号段 `1XX-0000-XXXX` 跳过真实发送（自动化测试依赖 devCode）。

#### `POST /api/auth/verify` ✅（2026-08-25 增量参数 `password` 已实施）
**请求**：`{ "channel": "sms" | "email", "target": "", "code": "6 位", "intent": "login" | "register", "password?": "", "name?": "", "agreed?": false }`
- `intent` 必填，缺省 `400 missing_intent`；全角数字自动归一；错 5 次锁 15 分钟（`429 too_many_attempts`）；过期/不符 `400 invalid_code`（前端统一文案「验证码错误」）。
- **核销时点**：验证码在分流校验**通过后**才核销——`account_not_found`/`already_registered`/`agreement_required`/`weak_password` 均不消耗验证码，登录/注册 tab 互相引导切换后**同一验证码可直接复用**（前端依赖此行为）。
- `intent=login`：按 phone（channel=sms）/ email（channel=email）查 `users`——未找到 **`404 account_not_found`**（前端提示「还未注册」并引导切注册 tab，不再自动建号）；找到 → 写 Cookie 会话 → 埋点 `login`。
- `intent=register`：`channel=sms|email` 均可（手机 / 邮箱平级）；target（手机号/邮箱）已被注册 **`409 already_registered`**（前端提示「已注册，可直接登录」并引导切登录 tab）；`agreed` 非 `true` → `400 agreement_required`（协议勾选为注册必经）；**`password` 必填**——不符密码规则 `400 weak_password`（不核销验证码，前端修正密码后同码重交）；「确认密码」两行一致性为纯前端校验，服务端只收一份 `password`。校验通过 → 建 `users`（手机通道落 `phone`、邮箱通道落 `email`，`password` 经 bcrypt 入 `password_hash`，`name` 缺省「彼岸用户」）→ 写 Cookie 会话 → 埋点 `register` + `login`。
- **密码规则（注册与重置同规，前后端一致）**：长度 8–64；须含大写字母 / 小写字母 / 数字 / 特殊符号四类字符中的**至少 3 类**；不含空白字符。

**响应 200**：`{ "ok": true }` → 前端 toast「注册成功」（注册）后进「纪念馆首页」（注册成功与登录同落点，首页空态再引导建馆）。

#### `POST /api/auth/login-password` ✅（2026-08-25 已实施）
账号密码登录：**注册后的手机号/邮箱即本产品账号**，与验证码登录、微信扫码平级的会话通道。
**请求**：`{ "channel": "sms" | "email", "target": "手机号或邮箱", "password": "" }`
- `channel` 由前端按账号格式自动判定（手机号正则命中 → `sms`，否则 `email`），服务端同规则复核 `400 invalid_phone / invalid_email`。
- 账号未注册 → `404 account_not_found`（与验证码登录同文案同引导：toast「还未注册」+「去注册 →」，体验不分差异）。
- 账号已注册但未设置密码（微信注册账号 / 迁移 024 前的历史验证码账号，`password_hash` 为空串）→ `401 password_not_set`（前端 toast「该账号未设置密码」+ 文字链「验证码登录」/「忘记密码」，后者可为老账号首次设置密码）。
- 密码不符 → `401 invalid_credentials`；**同账号连错 5 次锁 15 分钟** `429 too_many_attempts`（计数按 (channel,target) 应用层滑动窗口，与验证码 attempts 同款节奏，不新增表）。
- 成功 → 写 Cookie 会话（与 verify 同路，不分流）→ 埋点 `login`。

**响应 200**：`{ "ok": true }`

#### `POST /api/auth/reset-password` ✅（2026-08-25 已实施；「忘记密码」）
三步流的收口接口：第一步复用 `request-code` 向账号（手机/邮箱）发码，本接口完成「验码 + 重置」。
**请求**：`{ "channel": "sms" | "email", "target": "", "code": "6 位", "password": "" }`
- 验码规则同 `verify`：全角归一、10 分钟过期、错 5 次锁 15 分钟；过期/不符 `400 invalid_code`（前端文案「验证码错误」）。
- 账号不存在 → `404 account_not_found`（不核销验证码，沿用「分流校验通过才核销」）。
- 新密码 `password` 同注册密码规则，不符 `400 weak_password`（不核销验证码，前端修正后同码重交）；「确认新密码」为前端两行一致性校验，服务端只收一份。
- 全部通过 → 核销验证码 → bcrypt 落 `users.password_hash` 并更新 `password_updated_at` → 埋点 `reset_password`。**不写会话**：重置成功回登录页用新密码登录（前端提示「密码已重置，请用新密码登录」并切回登录 tab·密码方式）。
- 对「从未设置过密码」的已注册账号，本流程即为首次设置密码，行为完全一致。

#### `POST /api/auth/logout` ✅
销毁会话 Cookie → `200 { "ok": true }`（我的页「设置 → 退出登录」用）。

#### 微信扫码（登录/注册同通道，`intent` 分流）✅
- `POST /api/auth/wechat/qrcode`，body `{ "intent": "login" | "register" }` → `{ "url", "state" }`：`url` 为微信开放平台授权页（PC 网站应用扫码），前端整页跳转；`state` 落 `auth_oauth_states`（10 分钟有效，迁移 M11 增加 `intent` 列）。登录态发起时 `state` 携带 `user_id`，即为「绑定」流程，不受 intent 影响。未配置 `WECHAT_*` 环境变量 → `503 wechat_not_configured`。
- `GET /api/auth/wechat/callback?state=&code=`（微信回跳，服务端处理，无前端轮询）：
  - `state` 带发起者 `user_id` → **绑定**：openid/unionid 绑到当前账号；该微信已属其他账号则 `mergeUsers` 合并（现状 ✅）。
  - `intent=login`：按 `wechat_unionid`/`wechat_openid` 匹配账号——未匹配**不建号**，重定向 `/{lang}/login?error=wechat_not_registered`；匹配 → 写 Cookie 会话 → 落地 `/zh/me`，埋点 `login`。
  - `intent=register`：未匹配 → 建号（昵称/头像取微信授权资料）→ 写 Cookie 会话 → 落地 `/zh/me`，埋点 `register` + `login`；已匹配 → 重定向 `/{lang}/login?error=wechat_already_registered`。
  - 登录页处理 `?error=wechat_*`：toast 对应文案 + 自动切 tab（未注册 → 引导切注册；已注册 → 留在登录）。
- 环境变量：`WECHAT_APP_ID` / `WECHAT_APP_SECRET` / `WECHAT_REDIRECT_URI`（微信开放平台「网站应用」凭证）。

#### `POST /api/auth/bind`、`DELETE /api/auth/bind` ✅（已实现，2026-08-24 补录文档）
- `POST`（登录态）`{ "channel": "email" | "sms", "target": "", "code": "6 位" }`：先经 `request-code` 收码，校验通过后绑定到当前账号；目标已被其他账号占用则 `mergeUsers` 合并，冲突事务失败 `409 bind_conflict`。
- `DELETE`（登录态）`{ "channel": "email" | "sms" | "wechat" }`：解绑对应登录方式；仅剩最后一种登录方式时 `409 last_login_method` 拒绝（防账号无门可入）。
- 消费方：我的页「账号与安全」（08 §3.9 屏11 按键表）。

#### `GET /api/me` ✅
启动判登录态：`200 { "user": { "id", "name", "email", "phone", "hasPassword" } }`（`hasPassword: boolean` ✅：是否已设密码，「账号与安全」展示用，只增不减）；未登录 `401`——原型据此决定第一屏落「登录注册屏」还是直达「纪念馆首页」。

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

**请求**：`{ "x": 0.63, "y": 0.41 }`；隐式置 `in_garden=1`。仅馆主；前置校验馆可见性 public（否则 `403 forbidden, reason: "visibility_required"`；非馆主 `403 forbidden` 无 reason——前端按 reason 分「先去公开」与「无权」两种提示）；空位冲突检测 `409 position_conflict`（响应附建议邻近空位）。移出星海：`{ "x": null, "y": null }` → `in_garden=0`。埋点 `garden_place`。

**馆可见性同步（迁移 025 配套）**：`PATCH /api/memorials/[id]` 改 `visibility` 时**同事务**同步 `halls.visibility`（馆 id 取 `memorials.hall_id`，空串回落 `hall_<memorialId>`），保证星海/馆级路由按馆可见性判断不与人物脱节；`in_garden` 不随之下线——星海查询层恒以 `halls.visibility='public'` 过滤兜底，转私馆即时从星海消失。

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
- `constellationOf`（家族星座连线）M4 祠堂上线前恒 `null`——这是明确限制，前端不渲染连线，**不把该能力写成已实现**。

**分片参数细则（正式前端 Task 8 固化）**：
- `limit`：默认 `200`，服务端硬帽 `500`（>500 一律按 500 执行）；非法值 `400 invalid_limit`。正式前端首屏全量走查（`bbox=0,0,1,1`）**每页显式 `limit=500`**——默认 200 会让 >500 馆的集合多翻一倍页数、更快撞客户端页帽。
- `cursor`：keyset 翻页（`h.id > cursor`，`ORDER BY h.id ASC`），响应带 `nextCursor`（null=尾页）；排序以馆 id 稳定，不受写入时序影响。
- `bbox`：四位小数 `x1,y1,x2,y2`（0–1 归一化视口框）；非法格式/越界 `400 invalid_bbox`；`zone` 非法 `400 invalid_zone`。
- **页帽耗尽语义**：客户端安全帽 25 页 × 500 = 12500 馆；帽耗尽仍有 `nextCursor` 时进入**显式可重试错误态**（已得数据保持可见，错误横幅与场景共存），绝不静默截断。

**馆级 canonical 路由（正式前端 Task 5 起）**：`/[lang]/hall/[hallId]` 为唯一规范地址（`hallId` = `halls.id`；存量单人馆 `hall_<memorialId>` 一一对应）。旧 `/[lang]/hall/[memorialId]` 链接服务端 `permanentRedirect`（308）到 `/[lang]/hall/[hallId]?p=[memorialId]`（落地即聚焦该人物；`from=garden` 透传）。解析顺序 halls.id 优先、memorials.id 兜底；**权限校验先于重定向**——private/group 馆对无权视角（含旧人物 id 探测）一律 404，旧 id 不构成绕过。`?p=` 只在命中本馆成员时聚焦，多人馆缺省馆级公共层；`from=garden` 仅用于「返回星海」浏览状态恢复，**不参与任何权限判断**。

**3D 渐进增强与降级（正式前端 Task 7）**：`view=3d` 为渐进层，canvas `aria-hidden`、热区/键盘/语义全部走独立 DOM overlay；WebGL 不可用 / three 动态导入失败 / 上下文丢失 / 低性能设备（deviceMemory 阈值）/ `prefers-reduced-motion` 任一条件触发时自动回退 2.5D 并以 `role=status` 播报，URL 摘除 `view=3d`，抽屉与控制条不受影响。

**已知差异（记录，不视为缺陷）**：星海接口的馆名脱敏对**所有视角**生效（馆主在星海中也只见 `nameMasked`，`lampCount>1` 打码馆名、单人馆打码逝者名）；而 `GET /api/halls/[id]` 与馆级页按 `viewerRole` 对馆主下发原文——两侧口径不同属有意设计（星海永远不向任何客户端泄露可搜索的全名）。

**正式测试入口**：`node --experimental-strip-types tools/test-starsea-formal.mjs`（API/迁移/路由契约冒烟，自起临时服务器）；端到端 `npx playwright test tests/e2e/starsea.spec.ts --project=desktop-chromium --project=mobile-chromium`（正式页主旅程/移动端/无障碍/择位错误分支）；视觉基线 `node tools/visual-garden.mjs`（产物 `docs/shots/garden-starsea-*.png`）。

#### `POST /api/halls/[id]/offer-all` 🟡（合祭「为全家点灯」）

**请求**：`{ "itemId", "message?": "", "orderId?": null }` → 事务内对馆内每位人物各落一条 `tributes`（付费项共享同一 `orderId`，免费项共享应用层批次号）；任一失败整体回滚。
**响应**：`201 { "batchId", "count": 2 }`。审核/限频同 `POST /api/tribute`；埋点 `offer_all`。

**红线**：本节所有接口无访问量/热度/榜单字段；择位与摆位不计费、不限次；`zone=official` 仅平台后台可写。

### 3.14 语音能力（voice 族，2026-08-23 新增，FR-13/14）✅ 已实现（MiMo 真 key 联调待做）

> 依据：14 号语音方案 + 09 文档 B18/F9/M10。全族接口为 MiMo API 的服务端中转（`lib/voice.ts` 唯一出口），MiMo key 只在环境变量，前端永远不可见。ASR/TTS 走 `mimo-v2.5-asr` / `mimo-v2.5-tts`（均流式）；音色设计/复刻走 `voicedesign` / `voiceclone`（非流式，一次性返回）。
>
> **实施记录（2026-08-23）**：迁移 022 已应用；四接口 + admin 审核动作已上线；自有 SSE 合约（服务端把 MiMo SSE 转为 `{"delta"}` / `{"audio"}` 分片，与 provider 解耦）；未配置 `OPENAI_API_KEY` 时统一降级 `503 voice_unavailable`（前端回落浏览器能力）；冒烟 tools/test-voice.cjs 5/5，回归 p1/p2/p4 全过。**实现差异**：B 档样本由 `POST /api/memorials/[id]/voice` 直接收 multipart（`saveUpload` → `voice/` 子目录），落 `voice_clones.sample_url`，不走 `/api/upload` + mediaId（该接口仅图片）；preview 试听需登录。

#### `POST /api/voice/asr` ✅（语音输入 → 文字）

**请求**：`{ "audio": "data:audio/wav;base64,…" }`（前端 WAV 直出，≤60s / base64 ≤4M 字符）。
**响应**：SSE 流式回识别文字（`data: {"delta":"…"}` × N，结束 `{"done":true}`）。
- 服务端调 `mimo-v2.5-asr`（`asr_options.language=auto`）并转为自有 SSE 合约。
- 仅登录用户；按用户+日限频（100 次，events 表计数）；识别结果**不落库**——文字上屏后走既有 chat/messages 链路（审核不旁路）。
- 错误：`503 voice_unavailable`（前端降级 Web Speech API）；`413 audio_too_large`；`429 rate_limited`。

#### `POST /api/voice/tts` ✅（朗读 → 语音流）

**请求**：`{ "memorialId", "text" (≤500) }`。
**响应**：SSE 流（`data: {"audio":"<base64 pcm16>"}`，24kHz 单声道），前端 AudioContext 边收边播。
- 文本先过 `moderateText`（`422 content_rejected`）；音色按 F9 视图规则取：`clone` 且 approved → 复刻音色；其余 → `voice_handle`；未配置 → 系统默认温和音色（白桦）。
- 游客可用（朗读不改状态）；登录按用户+日 200 次、游客按匿名 IP+日 30 次限频。
- 错误：`503 voice_unavailable`（前端降级 SpeechSynthesis）；`429 rate_limited`。

#### `POST /api/memorials/[id]/voice` ✅（角色音色配置，A/B 档）

**A 档请求**：`{ "mode": "preset", "voice": "白桦" }` 或 `{ "mode": "design", "voiceDesc": "年迈女性，语速慢…" }`（desc ≤100 字，过 `moderateText`）→ `200 { "ok": true, "voiceProfile": {F9} }`；`{ "mode": "none" }` 清除配置。
**B 档请求（实现差异）**：直接收 **multipart/form-data**（`file`：mp3/wav ≤10MB；`consentAccepted`: "true"）→ 样本落对象存储 `voice/` 子目录 + 落 `voice_clones`（pending）+ 进 admin 审核队列 → `202 { "cloneStatus": "pending" }`。
- `consentAccepted` 非 true → `422 consent_required`；提交人须为 owner/collaborator（`canManageMemorial`）。
- 审核通过（admin `review_voice_clone` 动作）→ 置 `memorials.voice_mode='clone'`、`voice_handle=voice_clones.id`，发 notifications；驳回 → `rejected` + 原因通知 + memorials 回落未配置。
- 埋点：`voice_profile_set`（A 档）/ `voice_clone_submit`（B 档）。

#### `POST /api/voice/preview` ✅（音色试听，需登录）

**请求**：`{ "voice" | "voiceDesc", "line": 0|1|2 }`（固定三句试听文案之一，不接受自由文本）→ SSE 音频流（同 tts 合约）。建馆向导/设置页试听专用；未保存不产生任何落库；按用户+日 50 次限频。

#### `GET /api/memorials/[id]/voice` ✅

返回 `{ "voiceProfile": {F9}, "presetVoices": [...] }`；仅 owner/collaborator。

**红线**：语音接口不产生公开内容（ASR 文字仍需用户确认后走既有链路）；B 档三件套（授权+人工审核+「AI 合成声音」角标）缺一不可；全族接口不下发也不接收任何 MiMo 凭证。

---

## 四、埋点（随接口打点）

| 埋点 key | 触发 |
|---|---|
| `register` | verify `intent=register` 建号成功（含 `password` 设密）/ 微信注册首次授权建号（§3.0） |
| `login` | verify `intent=login` 成功 / 密码登录 login-password 成功（§3.0）/ 微信扫码登录成功（§3.0） |
| `reset_password` | 忘记密码重置成功（§3.0） |
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
| `voice_input_used` | 🎙 完成一次识别并上屏（§3.14） |
| `voice_play` | 🔊 开始播放，带 voiceMode=preset/design/clone（§3.14） |
| `voice_profile_set` / `voice_clone_submit` | A 档音色保存 / B 档复刻提交（§3.14） |

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
| ⑪ | B 档复刻声音样本保存期限 | 90 天，到期离线任务清理 |
| ⑫ | MiMo 端点选择（国际/国内） | 上线前实测后切 `OPENAI_BASE_URL` |

---

## 八、适配层说明（snake_case ↔ camelCase）

当前部分已实现接口返回物理字段名（snake_case，如 `msg_type/created_at/price_cents`），目标契约为视图模型 camelCase。方案：

1. 在 `src/lib/` 新增 `view-models.ts`，集中放置 `toMemorialView / toFeedItem / toChatReply …` 装配函数，路由层统一经其输出；
2. 契约只增不减：迁移期内响应同时携带两套字段（如 `msg_type` 与 `msgType` 并存），前端切到 camelCase 后由后续版本摘除旧字段；
3. 请求体同理：路由层同时接受 `memorialId`/`memorial_id`，内部归一；
4. 每个改造接口补冒烟断言（延续 `tools/hall-check.mjs` 模式），防止契约回退。
