# 彼岸 · 前端界面优化工作规划

> 生成日期：2026-08-10
> 项目底座：Next.js 16 + React 19 + Tailwind CSS + TypeScript + 中英双语
> 技能库位置：`E:\skills库\Final_Product_Library\02_全栈大前端包\`

---

## 阶段总览

| 阶段 | 名称 | 周期 | 优先级 | 核心技能 |
|------|------|------|--------|----------|
| P0 | 基线审计 | Day 1 | ★★★★★ | `vercel-react-best-practices`, `web-design-guidelines`, `frontend-code-review` |
| P1 | 性能优化 | Day 1-3 | ★★★★★ | `vercel-react-best-practices`, `optimization-mastery`, `next-best-practices` |
| P2 | 设计系统搭建 | Day 3-5 | ★★★★☆ | `design-system-patterns`, `tailwind-design-system`, `ui-ux-pro-max` |
| P3 | 视觉重构 | Day 5-8 | ★★★★☆ | `frontend-design`, `visual-design-foundations`, `ui-ux-pro-max` |
| P4 | 响应式 + 动效 | Day 8-10 | ★★★☆☆ | `responsive-design`, `interaction-design`, `motion` |
| P5 | 无障碍 | Day 10-11 | ★★★☆☆ | `accessibility-compliance`, `wcag-audit-patterns` |
| P6 | 验证回归 | Day 11-12 | ★★★★☆ | `performance-lighthouse-runner`, `ui-visual-validator`, `frontend-code-review` |

---

## P0 — 基线审计（Day 1）

### 目标
建立当前项目的性能基准、代码质量画像、UI 合规现状，为后续优化提供量化参照。

### 任务清单

| # | 任务 | 涉及文件/范围 | 使用技能 | 进度 |
|---|------|--------------|----------|------|
| 0.1 | 运行 Lighthouse 审计，记录 FCP / LCP / TBT / CLS / INP 基线 | 全站首页、纪念馆页、花园页 | `performance-lighthouse-runner` | ⬜ |
| 0.2 | 代码规范审查：RSC 边界、数据获取模式、组件拆分 | `src/app/**`, `src/components/**` | `vercel-react-best-practices`, `next-best-practices` | ⬜ |
| 0.3 | UI 合规审查：Tailwind 使用、布局一致性、语义化 | `src/**/*.{tsx,ts}` | `web-design-guidelines` | ⬜ |
| 0.4 | 前端代码深度评审：性能分析 + 规范校验 + 核心风险探测 | `src/**/*.{tsx,ts}` | `frontend-code-review`（FED-3977） | ⬜ |
| 0.5 | 输出审计报告，确定优化优先级 | `docs/audit-report.md` | — | ⬜ |

---

## P1 — 性能优化（Day 1-3）

### 目标
消除明显的性能瓶颈，使 Lighthouse 核心指标提升至少 20%。

### 任务清单

| # | 任务 | 涉及文件/范围 | 使用技能 | 进度 |
|---|------|--------------|----------|------|
| 1.1 | **图片优化**：Next.js Image 组件化、懒加载、WebP 格式、响应式尺寸 | `src/components/*.tsx`, `public/` | `next-best-practices`, `vercel-react-best-practices` | ⬜ |
| 1.2 | **RSC 边界梳理**：合理划分客户端/服务端组件，减少 `"use client"` 滥用 | `src/app/**`, `src/components/**` | `next-best-practices` | ⬜ |
| 1.3 | **数据获取优化**：消除 waterfall、增加并行请求、使用 Streaming/Suspense | `src/app/**`, `src/lib/**` | `vercel-react-best-practices`, `optimization-mastery` | ⬜ |
| 1.4 | **Bundle 体积优化**：code-splitting、动态导入、Tree Shaking 审核 | `next.config.ts`, `package.json` | `vercel-react-best-practices`, `1k-performance`（FED-4637） | ⬜ |
| 1.5 | **重渲染优化**：React.memo、useMemo/useCallback 合理化、避免不必要的重渲染 | `src/components/**/*.tsx` | `react-performance`（FED-2532）, `1k-performance` | ⬜ |
| 1.6 | **字体优化**：font-display、subset、preload、减少 FOUT/FOIT | `src/app/layout.tsx`, `tailwind.config.ts` | `next-best-practices` | ⬜ |
| 1.7 | **3D 场景性能**：Garden3D/GardenScene 的渲染优化、LOD、帧率 | `src/components/Garden3D.tsx`, `GardenScene.tsx` | `optimization-mastery` | ⬜ |
| 1.8 | **INP 优化**：交互响应时间、事件处理批处理、长任务拆分 | 全局交互热点 | `optimization-mastery` | ⬜ |

---

## P2 — 设计系统搭建（Day 3-5）

### 目标
建立统一的设计 token 体系，使全局视觉一致性可维护。

### 任务清单

| # | 任务 | 涉及文件/范围 | 使用技能 | 进度 |
|---|------|--------------|----------|------|
| 2.1 | **设计 Token 定义**：色板（主色/辅色/语义色）、间距尺度、圆角、阴影、断点 | `tailwind.config.ts` | `design-system-patterns`（FED-7875）, `tailwind-design-system`（FED-7826） | ⬜ |
| 2.2 | **主题切换机制**：亮/暗/护眼模式，CSS 变量 + Tailwind dark mode | `globals.css`, `tailwind.config.ts` | `design-system-patterns`, `ui-ux-pro-max`（FED-7938） | ⬜ |
| 2.3 | **组件库模式**：提取通用组件（Button/Card/Modal/Input/Tabs），统一 API 和样式 | `src/components/ui/` | `tailwind-design-system`, `design-system-starter`（FED-1478） | ⬜ |
| 2.4 | **排版体系**：字体层级（h1-h6/body/caption）、行高、字重映射 | `globals.css`, `tailwind.config.ts` | `visual-design-foundations`（FED-7881）, `ui-ux-pro-max` | ⬜ |
| 2.5 | **设计文档**：Token 命名规范、组件使用指南 | `docs/design-system.md` | `design-system-patterns` | ⬜ |

---

## P3 — 视觉重构（Day 5-8）

### 目标
从「功能可用」升级到「情感化、高品质视觉体验」，匹配墓园 2.0 的写实偏肃穆调性。

### 任务清单

| # | 任务 | 涉及文件/范围 | 使用技能 | 进度 |
|---|------|--------------|----------|------|
| 3.1 | **首页视觉重构**：Hero 区、墓园入口氛围、情感化视觉引导 | `src/app/[lang]/page.tsx`, `src/components/` | `frontend-design`（FED-0278 / FED-7675）, `ui-ux-pro-max` | ⬜ |
| 3.2 | **纪念馆页面**：墓碑展示、祭品网格、留言区的视觉层级和信息密度 | `src/app/[lang]/memorial/[id]/page.tsx` | `frontend-design`, `ui-ux-pro-max` | ⬜ |
| 3.3 | **花园（Garden）**：3D 场景 UI 叠加层、HUD 风格、操作提示 | `src/app/[lang]/garden/page.tsx`, `src/components/Garden3D.tsx` | `frontend-design`, `ui-ux-pro-max` | ⬜ |
| 3.4 | **登录/注册页**：三通道登录（微信/邮箱/手机）的 UI 流程优化 | `src/app/[lang]/login/page.tsx`, `src/components/LoginForm.tsx` | `frontend-design`, `interaction-design`（FED-7876） | ⬜ |
| 3.5 | **Admin 面板**：数据表格、操作面板、响应式布局 | `src/app/[lang]/admin/page.tsx` | `frontend-design`, `ui-ux-pro-max` | ⬜ |
| 3.6 | **数字人面板**：AI 数字人交互界面视觉 | `src/components/DigitalHumanPanel.tsx` | `frontend-design`, `ui-ux-pro-max` | ⬜ |
| 3.7 | **状态与空态**：loading / empty / error / 首次体验引导 | 全局 | `interaction-design`, `ui-ux-pro-max` | ⬜ |
| 3.8 | **色彩与氛围匹配**：整体色温、渐变、透明度契合墓园调性 | `globals.css`, `tailwind.config.ts` | `visual-design-foundations`, `ui-ux-pro-max` | ⬜ |

---

## P4 — 响应式 + 动效（Day 8-10）

### 目标
全端适配 + 流畅的微交互，使各端体验一致且富有情感。

### 任务清单

| # | 任务 | 涉及文件/范围 | 使用技能 | 进度 |
|---|------|--------------|----------|------|
| 4.1 | **移动端适配**：容器查询、流体排版、触摸友好尺寸 | 全局页面 | `responsive-design`（FED-7880）, `Frontend Responsive Design Standards`（FED-0224） | ⬜ |
| 4.2 | **微交互打磨**：按钮反馈、hover 效果、过渡动画、加载骨架屏 | `src/components/ui/` | `interaction-design`（FED-7876） | ⬜ |
| 4.3 | **页面过渡**：路由切换动画、入场/退场动效 | `src/app/[lang]/layout.tsx` | `motion`（FED-3714）, `interaction-design` | ⬜ |
| 4.4 | **祭品动效**：燃烧动画、放置祭品、献花反馈 | `src/components/`, `src/app/[lang]/memorial/` | `motion`, `interaction-design` | ⬜ |
| 4.5 | **3D 场景 UI 适配**：Garden 页面在不同屏幕尺寸下的布局 | `src/app/[lang]/garden/page.tsx` | `responsive-design` | ⬜ |
| 4.6 | **打印样式**：纪念馆回顾页面的打印优化 | `globals.css` | — | ⬜ |

---

## P5 — 无障碍（Day 10-11）

### 目标
达到 WCAG 2.2 AA 标准，覆盖关键用户路径。

### 任务清单

| # | 任务 | 涉及文件/范围 | 使用技能 | 进度 |
|---|------|--------------|----------|------|
| 5.1 | **语义化审计**：heading 层级、landmark、aria-label 缺失 | 全局模板 | `accessibility-compliance`（FED-7874）, `wcag-audit-patterns`（FED-7781） | ⬜ |
| 5.2 | **键盘导航**：Tab 顺序、焦点管理、Skip to content | 全局交互组件 | `accessibility-compliance` | ⬜ |
| 5.3 | **色彩对比度**：文本/背景对比度检查，语义色对比度合规 | `tailwind.config.ts`, `globals.css` | `accessibility-compliance`, `visual-design-foundations` | ⬜ |
| 5.4 | **屏幕阅读器**：动态内容 aria-live、表单错误关联、图片 alt 文本 | 全局 | `accessibility-compliance` | ⬜ |
| 5.5 | **减少动效**：prefers-reduced-motion 支持 | 全局 | `accessibility-compliance` | ⬜ |

---

## P6 — 验证回归（Day 11-12）

### 目标
量化验证优化效果，确保无回归。

### 任务清单

| # | 任务 | 涉及文件/范围 | 使用技能 | 进度 |
|---|------|--------------|----------|------|
| 6.1 | **Lighthouse 复测**：对比 P0 基线数据 | 全站 | `performance-lighthouse-runner`（FED-3580） | ⬜ |
| 6.2 | **视觉回归测试**：核心页面截图对比，组件合规验证 | 全局 | `ui-visual-validator`（FED-7246） | ⬜ |
| 6.3 | **UI 合规复检**：对照 web-design-guidelines 逐条验证 | 全站 | `web-design-guidelines`（FED-0911 / FED-7610） | ⬜ |
| 6.4 | **前端代码最终评审** | 所有修改文件 | `frontend-code-review`（FED-3977） | ⬜ |
| 6.5 | **输出优化报告**：变更清单、指标对比、剩余问题 | `docs/optimization-report.md` | — | ⬜ |

---

## 技能速查索引

| 技能名称 | SKU | 来源路径 | 适用场景 |
|----------|-----|----------|----------|
| `vercel-react-best-practices` | FED-4062 | Vercel Engineering | React/Next.js 性能优化核心 |
| `next-best-practices` | FED-0121 | ai-fuxi | Next.js 具体 API 规范 |
| `optimization-mastery` | FED-7889 | xenitv1 | 深度性能优化（INP、Partial Hydration） |
| `web-design-guidelines` | FED-0911 / FED-7610 / FED-0124 | Vercel / Cal.com | UI 合规审查 |
| `frontend-code-review` | FED-3977 | langgenius/dify | 前端深度代码评审 |
| `performance-lighthouse-runner` | FED-3580 | jeremylongshore | Lighthouse 自动化 |
| `1k-performance` | FED-4637 | onekeyhq | React 渲染优化 |
| `react-performance` | FED-2532 | hoangnguyen0403 | React 性能策略 |
| `design-system-patterns` | FED-7875 | wshobson | 设计系统 + Token |
| `tailwind-design-system` | FED-7826 / FED-7227 | wshobson / sickn33 | Tailwind 设计系统 |
| `design-system-starter` | FED-1478 | davila7 | 设计系统脚手架 |
| `ui-ux-pro-max` | FED-7938 | zhom | 全栈 UI/UX 设计引擎 |
| `frontend-design` | FED-0278 / FED-7675 / FED-7926 | anthropics / wei / yyh211 | 高质量前端界面生成 |
| `visual-design-foundations` | FED-7881 | wshobson | 视觉基础（色彩/字体/间距） |
| `interaction-design` | FED-7876 | wshobson | 微交互 + 动效 |
| `responsive-design` | FED-7880 | wshobson | 响应式布局 |
| `Frontend Responsive Design Standards` | FED-0224 | am-will-codex | 响应式标准 |
| `motion` | FED-3714 | jezweb | 动效设计 |
| `accessibility-compliance` | FED-7874 | wshobson | WCAG 2.2 合规 |
| `wcag-audit-patterns` | FED-7781 | wshobson | WCAG 审计模式 |
| `ui-visual-validator` | FED-7246 | sickn33 | 视觉回归验证 |

---

## 使用方式

执行每个任务时，直接说：

> 激活 `{skill-name}`，处理 `{task-name}`

例如：

> 激活 `vercel-react-best-practices`，处理 RSC 边界梳理  
> 激活 `ui-ux-pro-max`，重构首页视觉  
> 激活 `performance-lighthouse-runner`，做基线审计

进度标记：
- ⬜ 待开始
- 🔄 进行中
- ✅ 已完成
- ⏸ 阻塞/暂停

