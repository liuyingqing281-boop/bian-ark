# 彼岸 · 前端界面优化工作规划（V3 · P7/P8 执行版）

> 更新日期：2026-08-10
> 项目底座：Next.js 16.3 + React 19 + Tailwind CSS v4 + TypeScript 7 + 中英双语（/zh /en）
> 技能库：`E:\skills库\Final_Product_Library\02_全栈大前端包\`（FED 编码）
> 状态图例：⬜ 待开始 / 🔄 进行中 / ✅ 已完成

---

## 总览

| 阶段 | 名称 | 状态 | 优先级 | 说明 |
|------|------|------|--------|------|
| P0–P6 | 基线审计→验证回归 | ✅ 已完成 | 高 | 见 v2 文档，构建 39 路由 0 错误 |
| P7 | 深度增强 | ⬜ 待开始 | 高 | 性能、体验、视觉、可访问性二次打磨 |
| P8 | 智能化升级 | ⬜ 待开始 | 中 | AI 能力、个性化、数据可视化 |

> 已确认：`npm run build` 通过（编译 1927ms / TS 593ms / 39 页面 / 30 API 路由，0 错误 0 警告）。
> 已确认：快捷方式与 `启动彼岸.ps1` 未更新（时间戳 2026/8/7），dev server 运行正常（PID 102628），`server.log` 无 500 错误。

---

## 关键文件清单（P7/P8 目标）

| 文件 | 行数 | 优化方向 |
|------|------|----------|
| `src/components/ThemeBackground.tsx` | 481 | 大组件拆分、3D/粒子性能 |
| `src/components/MePanels.tsx` | 323 | 拆分、加载态、无障碍 |
| `src/components/Garden3D.tsx` | 291 | three.js 性能、resize/cleanup |
| `src/components/DigitalHumanPanel.tsx` | 281 | 媒体加载、骨架屏 |
| `src/components/OfferPanel.tsx` | 254 | 触控、响应式 |
| `src/components/GardenScene.tsx` | 203 | 场景渲染优化 |
| `src/components/LoginForm.tsx` | 145 | 微交互、错误态 |
| `src/app/[lang]/memorial/[id]/page.tsx` | 272 | 数据并行获取、Suspense、流式 |
| `src/app/[lang]/layout.tsx` | 82 | metadata、viewport、全局骨架 |
| `src/lib/db.ts` | 256 | 查询并行化辅助 |
| `src/app/globals.css` | 72 | 视觉 token 扩展、reduced-motion |

---

## P7 — 深度增强（⬜ 待开始 · 建议优先）

**目标**：把「能用」推到「亮眼 + 稳」。复用已建立的 tokens/组件，收益最高、风险可控。

### P7.1 渲染性能（高优先）

| 子任务 | 目标文件 | 使用 Skill | 状态 |
|--------|----------|-----------|------|
| 数据获取并行化：纪念馆页多查询并行，消除瀑布 | `[lang]/memorial/[id]/page.tsx` | `FED-0123 vercel-react-best-practices` | ⬜ |
| Suspense 流式加载边界（loading.tsx / Suspense 包裹） | `[lang]/memorial/[id]/*`、`[lang]/me` | `FED-7173 nextjs-app-router-patterns` | ⬜ |
| 大组件拆分：`ThemeBackground`（481 行）拆成 hooks + 子组件 | `ThemeBackground.tsx` | `FED-7908 component-refactoring` | ⬜ |
| 更新 `loading.tsx` 骨架屏（每个语言路由） | `[lang]/*/loading.tsx` | `FED-0131 frontend-enhancer` | ⬜ |

### P7.2 3D / 媒体性能（中优先）

| 子任务 | 目标文件 | 使用 Skill | 状态 |
|--------|----------|-----------|------|
| three.js 渲染循环节流、resize/cleanup、设备降级 | `Garden3D.tsx`、`GardenScene.tsx` | `FED-7889 optimization-mastery` | ⬜ |
| 图片懒加载 + 优先级标注（LCP 图 eager） | 各页面 `<Image>` | `FED-0123 vercel-react-best-practices` | ⬜ |
| 媒体面板骨架屏 + 渐进加载 | `DigitalHumanPanel.tsx`、`MediaManager.tsx` | `FED-0131 frontend-enhancer` | ⬜ |

### P7.3 移动端 & 触控（中优先）

| 子任务 | 目标文件 | 使用 Skill | 状态 |
|--------|----------|-----------|------|
| `dvh/svh` 视口单位替换 `100vh` | 各页面/布局 | `FED-7880 responsive-design` | ⬜ |
| touch-action、pointer-events、手势缩放 | `OfferPanel.tsx`、`Garden*` | `FED-7880 responsive-design` | ⬜ |
| 折叠式导航（移动端） | `[lang]/layout.tsx` | `FED-7227 tailwind-design-system` | ⬜ |

### P7.4 微交互 & 视觉再升级（中优先）

| 子任务 | 目标文件 | 使用 Skill | 状态 |
|--------|----------|-----------|------|
| hover/focus/active 反馈、加载 skeleton、滚动出现动画 | 各组件 | `FED-7876 interaction-design` | ⬜ |
| 乱序布局、渐变网格、噪点纹理、戏剧性阴影 | 首页/LoginForm/纪念页 | `FED-0278 frontend-design` | ⬜ |
| 视觉 token 扩展（全局 CSS 变量扩展） | `globals.css` | `FED-7875 design-system-patterns` | ⬜ |

### P7.5 无障碍全量审计（中优先）

| 子任务 | 目标文件 | 使用 Skill | 状态 |
|--------|----------|-----------|------|
| WCAG 2.2 全量审计（色对比、键盘、焦点管理） | 全站 | `FED-7255 wcag-audit-patterns` | ⬜ |
| keyboard trap 修复、focus-visible 统一 | 表单/弹窗/菜单 | `FED-7874 accessibility-compliance` | ⬜ |
| `prefers-reduced-motion` 降级动画 | `globals.css`、动效组件 | `FED-7874 accessibility-compliance` | ⬜ |

### P7.6 验证回归（高优先）

| 子任务 | 目标 | 使用 Skill | 状态 |
|--------|------|-----------|------|
| `npm run build` 全量构建验证 | 0 错误 0 警告 | `FED-7173 nextjs-app-router-patterns` | ⬜ |
| Playwright 视觉回归快照 | 关键路由 | `FED-7909 frontend-testing` | ⬜ |
| Lighthouse CI 性能/可访问性评分 | /zh、/login、/me | `FED-7889 optimization-mastery` | ⬜ |

---

## P8 — 智能化升级（⬜ 待开始 · 中优先）

**目标**：注入 AI 与个性化能力。涉及后端/API，需单独确认范围。

| 子任务 | 目标 | 使用 Skill | 状态 |
|--------|------|-----------|------|
| 站内搜索 / 纪念馆检索 | 全站搜索入口 + API | `FED-7194 react-state-management`（前端状态） | ⬜ |
| 悼念语生成（LLM 接入） | 一键生成悼念文字 | AI 工程 track（`openai-docs`）+ 后端 | ⬜ |
| 个性化主题切换（多主题） | `globals.css` 多套 token | `FED-7875 design-system-patterns`（multi-theme） | ⬜ |
| Admin KPI 仪表盘（数据可视化） | `[lang]/admin` | `FED-7150 kpi-dashboard-design` | ⬜ |
| SEO 元数据完善（OG、sitemap、structured data） | `layout.tsx`、metadata | `FED-0147 seo-mastery` | ⬜ |

---

## 执行建议

1. **先做 P7**：复用已建立 tokens/组件，收益最高、风险可控。
2. **每步小验证**：改一块跑一次 `npm run build`，避免积压错误。
3. **P7 做完再评估 P8**：P8 涉及后端/API，需单独确认范围。
4. 启动命令如需切生产模式，改 `启动彼岸.ps1`：`npm run build` + `npm start`（当前仍为 dev 模式）。
