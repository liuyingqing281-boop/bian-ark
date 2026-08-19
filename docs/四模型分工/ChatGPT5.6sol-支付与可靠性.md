# ChatGPT-5.6sol · 支付与可靠性 任务书

> 角色：资金链路与可靠性系统开发 ｜ 分支：feat/payment（从 master 切出）
> 开工前必读：`docs/四模型分工/README.md`（协作总纲与通用约定）

## 一、背景速读（先读代码再动手）

- 现有支付：Stripe（海外卡）已完整可用——`src/lib/stripe.ts`、`src/app/api/stripe/route.ts`（下单）、`src/app/api/stripe/webhook/route.ts`（回调）、会员页 `src/app/[lang]/membership/page.tsx`
- 数据表：`orders`（含 provider_session_id/provider_payment_id/error/refunded_at）、`payment_events`（event id 幂等）、`dh_redo_credits`（数字人重做额度发放）
- 业务意图两类：**premium 会员**（月/年订阅，开通与续期、到期降级）与 **dh_redo**（数字人付费重做，一次性）
- 目标：接入**微信支付 V3** 与**支付宝**，让国内用户可付（Stripe 保留）

## 二、任务清单

### 1. 支付 Provider 抽象（地基）

- 新建 `src/lib/payment/`：`types.ts`（PaymentProvider 接口：createPayment(intent) → {pay_url/qr, session_id}；verifyWebhook(raw, headers) → events）、`index.ts`（`getPaymentProviders()` 按 env 启用返回）
- 接口形状对齐现有 stripe 用法，使下单路由可多通道并存
- env 命名（写入 `.env.example`，密钥用户后填）：
  - `WECHAT_PAY_MCH_ID / WECHAT_PAY_API_V3_KEY / WECHAT_PAY_SERIAL_NO / WECHAT_PAY_PRIVATE_KEY / WECHAT_PAY_NOTIFY_URL`
  - `ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY / ALIPAY_NOTIFY_URL`
- 未配置 → 对应通道 503 fail-closed（对齐 stripe 现行为）

### 2. 微信支付 V3 适配器

- 场景：网站 → **Native 扫码支付**（PC）与 **H5 支付**（移动 UA 判断）
- 签名/验签按 V3 规范（平台证书下载与缓存、AES-256-GCM 解密回调）
- 回调幂等：event id 入 `payment_events` 唯一约束，重复回调返回成功不重复发权益

### 3. 支付宝适配器

- 场景：电脑网站支付（page.pay）+ 手机网站（wap）；RSA2 验签异步通知
- 同样幂等落库

### 4. 业务意图接线

- `POST /api/payment`：入参 `{kind: "premium_monthly"|"premium_yearly"|"dh_redo", memorial_id?}`，按可用通道返回支付跳转/二维码参数
- 回调 `POST /api/payment/webhook/:provider`：权益映射复用现有 webhook 逻辑（premium 开通/续期、dh_redo_credits 发放），**金额以分为单位整数校验**

### 5. 迁移

- `migrations/010_payment_providers.sql`：如需新列/新表（如 wechat 退款单号），用 `-- @add-column` 指令风格；不动既有表结构语义

### 6. 可靠性：备份恢复演练（Issue #16 遗留）

- 写 `docs/支付沙箱联调手册.md`：微信沙箱/支付宝沙箱环境变量、模拟回调命令、验签调试方法
- 执行一次 `tools/restore-check.mjs <backup.db>` 备份恢复演练，结果写入 `docs/部署运维日志.md`（新建）

## 三、验收（全部满足才可提请合并）

- [ ] `npx tsc --noEmit` 通过；`npm run smoke` 3/3；`npm run test:e2e` 40/40
- [ ] 新增 `tools/smoke-payment.mjs`：**mock provider** 全链冒烟（下单→回调成功→权益变化→重复回调幂等→失败回调不发权益），纳入 `npm run smoke` 序列（注意保持其余套件不回归）
- [ ] E2E：未配置通道时支付入口 503 的断言
- [ ] 词典：新增 `payment:` section（zh/en）；不改动 nav/membership 现有键
- [ ] 埋点：`trackEvent("payment_create", {provider, kind})` 与 `payment_webhook`（成功/失败）
- [ ] 安全自查：无密钥硬编码/日志；金额单位分；回调验签不可绕过（缺验签=阻断级）
- [ ] Opus-5 评审无阻断意见

## 四、边界

**可改**：`src/lib/payment/`（新建）、`src/app/api/payment/`（新建）、`migrations/010_*`、`tools/smoke-payment.mjs`、`dictionaries.ts`（仅 `payment:` section）、`.env.example`、支付相关文档
**禁改**：stripe 既有文件（除非接口适配必需，需在 PR 说明）、数字人/提示词/纯视觉文件

## 五、发现上报（记录处）

边界外问题记到本节随 PR 提交，由集成方转 Issue。
