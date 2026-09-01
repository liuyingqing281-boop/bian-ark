# 彼岸 · PC 端 API 接口文档

> 依据：`docs/08-API接口说明书.md`（主契约，优先阅读）、`docs/web/02-PC后端设计文档.md`。
> **本文只收录 PC 端消费的接口清单与 PC 相关增量契约；字段级定义一律以 08 文档为准，本文不复制定义，避免双源漂移。**
> 通用约定沿用 08：JSON；Cookie 会话；输入过 `moderateText`；UTC ISO 时间串；错误统一 `{ "error": "<code>" }`；错误码总表见 08 §二；红线：无虚拟币/充值/礼包/打榜，付费一律一口价。

---

## 一、PC 页面 → 接口映射

| PC 页面/区域（路由见 01 文档 §六） | 消费接口 | 视图模型 |
|---|---|---|
| 左导航（馆切换/用户卡） | `GET /api/me`、`GET /api/me/memorials` | F1 列表 |
| 纪念馆首页 Hero | `GET /api/memorials/[id]` | F1 |
| 纪念馆首页 · TA 的人生 | `GET /api/timeline?memorialId=`、`POST /api/timeline`（馆主/协作人） | F2 |
| 纪念馆首页 · 祭奠区 | `GET /api/items`、`POST /api/tribute`；付费先 `POST /api/stripe` → webhook → `POST /api/tribute(orderId)` | F6 |
| 纪念馆首页 · 最近的纪念（右栏 + 查看全部） | `GET /api/hall/feed?memorialId=&limit=&cursor=` ★分页增量 | F3 |
| 留下你的话（右栏卡片） | `GET/POST /api/messages`（public/private/eulogy） | F3 同源 |
| 记忆档案摘要 / `/archive` | `GET/POST /api/memories`、`PATCH/DELETE /api/memories/[id]` | F4 |
| 对话侧板 | `POST /api/hall/chat`、`GET/DELETE /api/hall/chat/history` ★（🟡→按 §三契约落地）、`POST /api/memories(source=chat)` | F5 / F4 |
| `/gift` 三步流 | `POST /api/items/prompt`、`POST /api/items/generate`、`GET /api/items/generate?jobId=`、`POST /api/items/claim` | F6 GiftJobView |
| `/family` 亲友共同纪念 | `groups` 族（见 08 §3.10） | — |
| `/me` 我的页 | `GET /api/me`、`GET /api/me/memorials`、`GET /api/me/orders?limit=&cursor=` ★（🟡→落地） | F1 / F6 |
| `/discover` 发现（后续） | `garden` 族（见 08 §3.11） | — |
| 纪念园「星海」 `/garden`（2026-08-23 契约，2026-09-01 正式前端上线） | `GET /api/garden/starsea?zone=&bbox=&limit=&cursor=`（✅ 分片/游标细则见 08 §3.13）、`GET /api/garden?q=`、`PATCH /api/halls/[id]/garden-pos`（择位 ✅）★（offer-all 仍 🟡，08 §3.13） | F8 |
| 馆内灯阵（多人馆 `/hall/[hallId]` 规范地址，2026-08-23；2026-09-01 canonical 路由 + `?p=` 聚焦上线，旧 memorial URL 308 重定向） | `GET /api/halls/[id]`、`PATCH /api/halls/[id]/layout`（摆位）、`POST /api/halls/[id]/offer-all`（合祭）★（🟡，08 §3.13）；人物详情复用既有 memorials 族 | F7 + F1–F6 |
| 鉴权 | `POST /api/auth/request-code`、`POST /api/auth/verify`（`intent` 分流 ✅ + 注册 `password` ✅）、`POST /api/auth/login-password`（✅）、`POST /api/auth/reset-password`（✅，均 08 §3.0，2026-08-25 已实施）、`POST /api/auth/wechat/qrcode`/回调（✅ 含 intent）、`POST/DELETE /api/auth/bind`（✅）；PC 消费注意见 §3.7 | — |
| 申诉 | `POST /api/moderation/appeals` | — |

