# 彼岸 · 墓园 2.0 需求文档（PRD）

- 版本：v0.2（关键决策已确认）
- 日期：2026-08-06
- 状态：可进入开发排期
- 现有底座：Next.js 16 + React 19 + better-sqlite3 + Stripe + 中英双语（`[lang]` 路由）

## 0. 决策记录（v0.2 确认）

| 编号 | 决策 |
| --- | --- |
| D1 | 登录三通道：微信扫码 + 邮箱验证码 + 手机号验证码，可互相绑定合并为同一账号 |
| D2 | 第三方服务全部国内：图片生成（通义万相：wan2.6-t2i 0.20 元/张，官网计费页 2026-08-07 核实 / 即梦 Seedream）、数字人（硅基智能 / 百度曦灵 / 火山引擎；腾讯智影已于 2025 年关停，剔除）、短信（阿里云 / 腾讯云）、内容审核（阿里云内容安全） |
| D3 | 免费用户配额：AI 祭品生成 3 次/月；媒体库 20 张照片 + 2 个视频/纪念馆；会员放宽（见 §6） |
| D4 | 匿名献花保留：未登录访客可对 public 纪念馆献官方免费祭品；留言可匿名 |
| D5 | 开放墓园视觉：偏写实（真实草地、石碑材质、自然光照），非卡通 |

## 0.1 现状与差距

| 能力 | 现状 | 差距 |
| --- | --- | --- |
| 用户体系 | `users` 表存在但无任何登录/会话实现 | 从零建设 |
| 文件上传 | 无，`avatar_url` 仅为文本字段 | 从零建设 |
| 祭品 | `items` 表 + emoji 图标，无图片 | 需写实资源 + 自定义上传 + AI 生成 |
| 可见性 | 所有 memorial 公开（`is_published`） | 需三级可见性 + 群组 |
| 媒体画廊 | 无 | 从零建设 |
| 数字人 | 无 | 从零建设（依赖国内第三方 API） |
| 开放墓园 | 首页为简单列表 | 需独立写实风可视化墓园页 |

## 1. 功能一：写实祭品系统 + AI 自定义祭品

### 1.1 目标
祭品从 emoji 升级为写实风格图片；用户可上传自己的图片或用文字描述调用图片生成模型生成专属祭品。

### 1.2 功能需求
- F1.1 官方祭品库扩充：分类保留并扩展（鲜花 / 灯烛 / 食品 / 祭仪 / 物件 / 高级），每个祭品配写实风格图片（透明底 PNG/WebP，统一光照与视角规范）。
- F1.2 祭奠界面改版：祭品以图片网格呈现，选中后叠加到墓碑场景上（非 emoji 列表）；保留留言与「燃烧中」动效语义。
- F1.3 用户上传祭品：登录用户可上传图片作为自定义祭品（JPG/PNG/WebP，≤5MB，自动裁剪为正方形缩略图）。
- F1.4 AI 生成祭品：用户输入文字描述（如「一束白色马蹄莲，写实摄影风」），调用**国内图片生成 API（通义万相 / 即梦 Seedream，provider 适配器隔离）**产出 2~4 张候选图，用户选一张入库。
- F1.5 自定义祭品归属：自定义祭品绑定创建者，默认仅自己可用；**免费用户每月 3 次 AI 生成配额，会员不限（D3）**。
- F1.6 审核：AI 生成与上传图片入库前过**阿里云内容安全（图片+文本）**；失败给明确原因。MVP 可先人工后台审核兜底。

### 1.3 数据模型变更
```sql
ALTER TABLE items ADD COLUMN image_url TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN style TEXT DEFAULT 'emoji';      -- emoji | realistic | custom
ALTER TABLE items ADD COLUMN owner_user_id TEXT DEFAULT '';   -- 空 = 官方
ALTER TABLE items ADD COLUMN source TEXT DEFAULT 'official';  -- official | upload | ai
ALTER TABLE items ADD COLUMN prompt TEXT DEFAULT '';          -- AI 生成时的描述
ALTER TABLE items ADD COLUMN review_status TEXT DEFAULT 'approved'; -- pending | approved | rejected

CREATE TABLE ai_quotas (           -- AI 生成配额计数
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,             -- '2026-08'
  used INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
```

