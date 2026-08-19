# 四模型并行分工 · 协作总纲

> 2026-08-19 定稿 ｜ 单人开发者（刘贻清）+ 四 AI 并行 ｜ 所有参与者先读本文件

## 项目事实速查

| 项 | 值 |
|---|---|
| 产品 | 彼岸（线上墓园/纪念馆），核心闭环：建馆→进群→祭奠 |
| 生产站 | https://bianmuyuan.cn（阿里云轻量·香港） |
| 仓库 | github.com/liuyingqing281-boop/bian-ark（私有，master 为主干） |
| 技术栈 | Next.js 16 App Router + React 19 + TS strict + Tailwind 4 + better-sqlite3 |
| 本地开发 | `npm run dev` → http://localhost:3002 |
| 冒烟 | `npm run smoke`（p1/p2/p4 三套，~10s） |
| E2E | `npm run test:e2e`（Playwright 桌面+移动双端 40 用例，~45s） |
| 移动审计 | `node tools/mobile-audit-check.mjs <memorialId>`（溢出/触控/字号量测） |
| 发布 | 服务器执行 `bash deploy/deploy.sh`（备份→构建→迁移→重启→冒烟），**只有集成方执行** |
| 关键文档 | `docs/PRD-彼岸3.0.md`（定位）`docs/项目完成规划-单人模式.md`（当前规划）`docs/团队分工与任务清单.md`（历史） |

## 分工与分支

| AI | 角色 | 分支 | 任务书 |
|---|---|---|---|
| GLM5.3 | 主线全栈 + **集成发布** | master | `GLM5.3-主线与集成.md` |
| ChatGPT-5.6sol | 资金与可靠性 | feat/payment | `ChatGPT5.6sol-支付与可靠性.md` |
| Kimi-K3 | 前端工艺与审美 | feat/visual-polish | `KimiK3-前端工艺.md` |
| Opus-5 | 合规文档 + 合并前评审 | 不进代码库 | `Opus5-合规与评审.md` |

## 并行铁律（所有人必须遵守）

1. **文件边界即合同**：各任务书划定的「可改文件」之外一律不动；发现边界外的 bug，写到任务书「发现上报」节或开 Issue，不要顺手修
2. **词典分区**：`src/app/[lang]/dictionaries.ts` 是冲突高发区。规则：
   - 只**追加**自己专属前缀/专属 section 的键，**禁止修改他人现有键**
   - GLM：`prompt:` 新 section + `digitalHuman` 内 `err_ark_*`/助手键
   - GPT：`payment:` 新 section（nav/会员页现有键不动，确需新入口用 `pay_` 前缀）
   - Kimi：`visual:` 新 section
   - 改词典前先 `git pull --rebase`
3. **提交规范**：Conventional Commits，中文 subject（`feat:/fix:/docs:/chore: 描述`），一次提交一个主题
4. **通用代码约定**：
   - 错误码一律 snake_case 字符串（如 `payment_not_configured`），HTTP 映射：4xx 业务错 / 5xx 服务错
   - 供应商适配器模式：`activeProvider()` 显式 env 优先 → 按 key 存在推断 → mock 回落
   - 新功能必须：`trackEvent` 埋点（src/lib/events.ts）+ zh/en 双语文案 + smoke 断言
   - 涉及钱的金额单位一律「分」（整数）
   - 密钥只进 `.env.local`（本地）/ `.env.production`（服务器），`.env.example` 只留变量名；日志禁止打印密钥/完整 token
   - 数据库：新迁移按序号递增（如 `migrations/010_*.sql`），加列用 `-- @add-column 表 列 定义` 指令
   - 移动端硬指标：触控目标 ≥44px、正文 ≥12px、输入控件 ≥16px（pointer:coarse）、无横向溢出——改完 UI 用 `tools/mobile-audit-check.mjs` 自查
   - 视觉基调：深色石色系 + 烛光暖金（amber 系）、庄重克制；复用 `ui-panel`/`ui-section-ornate` 等既有类，不引新 UI 依赖
5. **回归门槛**（合并必要条件，缺一不可）：
   - `npx tsc --noEmit` 通过
   - `npm run smoke` 3/3
   - `npm run test:e2e` 40/40（双端）
   - Opus-5 评审无「阻断」级意见

## 集成时序（GLM5.3 执行）

```
feat/visual-polish ──┐
feat/payment ────────┼──► Opus-5 diff 评审 ──► GLM 合并（视觉→支付→主线）
master 新提交 ───────┘                              │
                                       三重回归（tsc/smoke/E2E/移动审计）
                                                    │
                                        服务器 deploy.sh 发布 → 生产验证
```

## 人工环节（AI 不可替代，刘贻清执行）

支付商户号申请、方舟视频模型开通、备案系统填报提交、真实用户邀请、每周五漏斗复盘（Opus 出模板）、服务器/域名续费、2027 年 1~6 月公司年报。