★ = PC 相关增量/待落地项，详见下两节；其余接口契约**原样引用 08 文档**，前端 PC/移动两端共用。

---

## 二、统一分页约定（PC 新增，向后兼容）

凡带分页的 GET 列表接口，统一：

**请求参数**

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `limit` | int | 20 | 上限 50 |
| `cursor` | string | — | 上一页响应的 `nextCursor`；不透明串，勿自行解析 |

**响应信封**

```json
{ "items": [ /* 各接口视图模型元素 */ ], "nextCursor": "eyJ…" }
```

- `nextCursor: null` 表示没有更多。
- 排序统一 `createdAt` 倒序（游标按 `createdAt + id` 编码防同时间戳漏数据）。
- 不传 `cursor` 即取第一页，移动端现有调用不受影响。

---

## 三、PC 增量/待落地接口明细

### 3.1 `GET /api/hall/feed?memorialId=&limit=&cursor=`（扩展 ✅→分页）

纪念馆混合纪念流（tributes ∪ messages，已打码）。

```json
{
  "items": [
    { "id": "f_1", "type": "tribute", "itemKey": "flower", "senderMasked": "李**", "createdAt": "2026-08-23T02:10:00Z" },
    { "id": "f_2", "type": "message", "msgType": "public", "preview": "爷爷，我……", "senderMasked": "用户A", "createdAt": "2026-08-22T15:00:00Z" }
  ],
  "nextCursor": null
}
```

- `type: tribute|message`；悄悄话（private）仅作者本人可见（服务端过滤，不泄露存在性）；悼文置顶规则由 08 文档定义。
- 错误：`404 not_found`（馆不可见）。

### 3.2 `GET /api/hall/chat/history?memorialId=&limit=&cursor=`（🟡→落地）

对话侧板与移动端对话页共用的历史源；PC 侧板初始拉一页（30 条），上拉用 `cursor` 翻旧记录。

```json
{
  "items": [
    {
      "id": "c_1", "role": "user", "content": "爷爷，我今天工作特别累。", "createdAt": "…"
    },
    {
      "id": "c_2", "role": "ta", "content": "如果是以前，爷爷大概会先问你有没有好好吃饭。",
      "inferred": true,
      "evidence": { "memoryId": "m_9", "section": "relation", "excerpt": "爷爷每次打电话都会问我有没有吃饭……", "createdAt": "…" },
      "createdAt": "…"
    }
  ],
  "nextCursor": "eyJ…"
}
```

- `inferred=true` → 前端渲染「基于 TA 的资料推测」角标；`evidence` 缺省时前端**不渲染**依据链接（禁止空链接）。
- 权限：仅本人历史；`401 unauthorized` 游客（游客走 08 定义的 guest 会话规则）。
- 配套：`DELETE /api/hall/chat/history?memorialId=`（清空对话，前端二次确认）。

### 3.3 `GET /api/me/orders?limit=&cursor=`（🟡→落地）

`/me` 订单记录表格数据源（一口价流水）。

```json
{
  "items": [
    { "id": "o_1", "itemName": "敬茶", "amountCents": 600, "status": "paid", "memorialName": "林守拙", "createdAt": "…" },
    { "id": "o_2", "itemName": "AI 纪念物", "amountCents": 1900, "status": "refunded", "memorialName": "林守拙", "createdAt": "…" }
  ],
  "nextCursor": null
}
```

- `status: pending|paid|refunded|failed`；金额一律分（cents），前端格式化 ¥；仅本人订单（`401` 游客）。
- 退费（生成失败自动退）以 `refunded` 呈现，文案「没有准备好，已退款」由前端渲染。

### 3.4 字段扩展（只增不减）

| 接口 | 新增响应字段 | 说明 |
|---|---|---|
| 分页三接口 | `nextCursor` | §二 |
| `halls` 族 / `garden/starsea` | 整接口新增（F7/F8；starsea/择位/摆位 ✅ 已上线，合祭 offer-all 随 M4） | 08 §3.13；PC 无独占字段 |
| 其余全部 | 无 | PC 端不加任何独占字段 |

