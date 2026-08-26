<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 线上祭奠产品市场调研 — 共享上下文

任何调研步骤开始前必须先读本节并严格遵守；本节内容对所有步骤自动继承，用户不再重复说明。

## 产品方向
线上祭奠

## 调研对象
所有有祭奠需求的人，想要纪念怀念的人

## 文档链路
网络上的数据 → MRD → BRD → PRD，四步各产出一份文档：

1. `docs/01-数据报告.md` — 网络真实评论数据的采集与整理
2. `docs/02-MRD.md` — 市场需求文档
3. `docs/03-BRD.md` — 商业需求文档
4. `docs/04-PRD.md` — 产品需求文档

- 后一份文档动笔前必须先读取前一份的产物，在已有结论之上推进；不重复分析已有结论，不重复询问用户已确认的信息
- 链路内只认 01–04 编号的产物；`docs/` 中既有开发文档（如 PRD-彼岸3.0.md）不属于本调研链路
- 每完成一步，更新下方「当前进度」

## 存放规范
- 调研文档一律写成 Markdown 放 `docs/`；数据文件（CSV）放 `data/`，文件名以编号开头与文档对应（如 `data/01-评论数据.csv`）
- `data/` 中既有的 bian.db 等为应用运行数据，调研只新增 CSV，不改动既有文件
- 根目录留给后续开发代码，不放调研文档和数据

## 数据规范
- 所有结论、数字、引用必须来自真实采集到的评论数据，禁止编造；来源不可核实的信息须明确标注或不采用
- 任何文档中不展示可识别个人身份的信息：用户名一律打码（如「李**」）或以「用户A/B」代称，或不展示