### 1.4 API
- `POST /api/items/upload`（multipart，登录）
- `POST /api/items/generate`（JSON `{prompt}` → 同步等待 ≤60s 或任务轮询）
- `GET /api/items?scope=official|mine`

## 2. 功能二：用户登录（三通道） + 群组共同缅怀

### 2.1 目标
建立完整账号体系；纪念馆默认私密，所有者可向选定群组开放，群组成员共同缅怀。

### 2.2 功能需求
- F2.1 登录三通道（D1）：
  - **微信扫码**：微信开放平台「网站应用」扫码 OAuth，拿 `openid/unionid`；需企业资质认证，未下来前先用另两通道；
  - **邮箱验证码**：6 位码，10 分钟有效，5 次错误作废；
  - **手机号验证码**：阿里云/腾讯云短信，同上规则，同号 60s 重发间隔、单 IP 日限 20 条防刷。
- F2.2 账号合并：`users` 同时挂 `email / phone / wechat_openid / wechat_unionid`，任一通道首登自动建号；个人中心可绑定其余通道；同 `unionid` 多端归一。
- F2.3 会话：httpOnly cookie，7 天滑动续期；`getSessionUser()` 服务端统一读取。
- F2.4 所有权：创建纪念馆必须登录，`memorials.user_id` 强制写入；现有匿名数据保留为「无主」（暂不实现认领流程）。
- F2.5 可见性三级：
  - `private`（默认）：仅所有者可见；
  - `group`：所有者 + 指定群组成员可见、可祭奠；
  - `public`：所有人可见，可被选入开放墓园（见功能四）。
- F2.6 群组：用户可创建「缅怀群组」（如家庭群），生成邀请链接/邀请码；成员通过链接加入。角色：`owner` / `member`，owner 可移除成员。
- F2.7 共同缅怀：group 可见的纪念馆，群组成员均可献祭品、留言，留言显示昵称；所有者保留删除权。
- F2.8 匿名规则（D4）：**public 纪念馆未登录可匿名献官方免费祭品（保留现网行为）；留言可匿名或登录昵称；自定义祭品、AI 生成、付费祭品、数字人必须登录。**
- F2.9 个人中心 `/[lang]/me`：我的纪念馆、我的群组、我的自定义祭品、绑定管理、会员状态。

### 2.3 数据模型变更
```sql
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN wechat_openid TEXT;
ALTER TABLE users ADD COLUMN wechat_unionid TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT '';
ALTER TABLE memorials ADD COLUMN visibility TEXT DEFAULT 'private'; -- private | group | public

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_openid ON users(wechat_openid) WHERE wechat_openid IS NOT NULL;

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE login_codes (
  channel TEXT NOT NULL,           -- email | sms
  target TEXT NOT NULL,            -- 邮箱地址或手机号
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0
);
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);
CREATE TABLE memorial_groups (   -- 纪念馆授权给哪些群组
  memorial_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  PRIMARY KEY (memorial_id, group_id)
);
```

### 2.4 权限判定（服务端统一函数 `canView(memorial, user)` / `canTribute(...)`）
- private：仅 owner；
- group：owner 或授权群组任一成员；
- public：任何人可看；献官方免费祭品可匿名，其余动作需登录（D4）。

### 2.5 API
- `POST /api/auth/request-code`（`{channel: email|sms, target}`）
- `POST /api/auth/verify`（`{channel, target, code}`）
- `GET /api/auth/wechat/qrcode` / `GET /api/auth/wechat/callback`（微信扫码）
- `POST /api/auth/logout` / `POST /api/auth/bind`（绑定其余通道）
- `GET /api/me`（用户 + 群组 + 纪念馆列表）
- `POST /api/groups` / `POST /api/groups/join` / `DELETE /api/groups/:id/members/:uid`
- `PATCH /api/memorials/:id`（含 visibility、授权群组变更，仅 owner）