### 3.5 星海/灯阵 PC 消费注意（2026-08-23；2026-09-01 正式前端上线增补）

1. `GET /api/garden/starsea` 分片拉取：按当前视口 `bbox` 请求，滚动/缩放时增量补片；LOD 远端光晕只渲染 `x/y/candleLit/lampCount`。**全量走查（首屏 `bbox=0,0,1,1`）每页显式 `limit=500`**（服务端默认 200、硬帽 500）；`cursor` 为 keyset（`h.id` 升序稳定）；客户端页帽 25 页耗尽仍见 `nextCursor` 时进入**显式可重试错误态**，绝不静默截断（细则见 08 §3.13）。
2. 择位 `409 position_conflict` 时用响应附带的建议空位做引导微移动画，不让用户自己猜；`403` 按 `reason` 分流——`visibility_required` 提示先去「我的」改公开，无 reason（非馆主）提示无权。
3. 合祭 `offer-all` 提交中防重复点击；成功反馈 ≤1.2s（墓园规格 §6 上限）后刷新全馆灯态。
4. 摆位/择位拖拽仅在「布阵/择位模式」下发起 PATCH，普通浏览零写请求。
5. 馆级 canonical：`/hall/[hallId]`（`hall_<memorialId>` 一一对应）为规范地址；旧 memorial URL 服务端 308 到 `/hall/[hallId]?p=[memorialId]`；`?p=` 只在命中本馆成员时聚焦；`from=garden` 仅浏览状态恢复，非权限输入。PC 前端生成馆级链接一律用 `hallId`。
6. 3D 为渐进增强：WebGL 不可用/导入失败/上下文丢失/低性能/reduced-motion 自动回退 2.5D 并 `role=status` 播报，PC 消费不得把 3D 当作可用性前提；`constellationOf` M4 前恒 `null`，PC 不渲染星座连线。
7. 星海接口馆名对所有视角脱敏（馆主也只见 `nameMasked`），与馆级页按 `viewerRole` 原文的口径不同属有意设计（08 §3.13 已知差异）。

### 3.6 语音接口 PC 消费注意（2026-08-23，08 §3.14）

1. `POST /api/voice/asr`：前端 AudioWorklet 直出 WAV base64（≤60s/≤3MB），SSE 流式消费 `delta` 追加到输入框光标处；`503 voice_unavailable` 降级 Web Speech API。
2. `POST /api/voice/tts`：响应为 PCM16 流（24kHz 单声道），AudioContext 拼接边收边播；⏸ 中止即断流；`503` 降级 SpeechSynthesis。
3. 音色视图 `voiceProfile` 由 `GET /api/memorials/[id]` 随 F1 下发（F9，不单开查询）；`clone` 未 approved 一律按默认音色请求。
4. `POST /api/voice/preview` 试听不产生落库；B 档样本先 `POST /api/upload` 再带 `mediaId` 提交，不直传音频 base64。
5. 埋点 `voice_input_used / voice_play / voice_profile_set / voice_clone_submit` 携带 `platform: "web-pc"`，规则同 §四-7。

### 3.7 认证接口 PC 消费注意（2026-08-24，08 §3.0 登录/注册分离 ✅；2026-08-25 密码登录增量 ✅ 已实施）

