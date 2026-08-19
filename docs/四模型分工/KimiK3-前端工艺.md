# Kimi-K3 · 前端工艺 任务书

> 角色：视觉工艺与审美（整条 B 线）｜ 分支：feat/visual-polish（从 master 切出）
> 开工前必读：`docs/四模型分工/README.md`（协作总纲与通用约定）

## 一、设计基调（不可偏离）

- **深色石色系 + 烛光暖金**（Tailwind stone-950 底 + amber 暖调点缀），庄重、克制、有呼吸感
- 参照已完成的 V01-V04 与 B2 基线：`docs/visual-baseline/`、`docs/shots/mobile-audit/`
- 既有设计 token/工具类优先复用：`ui-panel`、`ui-section-ornate`（居中饰线标题）、`ui-control`、`wall-scroll`（细金滚动条）
- **一句话判断标准**：像深夜灵堂的一盏烛，而不是像夜店的一串灯带

## 二、任务清单（按序）

### B2′ · B2 效果实调（0.5 天）

刚上线的 B2 改动如需调参：头像烛光晕环强度（`shadow-[0_0_44px_-10px_rgba(190,130,50,0.4)]`）、章节饰线亮度、墓志铭暖金浓度。以真实页面观感为准微调。

**验收**：截图前后对比入 `docs/shots/`；E2E 不回归。

### B3 · 公共墓园场景润色（2-3 天，主任务）

**文件**：`src/components/GardenScene.tsx`（2.5D 视差主场景）、`Garden3D.tsx`（Three.js 3D 模式）、`GardenViewSwitch.tsx`、墓园页 `src/app/[lang]/garden/page.tsx`

**方向**：
- 2.5D 场景层次：远景/雾气/萤火/星光四层的质感与节奏（石碑材质感、草地暗纹、雾的浓淡过渡）
- 墓位卡片（GardenScene 内 Link 卡）：头像/姓名/生卒的排布质感、hover 的克制光效、与场景的融合度
- 昼夜/主题氛围：与 `ThemeBackground` 的四季主题呼应（若联动成本高，先保证夜景基调统一）
- 3D 模式（Garden3D）：仅在加载与材质上做安全优化（贴图压缩、初始视角），不动交互结构

**验收**：
- [ ] `npx playwright test` 双端全过（garden 用例含 href 定位点击，改动勿破坏卡片结构）
- [ ] `node tools/mobile-audit-check.mjs` 六页全过（触控≥44px 等）
- [ ] 每个改动项附 `docs/shots/garden-b3-*.png` 前后对比
- [ ] 不引入新 npm 依赖（Three.js 已有；如确需，说明理由待集成方批）

### B5 · 动效与仪式反馈（1-2 天）

**文件**：`src/components/Flame.tsx`（Canvas 粒子火焰）、`OfferPanel.tsx`（供奉成功反馈）、`globals.css`

**方向**：
- Flame：锥形摇曳、明暗呼吸、粒子数与 `devicePixelRatio` 钳制（移动端 ≤1.5、粒子 ≤80，保证多燃烧条目不卡）
- 供奉提交成功后的仪式反馈：轻量的一次性动效（烛光轻颤/花瓣缓落，CSS 实现优先，≤1.2s，不阻塞表单）
- 全部动效尊重 `prefers-reduced-motion`（globals.css 已有 motion 变量体系）

**验收**：
- [ ] 移动端 3D/Canvas 页面滚动帧率无明显劣化（开发者工具 FPS 抽查记录在案）
- [ ] reduced-motion 开启时动效降级为静态
- [ ] E2E 双端 + 移动审计全过

### B7 · 无障碍细节（1 天）

- 对比度：正文文本对背景 ≥4.5:1（重点检查 stone-500/600 文案）
- 焦点可见：键盘 Tab 走查主要交互（导航/表单/祭品选择），焦点环统一用 amber
- 图片 alt：墓位/祭品/媒体 alt 语义化（走 `dictionaries.ts` 的 `visual:` section 加键，勿硬编码）

**验收**：抽查处列出修改清单；E2E 全过。

## 三、边界

**可改**：`src/components/GardenScene.tsx`、`Garden3D.tsx`、`GardenViewSwitch.tsx`、`Flame.tsx`、`ThemeBackground.tsx`（仅样式层）、`src/app/[lang]/garden/page.tsx`（仅样式类）、`src/app/globals.css`、`dictionaries.ts`（仅 `visual:` section）
**禁改**：任何业务逻辑、API、数据层；`OfferPanel.tsx` 仅限动效反馈挂钩处，不改提交逻辑

## 四、提交纪律

每完成一项（B3/B5/B7 各自）单独 commit 并推送分支；commit 附 `docs/shots/` 对比图路径；等 Opus-5 评审 + 集成方合并，**不自行合并 master**。

## 五、发现上报（记录处）

视觉走查中发现的结构问题（溢出、错位根因在逻辑层等）记到本节，随 PR 交集成方转 Issue。