## 3. 功能三：视频数字人

### 3.1 目标
用户上传逝者照片（必传）、视频（可选）、声音样本（可选），生成可说话的数字人视频，嵌入纪念馆页。

### 3.2 功能需求
- F3.1 素材采集向导：分三步——正脸照片（≥1 张，引导清晰度要求）、声音样本（≥30 秒 WAV/MP3，可选）、参考视频（可选）。上传前展示《肖像与声音授权声明》，必须勾选「我是近亲属/已获授权」。
- F3.2 生成流水线：创建任务 → 调**国内数字人 API（硅基智能 / 百度曦灵 / 火山引擎，provider 适配器隔离，D2）**→ webhook 回调落库 → 纪念馆页展示。
- F3.3 文案驱动：用户输入希望数字人说的话（≤500 字）或选择「朗读生平简介」；若克隆了声音则用克隆声，否则用默认音色。
- F3.4 配额与付费：仅 premium 会员可用，每纪念馆 1 次免费生成，重做走 Stripe 一次性支付（或后续接微信支付——国内主体长期建议迁微信支付/支付宝）。
- F3.5 风控：生成视频强制加水印「AI 生成」；任务进入人工审核队列，通过后展示；禁止名人生成（MVP 靠人工审核）。
- F3.6 状态展示：任务状态 `pending → processing → reviewing → done / failed`，失败退费/退配额。