1. `POST /api/auth/verify` 与 `POST /api/auth/wechat/qrcode` 均必传 `intent: "login" | "register"`；缺省 `400 missing_intent`。PC `/login` 双 tab（默认登录，见 01 §9.4）分别以 `login` / `register` 发起。
2. 分流错误引导：`404 account_not_found` → toast + 「去注册」切 tab；`409 already_registered` → toast + 切回登录（保留账号输入）；`400 agreement_required` → 协议勾选抖动提示。注册 `channel=sms|email` 均可（手机 / 邮箱平级，同登录）。
3. 微信扫码为整页 OAuth 跳转（无轮询）：`qrcode` 返回 `{url, state}`，`window.location` 跳转；回调错误经 `/{lang}/login?error=wechat_not_registered｜wechat_already_registered` 落地，登录页挂载时解析 `?error=` 并自动切 tab。
4. 绑定/解绑 `POST/DELETE /api/auth/bind`（✅ 已有）：我的页「账号与安全」消费；解绑最后一种登录方式 `409 last_login_method` 需 toast 明示。
5. 密码登录（✅ 08 §3.0 `login-password`，已由 PC LoginForm 落地）：`{ "channel", "target", "password" }`，`channel` 由 PC 前端按账号格式自动判定（手机号正则 → `sms`，否则 `email`）；**注册后手机号/邮箱即账号**，登录 tab「密码/验证码」方式切换见 01 §9.5。错误分流：`404 account_not_found` 同款「去注册」引导；`401 password_not_set`（微信注册/历史验证码账号）toast「该账号未设置密码」+ 文字链「验证码登录」「忘记密码」；`401 invalid_credentials` 行内「账号或密码不对」；`429 too_many_attempts`（同账号错 5 次锁 15 分钟）明确提示等待时长。
6. 注册带密码（✅）：`verify(intent=register)` 增 `password`（8–64 位、四类字符≥3 类，`400 weak_password` **不核销验证码**——PC 行内修正后同码重交）；「确认密码」两行一致性纯前端校验；注册成功 toast「注册成功」+ 自动登录（现行落点不变）。
7. 忘记密码（✅，卡内三步浮层已落地）：入口 = 登录卡密码方式下「忘记密码？」文字链；先复用 `request-code` 发码（60s 倒计时同款），再 `POST /api/auth/reset-password {channel,target,code,password}`；`400 invalid_code` → 「验证码错误」；成功**不自动登录**，PC 落「密码已重置」完成态并【去登录】切回登录 tab·密码方式（回填账号）。对未设密码的老账号即首次设置密码，交互一致。

---

## 四、PC 端消费注意（前端约束）

1. **时区**：`createdAt` 为 UTC ISO 串，前端换算本地时区/相对时间（承接 08/09 已知待办③）。
2. **打码**：直接渲染 `senderMasked`/`nameMasked`，任何位置不得出现完整真实姓名；接口不会下发未打码姓名。
3. **权限**：一律读视图模型 `viewerRole`（owner > collaborator > member > guest），前端不自行推断。
4. **轮询**：`/api/items/generate?jobId=` 生成中轮询间隔 ≥3s，指数退避，页面隐藏时暂停（PC 多标签场景强制）。
5. **幂等**：写操作携带幂等键的接口（items/generate 等）在多标签/重试场景下复用同一键，规则同 08。
6. **多标签一致性**：供桌/灯亮状态以服务端为准；供奉成功响应即最新状态，前端据此刷新，不做本地乐观推测付费项。
7. **埋点**：上报携带 `platform: "web-pc"`（仅分析维度，不影响业务）。

---

## 五、验收口径（API 层）

1. 分页三接口：空列表、单页、多页、到底（`nextCursor=null`）、非法 `cursor`（`400 bad_request`）五态冒烟。
2. chat history：`inferred`/`evidence` 有无两态 + 游客 401 + 清空后返回空 `items`。
3. orders：金额单位为分、四种状态枚举、`401` 游客。
4. 回归 08 文档全部 ✅ 冒烟（hall/messages/memories/chat/family-gift/garden/me-memorials），PC 消费不得破坏既有断言。
5. 红线扫描：接口与字段层面无虚拟币/充值/礼包/打榜/倒计时促销字样。
6. 星海正式回归（✅ 2026-09-01）：starsea 分片/bbox/游标参数、择位 409 建议位与 403 分流、canonical 路由重定向，统一走 `node --experimental-strip-types tools/test-starsea-formal.mjs` + `npx playwright test tests/e2e/starsea.spec.ts --project=desktop-chromium --project=mobile-chromium`（契约与旅程双轨，08 §3.13）。
