# 彼岸 · 前端界面优化工作规划（V2）

> 更新日期：2026-08-10
> 项目底座：Next.js 16.3 + React 19 + Tailwind CSS v4 + TypeScript 7 + 中英双语（/zh /en）
> 技能库：`E:\skills库\Final_Product_Library\02_全栈大前端包\`（FED 编码）
> 状态图例：✅ 已完成 / 🔄 进行中 / ⬜ 待开始

---

## 总览

| 阶段 | 名称 | 状态 | 优先级 |
|------|------|------|--------|
| P0 | 基线审计 | ✅ 完成 | 高 |
| P1 | 性能优化 | ✅ 完成 | 高 |
| P2 | 设计系统 | ✅ 完成 | 高 |
| P3 | 视觉重构 | ✅ 完成 | 高 |
| P4 | 响应式适配 | ✅ 完成 | 中 |
| P5 | 无障碍改进 | ✅ 完成 | 中 |
| P6 | 验证回归 | ✅ 完成 | 高 |
| P7 | 深度增强 | ⬜ 待开始 | 中 |
| P8 | 智能化升级 | ⬜ 待开始 | 低 |

---

## P0 — 基线审计（✅ 完成）

**目标**：摸清家底，识别所有问题点，为后续阶段提供依据。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| 盘点路由、组件、依赖、构建配置 | ✅ | `FED-7616 web-design-guidelines`（审计 UI） |
| 定位 8 处原生 `<img>`、17 处 `use client`、30+ 无 Suspense 组件 | ✅ | `FED-7614 vercel-react-best-practices` |
| 检查 viewport 元数据、无障碍、可访问性缺口 | ✅ | `FED-7874 accessibility-compliance` |
| 输出审计报告 | ✅ | `FED-0131 frontend-enhancer` |

**成果**：8 个 `<img>`、17 个 `use client`、30+ 无 Suspense 组件、6 个 >200 行大组件、缺 viewport/a11y。

---

## P1 — 性能优化（✅ 完成）

**目标**：砍掉渲染与网络瓶颈，让页面更快。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| `next.config.ts` 图片优化（avif/webp、optimizePackageImports） | ✅ | `FED-7614 vercel-react-best-practices` |
| 12 处 `<img>` → `next/image`（跨 8 文件） | ✅ | `FED-7614` / `FED-7651 nextjs-react-expert` |
| 构建验证：39 路由 0 错误 0 警告 | ✅ | `FED-7823 nextjs-app-router-patterns` |

**遗留建议**：数据获取并行化、Suspense 流式加载、Lighthouse CI、大组件拆分 → 归入 P7。

---

## P2 — 设计系统（✅ 完成）

**目标**：建立统一的视觉语言与主题基础设施。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| CSS `@theme` tokens（amber/stone 色板、字体、圆角、动画） | ✅ | `FED-7875 design-system-patterns`（tokens/主题） |
| 自定义动画：fade-in、star-twinkle、particle-fall、candle-flicker 等 | ✅ | `FED-7876 interaction-design` |
| 工具类：spinner、shake、滚动条、选中样式 | ✅ | `FED-7826 tailwind-design-system` |

---

## P3 — 视觉重构（✅ 完成）

**目标**：告别通用 AI 感，做出「彼岸·墓园」产品化视觉。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| LoginForm 视觉/交互/加载态/错误抖动/a11y | ✅ | `FED-0278 frontend-design` / `FED-7876 interaction-design` |
| 首页 Hero：蜡烛分隔线、标题光晕、副标题排版 | ✅ | `FED-0278 frontend-design` |
| 布局：viewport/theme-color、skip-link、语义化 | ✅ | `FED-0278` / `FED-7874 accessibility-compliance` |

**注**：P3 已执行到「精致」档，P7 可再推一档到「难忘/极致」档（乱序布局、渐变网格、噪点纹理、戏剧性阴影）。

---

## P4 — 响应式适配（✅ 完成）

**目标**：桌面/平板/手机三端可用。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| Tailwind 响应式类（sm/md/lg、grid-cols、flex-wrap、h-48 md:h-64） | ✅ | `FED-7880 responsive-design` |
| 标题/封面/网格断点适配 | ✅ | `FED-0224 frontend-responsive-ui` |

**遗留**：触控优化（touch-action、pointer-events）、移动端手势、`dvh/svh` 单位 → 归入 P7。

---

## P5 — 无障碍改进（✅ 完成）

**目标**：WCAG 2.2 AA 级别可访问。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| skip-to-content、aria-label、role、语义化标签 | ✅ | `FED-7874 accessibility-compliance` |
| `next/image` 强制 alt | ✅ | `FED-7874` |
| `dir="ltr"`、footer role | ✅ | `FED-7874` |

**遗留**：键盘导航、焦点管理、reduced-motion、高对比 → 归入 P7（WCAG 全量审计用 `FED-7781 wcag-audit-patterns`）。

---

## P6 — 验证回归（✅ 完成）

**目标**：确保改动不破坏功能。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| `npm run build`：编译/类型/39 页面生成 | ✅ | `FED-7823 nextjs-app-router-patterns` |
| 变更文件清单核对（12 文件） | ✅ | — |

---

## P7 — 深度增强（⬜ 待开始 · 建议优先）

**目标**：把「能用」推到「亮眼 + 稳」。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| 数据获取并行化：纪念馆页多条 SQLite 查询并行 | ⬜ | `FED-7614 vercel-react-best-practices`（async- 消除瀑布） |
| Suspense 流式加载边界 | ⬜ | `FED-7823 nextjs-app-router-patterns` |
| 大组件拆分：ThemeBackground（482 行）等 | ⬜ | `FED-7908 component-refactoring` / `FED-0202 senior-frontend` |
| 触控/移动端优化（dvh、touch-action、手势） | ⬜ | `FED-0224 frontend-responsive-ui` |
| 微交互 polish：hover/focus/加载 skeleton/滚动动画 | ⬜ | `FED-7876 interaction-design` |
| 视觉再升级：乱序布局、渐变网格、噪点、戏剧阴影 | ⬜ | `FED-0278 frontend-design` |
| WCAG 全量审计 + reduced-motion + 高对比 | ⬜ | `FED-7781 wcag-audit-patterns` / `FED-7874` |
| 3D 花园（Garden3D/three.js）性能与沉浸优化 | ⬜ | `FED-7904`（或 three 专项） |
| Playwright 视觉回归 + Lighthouse CI | ⬜ | `FED-7909 frontend-testing` / `FED-0030 playwright-ci-caching` |

---

## P8 — 智能化升级（⬜ 待开始 · 低优先）

**目标**：注入 AI 与个性化能力。

| 子任务 | 状态 | 对应 Skill |
|--------|------|-----------|
| 站内搜索 / 纪念馆检索 | ⬜ | `FED-7896 frontend-ui-ux` / 后端为主 |
| 推荐/悼念语生成（LLM 接入） | ⬜ | `FED-7921 research` / AI 工程 track |
| 个性化主题（用户可切换多主题） | ⬜ | `FED-7875 design-system-patterns`（多品牌主题） |
| KPI 仪表盘（Admin 侧数据可视化） | ⬜ | `FED-7795 kpi-dashboard-design` |

---

## 执行建议

1. **先做 P7**：它复用已建立的 tokens/组件，收益最高、风险可控。
2. **每步小验证**：改一块跑一次 `npm run build`，避免积压错误。
3. **P7 做完再评估 P8**：P8 涉及后端/API，需单独确认范围。
4. 启动命令如需切生产模式，改 `启动彼岸.ps1`：`npm run build` + `npm start`（当前仍为 dev 模式）。