### 3.3 数据模型
```sql
CREATE TABLE digital_humans (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  photo_url TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  video_url TEXT DEFAULT '',       -- 参考视频
  script TEXT DEFAULT '',
  result_video_url TEXT DEFAULT '',
  provider TEXT DEFAULT '',
  provider_job_id TEXT DEFAULT '',
  error TEXT DEFAULT '',
  consent_accepted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 3.4 合规要点
- 显式授权勾选 + 记录（`consent_accepted`）；
- 输出视频加水印「AI 生成」；
- 隐私政策补充 AI 生成条款；按《互联网信息服务深度合成管理规定》做**深度合成算法备案**（国内主体硬要求，立项后尽早启动，周期长）；
- 供应商侧签署数据保密与删除协议，素材任务完成后限期删除。

## 4. 功能四：开放数字墓园（写实风）

### 4.1 目标
一个所有人可自由进入浏览的公共墓园空间，用户可自愿将纪念馆「安放」进去。

### 4.2 功能需求
- F4.1 入口：`/[lang]/garden`，首页加导航入口。
- F4.2 安放机制：`visibility = public` 的纪念馆，所有者在设置中勾选「安放至公共墓园」后进入；可随时迁出（迁出后回 private/group 语义）。
- F4.3 呈现（D5 写实风）：MVP 用 2D 写实场景——写实质感背景（真实草地、石碑材质、天空自然光照、昼夜/天气氛围可选），分区网格布局，每个墓位是一块写实墓碑卡片（头像 + 姓名 + 生卒年），点击进纪念馆页。V2 升级 2.5D/Three.js 写实漫游。
- F4.4 浏览能力：按分区浏览、搜索姓名、随机漫步（随机跳转一个墓位）、「今日新归人」区域。
- F4.5 访客祭奠：未登录可浏览、可匿名献官方免费祭品（D4）；其余动作需登录。
- F4.6 性能：墓位分页/虚拟滚动，首屏 ≤50 个墓位，头像走缩略图。

### 4.3 数据模型变更
```sql
ALTER TABLE memorials ADD COLUMN in_garden INTEGER DEFAULT 0;
ALTER TABLE memorials ADD COLUMN garden_section TEXT DEFAULT '';   -- 分区
ALTER TABLE memorials ADD COLUMN garden_slot INTEGER DEFAULT 0;    -- 墓位序号
```

### 4.4 API
- `GET /api/garden?section=&page=`（公开，仅返回 visibility=public AND in_garden=1 的摘要字段）
- `POST /api/memorials/:id/garden`（owner 安放/迁出）

## 5. 功能五：墓碑详情升级（纪念馆页）

### 5.1 目标
墓碑/纪念馆页承载完整人生档案：头像、生平、图片视频画廊、墓志铭。

### 5.2 功能需求
- F5.1 媒体画廊：所有者可上传照片（≤10MB/张）与视频（≤100MB/个，MP4/WebM），支持排序、配文（caption）、设封面；**免费用户 20 张照片 + 2 个视频/纪念馆（D3）**，会员放宽。
- F5.2 生平富文本：`biography` 升级为富文本（受限 Markdown：标题/加粗/链接/分段），服务端渲染并 sanitize。
- F5.3 页面结构（自上而下）：封面横幅 → 头像 + 姓名 + 生卒 + 墓志铭 → 数字人视频（若有）→ 生平 → 媒体画廊 → 祭奠区（写实祭品 + 留言流）。
- F5.4 时间轴（可选 V2）：生平大事按年份节点展示。

### 5.3 数据模型
```sql
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  memorial_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,              -- photo | video
  url TEXT NOT NULL,
  thumb_url TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  review_status TEXT DEFAULT 'approved',
  created_at TEXT DEFAULT (datetime('now'))
);
```

## 6. 横切需求

- 上传基础设施：`POST /api/upload` 统一入口，本地存 `public/uploads/`（MVP），接口层预留切换阿里云 OSS；图片服务端生成缩略图（sharp）。
- 审核后台：admin 增加「待审核」队列（自定义祭品、媒体、数字人任务），一键通过/拒绝。
- 双语：所有新 UI 文案进 `dictionaries.ts`，中英全量覆盖。
- 会员权益表：premium = AI 祭品不限次、媒体 200 照片 + 20 视频、数字人 1 次/纪念馆、自定义祭品公开分享；写入会员页。
- 支付现状提示：现有 Stripe 面向海外卡；若主体在国内，微信/支付宝收款需另立任务（不影响本 PRD 排期）。
- 合规：《用户协议》《隐私政策》新增 AI 生成内容、逝者数据处理条款；深度合成水印 + 算法备案（§3.4）。
- 埋点（轻量）：上传成功率、AI 生成成功率/成本、数字人任务成功率、登录通道分布。

## 7. 分期建议

| 阶段 | 内容 | 理由 |
| --- | --- | --- |
| P1（地基） | 三通道登录（微信资质未下时先邮箱+手机）、会话、三级可见性、群组、上传设施、媒体画廊（F5.1/F5.2） | 其他功能全部依赖账号与上传 |
| P2 | 写实祭品库 + 自定义上传 + AI 生成（功能一）、纪念馆页改版（F5.3） | 直接提升核心祭奠体验 |
| P3 | 开放数字墓园写实 2D 版（功能四） | 依赖可见性体系，独立性强 |
| P4 | 数字人（功能三）+ 深度合成备案 | 成本最高、合规最重，最后上 |
| V2 | 墓园 2.5D/3D、生平时间轴、微信/支付宝支付迁移 | 增强项 |

## 8. 遗留问题（非阻塞）

1. 微信开放平台「网站应用」资质谁去申请？（影响微信扫码上线时间，不阻塞邮箱/手机通道）
2. 数字人供应商三选一需要 POC 对比效果与单价（P4 前完成即可）。
3. 现有乱码 bug：`src/app/api/admin/route.ts` 里「未命名」字符串、`src/app/api/tribute/route.ts` 里「匿名」字符串编码损坏，写入库即脏数据——建议 P1 顺手修。

## 9. 实施状态（2026-08-06）

| 阶段 | 状态 | 验证 |
| --- | --- | --- |
| P1 登录/可见性/群组/上传/画廊 | 已完成 | npm run build + tools/smoke-p1.mjs 27/27 |
| P2 写实祭品 + 自定义上传 + AI 生成 + 纪念馆改版 | 已完成 | tools/smoke-p2.mjs 26/26（IMAGEGEN_PROVIDER=mock；配 DASHSCOPE_API_KEY 即走通义万相） |
| P3 开放数字墓园写实 2D | 已完成 | 随 smoke-p2 覆盖墓园放置/搜索/移除 |
| P4 数字人 | MVP 已完成（mock 供应商） | tools/smoke-p4.mjs 15/15 |

### P4 落地明细
- digital_humans 表按 §3.3 建表；授权勾选 consent_accepted 强制。
- 三步素材向导（照片必传 / 声音可选 / 参考视频可选）+ 文稿自定义或朗读生平（≤500 字），组件 src/components/DigitalHumanPanel.tsx，挂在纪念馆页（馆主可见）。
- 状态机 pending → processing → reviewing → done / failed；mock 供应商本地合成带「AI 生成」水印的占位素材；真实供应商在 src/lib/digitalhuman.ts 的 startDigitalHumanJob 接入，回调走 /api/digitalhumans/callback（DH_CALLBACK_SECRET 鉴权）。
- 配额：仅 premium，每纪念馆 1 次（status != failed 计数）；失败不占用配额。
- 审核：admin 后台新增数字人审核队列（通过 → done 展示 / 拒绝 → failed），生成结果对访客仅 done 可见并带「AI 生成」角标。
- 上传设施扩展音频（mp3/wav/m4a/aac ≤30MB），saveUpload 第三参 allowAudio，媒体库接口不受影响。
- 会员页 premiumFeatures 已写入数字人权益；词典中英全量。

### P4 遗留（对齐 §8）
1. 供应商 POC 未完成，DIGITALHUMAN_PROVIDER 目前只支持 mock。调研（2026-08-07，360 搜索+官网核实）：腾讯智影已关停（2025-04 公告 6/30 起暂停，官网维护中），候选更新为硅基智能（克隆数千元档，1 秒视频 1 工作日交付）/ 百度曦灵（会员制，月度约 199 元含克隆权益，政务金融合规经验）/ 火山引擎（3 分钟快速定制 2D 分身，视频合成市场均价 3-8 元/分钟）；深度合成备案：互联网信息服务算法备案系统，主体备案约 1 周 + 算法备案约 1 个月（按批次公示）。
3. 深度合成算法备案未启动（国内主体硬要求，周期长，建议立项即启动）。

## 10. 第二轮收尾（2026-08-06）

| 项 | 状态 |
| --- | --- |
| admin 接口鉴权 | 已完成：requireAdmin（ADMIN_EMAILS 白名单；未配置时 dev 放行、生产 fail-closed），后台 403 态 + 冒烟断言 |
| 轻量埋点 | 已完成：events 表 + trackEvent，覆盖 login 通道分布、media_upload 成功率、ai_generate 成功率/provider、dh_create/dh_job；admin 首页展示近 30 天统计 |
| Stripe 支付 | 已完成接线：/api/stripe（checkout：会员月/年订阅 + 数字人重做一次性 ¥29.9）+ /api/stripe/webhook（premium 开通/续期、dh_redo_credits 入账）；无密钥时 503 fail-closed，会员页按钮与数字人「付费重做」已接真实链路 |
| 数字人重做配额 | 已完成：dh_redo_credits 表，创建扣额度、失败自动退还（PRD F3.6） |
| 写实官方祭品 | 脚本就绪：tools/seed-official-items.mjs（万相 15 件写实生成 + 落库 image_url/style=realistic），待 DASHSCOPE_API_KEY 配置后一键执行 |
| 合规页面 | 已完成：/legal/privacy、/legal/terms（中英双语，含 AI 生成标识、逝者数据授权、声音克隆限制、素材限期删除条款），页脚已挂链接 |
| 乱码 bug（§8.3） | 已确认修复：admin「未命名」、tribute「匿名」均为正常 UTF-8 |

验证：npm run build 通过；smoke-p4 18/18（含匿名 admin 403、支付 fail-closed、事件统计断言）；smoke-p1 27/27、smoke-p2 26/26 回归无损。

## 11. 第三轮 V2 推进（2026-08-06）

| 项 | 状态 |
| --- | --- |
| 生平时间轴 | 已完成：life_events 表 + /api/timeline（增删、馆主权限、每馆 50 节点上限、文本过审）+ TimelineManager 编辑器 + 纪念馆页竖线时间轴（全员可见），中英词典 |
| 内容审核（F1.6） | 适配器完成：src/lib/moderation.ts，默认 fail-open 人工兜底；配 ALIYUN_GREEN_ACCESS_KEY_ID/SECRET 即走阿里云内容安全 2.0（TextModerationPlus，ACS3-HMAC-SHA256 签名）；已接入留言、媒体说明、祭品名称/AI prompt、数字人文稿、时间轴文本 |
| 墓园 2.5D | 已完成：src/components/GardenScene.tsx 鼠标视差四层（星空/远山/雾气/萤火）+ 分区地面透视倾斜 + 星星闪烁/萤火漂浮/雾漂动画，纯 CSS 无新依赖；smoke 断言 SSR 渲染标记 |
| 墓园 3D | 已完成：src/components/Garden3D.tsx Three.js 夜景墓园（月光/星穹 500 星/萤火 42/分区 sprite 标签/墓碑阵列 slab+半圆顶），OrbitControls 漫游 + raycast 点击进馆（6px 拖拽阈值），GardenViewSwitch 2D/3D 切换（next/dynamic ssr:false），新增 three 依赖；tools/visual-garden.mjs Edge headless 截图四轮调光验收 |

验证：npm run build 通过；新增 tools/smoke-v2.mjs 14/14；smoke-p1 27/27、smoke-p2 26/26、smoke-p4 18/18 回归无损；3D 场景截图 docs/shots/garden-3d.png 验收通过。

### 剩余外部依赖（非代码工作）
1. ~~DASHSCOPE_API_KEY → 跑 seed-official-items.mjs 写实化官方祭品，IMAGEGEN_PROVIDER 自动切真生成。~~ → 已由火山方舟 Seedream 替代（见 §12）。
2. 微信开放平台「网站应用」资质 → 微信扫码上线。
3. 数字人供应商 POC 三选一 → ~~接真数字人~~；已选火山方舟 Seedance（见 §12），待控制台开通视频模型 + 启动深度合成算法备案。
4. 阿里云内容安全 → 替换人工审核兜底（F1.6）。
5. V2 剩余：微信/支付宝支付迁移（需商户号）。

## 12. 第四轮：火山方舟 Ark 接入（2026-08-16）

| 项 | 状态 |
| --- | --- |
| 生图 provider（ark） | 已完成：`src/lib/ark.ts` 共享客户端 + imagegen.ts ark 分支（Seedream `doubao-seedream-4-5-251128`，2048x2048 起步转 webp 1024 落盘）；实测生成成功 |
| 数字人 provider（ark） | 已完成：Seedance 异步任务（创建→后台 10s 轮询→下载 mp4 转存本地→reviewing）；素材 base64 data URI 提交（照片 sharp 压 1280px；音频 data URI 被拒时自动降级无参考音频）；`watermark: true`（F3.5）；画幅用户可选（9:16/16:9，migration 009 加 ratio 列）；时长按文稿 5/10s（DH_VIDEO_DURATION 可覆盖） |
| 失败退费（F3.6） | 已修复既有缺口：`refundRedoCredit` 统一 mock 失败 / ark 失败 / callback 失败 / dh-worker 超时四条路径 |
| smoke provider 感知 | 已完成：/api/health 暴露 activeProvider；smoke-p2/p4 检测非 mock 时跳过烧钱断言（p4 伪造 reviewing 任务保住审核链路覆盖） |
| 阻塞项 | **视频模型未在方舟控制台开通**（`doubao-seedance-2-5-260628` 返回 ModelNotOpen，含 1.x/2.x 全系探测均未开通）；开通或换 ARK_VIDEO_MODEL 即生效，代码无需改动 |