## 当前进度
- [x] 第 1 步：数据采集 → `docs/01-数据报告.md` + `data/01-评论数据.csv`（2026-08-22 完成：11 个信源、36 条引述样本，需求侧结论与行业数据就绪）
- [x] 第 2 步：MRD → `docs/02-MRD.md`（2026-08-22 完成：11 条市场需求 MR-01~11、5 类用户细分 P0–P4、竞争格局与定位空位、移交 BRD 的 6 项决策清单）
- [x] 第 3 步：BRD → `docs/03-BRD.md`（2026-08-22 完成：免费+一口价+88 元开关式年卡模式、C 端先行路径、12 条业务需求 BR-01~12、北极星指标 WAR、2027 清明倒排里程碑；品牌建议保留"彼岸"+全称区隔，待用户拍板）
- [x] 第 4 步：PRD → `docs/04-PRD.md`（2026-08-22 完成：12 组功能需求 FR-01~12 + 6 项 NFR + 版本规划（V1.0 MVP 至 V2.0）+ 全链路需求追踪矩阵。**四步调研链路全部完成**，可循矩阵逐条溯源至真实采集数据）
- [x] 番外：产品 Showreel → `docs/05-Showreel导演方案.md` + `/showreel` 路由（2026-08-23 完成：30s @ 30fps 帧驱动动画，源码 `src/components/showreel/`，独立于 01–04 调研链路）
- [x] 番外：馆内多人合馆「长明灯阵」展示方案 → `docs/13-馆内多人合馆（长明灯阵）展示方案.md`（2026-08-23 用户拍板：一馆 1~6 位逝者 = 共享场景中的 N 盏灯，场景/抽屉/馆级公共三层，复用墓园交互模型；已同步 PRD 新增 FR-02b、数据库设计新增 B17/F7/M8）
- [x] 番外：园级「星海」方案（2026-08-23 用户拍板）——园—馆—人三级同构（灯→星群→星座）、缩放连续体、择位=关系排布、星域弱分区；全链路文档已同步：墓园规格 §8、13 号方案 §11、PRD（FR-02b/FR-07/信息架构）、09 数据库（B17 星海列/F8 GardenSeaView/M9）、web/01 §十、web/02 §八、web/03 映射表、08 §3.13 halls 族接口
- [x] 星海实施落地（2026-08-23 完成）：migrations/021（halls 加 in_garden/garden_x/garden_y/garden_zone）、GET /api/garden/starsea（zone/bbox 分片+脱敏+短缓存）、PATCH /api/halls/[id]/garden-pos（择位/409 建议位/移出）、原型 starsea 视图+择位模式、建馆接口同步建 halls 记录并透传 visibility；14 项回归全过（tools/test-starsea.cjs）；实现差异：馆内摆位落 memorials.lamp_x/lamp_y 而非 halls.layout_json
- [x] 番外：语音能力方案 → `docs/14-语音能力方案.md`（2026-08-23 用户拍板：语音识别/朗读**仅限交流对话框**，音色配置放角色创建，**B 档生前声音复刻开通**（授权+人工审核+「AI 合成声音」标识），MiMo API 服务端中转 + Vercel 环境变量 `OPENAI_API_KEY`/`OPENAI_BASE_URL`；**仅落文档、代码未实施**。已同步：PRD（FR-13/14、NFR-05/07、V1.5 版本行、追踪矩阵）、09 数据库（F9 VoiceProfileView/B18/M10）、08 API（§3.14 voice 族四接口 + 埋点）、web/01 §十一 + §4.4、web/02 §十、web/03 §3.6、前端具体设计流程 §2.4/§2.5、11 号方案 R2 向导、备案材料（MiMo 增补为第二家模型来源））
- [x] 语音能力实施落地（2026-08-23 完成）：迁移 022（memorials 音色四列 + voice_clones 表）、`lib/voice.ts`（MiMo 唯一出口 + 自有 SSE 合约 + 限频）、四接口（voice/asr、voice/tts、voice/preview、memorials/[id]/voice）、admin 审核动作 review_voice_clone + 审核区 UI（可试听样本）、F9 voiceProfile 随馆下发、前端 useVoiceInput/useVoicePlayer + HallChat 🎙/🔊/「AI 合成声音」角标 + 我的页「🎙 TA 的声音」配置面板；构建通过、语音冒烟 5/5（tools/test-voice.cjs）、回归 p1/p2/p4 全过；实现差异：B 档样本由 voice 路由 multipart 直传落 sample_url（不走 /api/upload + mediaId）、preview 需登录、tsconfig 排除 superpowers/；待做两项已全部完成（2026-08-24）：① 建馆向导内嵌声音子项——CreateMemorialForm 建馆成功后内嵌 VoiceSettingsPanel；② 隐私政策语音条款——privacy 页新增 §5「语音功能」中英双语条款（声纹属生物识别/仅传输 MiMo 用于当次识别合成/不用于模型训练/样本限期删除）（MiMo 真 key 已联调通过：2026-08-23 preset TTS 直连 200/SSE 正常，key 已配 .env.local）
- [x] Showreel 10s 星海版（2026-08-23 完成）：`/showreel?v=10` 原生 300 帧新片（非旧 900 帧倍速精剪，节奏适度）——星海点星 → 三星飞向灯位交接 → 长明灯阵聚焦外婆 → 按住 🎙 说话转写 → TA 的复刻声回答（AI 合成声音标识+记忆引用）→ 为全家点灯合祭错峰联动 → 灯位收敛回星海成星座 → 品牌；组件 `Scene10StarSea/Scene10Hall/Scene10Drawer/Showreel10Player`，导演方案 docs/05 §7，产物 `showreel/彼岸-产品介绍-10s-星海.mp4`（10.00s · H.264 · 30fps · 778KB）+ 封面；管线 `record-v10.cjs` 逐帧录制 + imageio-ffmpeg 合成；tsc 全过、12 关键帧目检无重叠截断
- [x] 登录/注册分离方案与实施（2026-08-24 用户拍板 + 同日二次拍板「手机/邮箱/微信三式平级」，**当日全部落地**）：废除「登录即注册」；默认进登录、注册专门点击 tab；登录与注册的手机/邮箱通道同构平级，微信为共同第三方式（昵称选填+协议必勾）。**实现**：迁移 023（auth_oauth_states.intent=M11）、verify 必填 `intent`（login→404 account_not_found；register→409 already_registered/400 agreement_required；缺 intent 400 missing_intent；**分流校验不核销验证码，tab 切换后同码可复用**；name 缺省「彼岸用户」）、wechat qrcode 带 intent + callback 按 intent 建号/拒（错误重定向 `/zh/login?error=wechat_*`）、埋点 register/login；PC LoginForm 双 tab + 协议勾选 + ?error 引导 + 访客链，login page 透传 error；原型 auth.html/auth.js/api.js 同构改造。**工具链适配**：15 处 verify 调用补 intent（smoke-p1/p2/p4/v2、check-* 五件、test-starsea/hall-lamps/w-features、smoke-auth、mobile-audit 固定邮箱注册 409 回落登录）。**验证**：tsc 零错、生产构建过、tools/test-auth-intent.cjs 12/12（含 60s 限频/409 同码复用/邮箱平级/微信降级）、旧回归 smoke-auth/p1/p2/p4 全过。文档已翻绿：08 §3.0（补核销时点入契约）、web/01 §9.4、web/02 §二、web/03 §3.7、09 M11、前端具体设计流程变更记录 9
- [x] 阿里云短信直连落地（2026-08-24 完成）：`lib/notify.ts` 接 `@alicloud/dysmsapi20170525`（SendSms，RAM 子账号 bian-sms 仅 AliyunDysmsFullAccess 权限），配置 `SMS_PROVIDER/SIGN_NAME/TEMPLATE_CODE/ACCESS_KEY_ID/SECRET` 五项（.env.local 已配、生产模板已补）；devCode 回显规则与邮件通道同构（dev/test 回显、生产绝不下发）；**测试号段 1XX-0000-XXXX 跳过真实发送**（test-auth-intent/w-features/starsea/hall-lamps 四件号码生成器已切换，防向陌生真机发码）；真机实测 delivered:true（153 尾号 8910）；回归 test-auth-intent 12/12 + smoke-auth + w-features 全过；SMS_WEBHOOK_URL 保留为未配置直连时的兜底通道
- [x] 番外：注册登录密码体系方案（2026-08-25 用户拍板 7 条，**仅落文档、代码未实施**）：注册即设密码（密码/确认密码两行 + 👁 划线眼睛/眼睛显隐；8–64 位且大写/小写/数字/特殊符号四类≥3 类；`weak_password` 不核销验证码）；**注册后手机号/邮箱即本产品账号**；登录 tab 增「密码/验证码」方式切换（默认密码、验证码方式保留）；「忘记密码」三步浮层（账号发码 → 验码 → 新密码+确认 → 回登录不自动登录，兼做老账号首次补设密码）；注册成功 toast「注册成功」+「账号与密码请妥善保管」弱提示；`invalid_code` 前端文案统一「验证码错误」；按键排布四段式（tab→方式/通道→输入组→动作区）。涉及：08 §3.0 增量（verify 带 password、`POST /api/auth/login-password`、`POST /api/auth/reset-password`、me 加 hasPassword、埋点 reset_password）、09 B12/B14 M12（users.password_hash/password_updated_at，bcrypt cost≥10，空串=未设密码，login_codes 零变更，对应迁移 024）、09 B15 红线第 6 条、web/01 §9.5（新增）、web/02 §二/§七/§九（清单 13–15）、web/03 §一/§3.7（第 5–7 条）、前端具体设计流程 §2.0 重写 + 变更记录 10。未设密码账号登录 `401 password_not_set`；密码错 5 次锁 15 分钟（(channel,target) 应用层滑动窗口，不新增表）
- [x] 注册登录密码体系实施落地（2026-08-25 当日完成）：迁移 024（M12 users 两列）、`lib/password.ts`（规则 8–64/四类≥3/禁空白 + bcryptjs cost10）、verify 注册必带 `password`（`weak_password` 不核销）、新接口 `POST /api/auth/login-password`（channel 可缺省服务端按格式推断；`404 account_not_found`/`401 password_not_set`/`401 invalid_credentials`；连错 5 次锁 15 分钟内存滑动窗口）与 `POST /api/auth/reset-password`（复用 request-code 发码；账号不存在/弱密码均不核销；成功不写会话）、`/api/me` 增 `hasPassword`；PC LoginForm 重写（方式切换/密码行 👁 SVG/忘记密码卡内三步浮层/`password_not_set` 双引导链/注册成功内联提示 1s 跳转）+ 中英词典；原型 auth.html/auth.js/api.js 同构（👁 用 FA fa-eye/eye-slash）。**工具链**：21 处 verify 注册调用补 `password`（Test1234!ok）。**验证**：tsc 零错、生产构建过、迁移已应用、冒烟 `tools/test-password-auth.cjs` 16/16（含 61s 限频等待段）、回归 test-auth-intent 12/12 + smoke-auth + smoke-p1/p2/p4 全过。**顺手修复**：/api/me groups 查询既有笔误 `g.group_id`→`gm.group_id`（未提交工作区版本致 /api/me 500）。文档已翻绿（08 §3.0/09 B12·M12/web/01 §9.5/web/02 §二·§七·§九/web/03 §3.7/前端具体设计流程 §2.0+变更记录 10）。**生产发布已完成（2026-08-26）**：master 71cfe1b + 迁移 024 已上线（/api/health ok、login-password 404 account_not_found 验证通过）。发布踩坑：npm ci 清掉 Turbopack 原生模块哈希别名（better-sqlite3-90e2652d1716b047 / sharp-20c6a5da84e2135f）致全站 500，手工 ln -sfn 补链恢复；已把动态补链写入 deploy/apply-release.sh 与 deploy/deploy.sh 防复发，坑 9 记录在 07 运维手册；2G 内存机直接服务器构建易 OOM（先加 2G swap）。待做：隐私政策密码条款补充
