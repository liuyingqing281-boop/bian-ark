# 彼岸 · 线上墓园 — 前端优化工作规划

> 项目: Next.js 16.3 + React 19 + Tailwind CSS v4 + TypeScript 7
> 主题: 暗色石/琥珀色调 · 线上纪念/墓园
> 更新日期: 2026-08-10
> 快捷方式: ✅ 已确认（指向 `启动彼岸.ps1`，端口 3002 正常运行）

---

## 三个 Skills 库总览

### 1️⃣ `E:\skills库\Final_Product_Library\02_全栈大前端包\`（~7900 skills）

| 编号 | 技能名 | 用途 |
|------|--------|------|
| FED-7881 | visual-design-foundations | 视觉设计基础（颜色/间距/字体） |
| FED-7875 | design-system-patterns | 设计系统模式（Token/主题架构） |
| FED-7826 | tailwind-design-system | Tailwind 设计系统集成 |
| FED-7882 | web-component-design | Web 组件设计模式 |
| FED-7888 | frontend-design (xenitv1) | 前端设计指南 |
| FED-7926 | frontend-design (yyh211) | 前端设计 |
| FED-7876 | interaction-design | 交互设计（时序/缓动/反馈） |
| FED-0122 | ui-ux-pro-max | UI/UX 极致打磨 |
| FED-7938 | ui-ux-pro-max-v2 | UI/UX 极致（备选） |
| FED-7898 | frontend-ui-ux | 前端 UI/UX 优化 |
| FED-0124 | web-design-guidelines | 网页设计指南 |
| FED-0131 | frontend-enhancer | 前端功能增强 |
| FED-7880 | responsive-design | 响应式设计 |
| FED-7877 | mobile-android-design | Android 移动端设计 |
| FED-7878 | mobile-ios-design | iOS 移动端设计 |
| FED-7874 | accessibility-compliance | 无障碍合规 |
| FED-7781 | wcag-audit-patterns | WCAG 审计模式 |
| FED-7889 | optimization-mastery | 优化精通 |
| FED-0121 | next-best-practices | Next.js 最佳实践 |
| FED-0123 | vercel-react-best-practices | React 最佳实践 |
| FED-7908 | component-refactoring | 组件重构 |
| FED-7909 | frontend-testing | 前端测试 |
| FED-7823 | nextjs-app-router-patterns | App Router 模式 |
| FED-7825 | react-state-management | 状态管理 |
| FED-7835 | typescript-advanced-types | TypeScript 高级类型 |

### 2️⃣ `E:\skills库\skills\`（1 skill）

| Skill | 用途 |
|-------|------|
| find-skill | 在 skills 库中搜索匹配的 skill |

### 3️⃣ `E:\skills库\mattpocock-skills\skills\engineering\`（17 skills）

| Skill | 用途 |
|-------|------|
| implement | 按规范/票证实现功能 |
| codebase-design | 深度模块设计、接口优化 |
| code-review | 双轴代码审查（标准/规范） |
| tdd | 测试驱动开发 |
| research | 对照一手来源调研技术问题 |
| improve-codebase-architecture | 代码库架构深化机会扫描 |
| prototype | 弃用原型验证设计 |
| diagnosing-bugs | 系统化问题诊断 |
| domain-modeling | 领域建模 |
| wayfinder | 代码库导航/理解 |
| to-spec | 按规范实现 |
| to-tickets | 将计划拆分为可独立领取的票证 |
| triage | 问题分类/状态机驱动 |
| ask-matt | 向 Matt 提问 |
| resolving-merge-conflicts | 解决合并冲突 |
| grill-with-docs | 技术方案压力测试 |
| setup-matt-pocock-skills | 初始化工程技能环境 |

### 4️⃣ Codex 内置

| Skill | 用途 |
|-------|------|
| browser:control-in-app-browser | 页面截图/Lighthouse审计/移动端模拟/性能面板 |
| imagegen | 设计文档配图/示例图生成 |
| documents:documents | 设计规范/技术文档生成 |

---

## 总览

| 阶段 | 任务 | 优先级 | 预计工时 | 子任务数 | Skills 数 |
|------|------|--------|----------|----------|-----------|
| **Phase 1** | 设计系统与视觉打磨 | **P0** | 4h | 9 | 8 |
| **Phase 2** | 交互动效增强 | **P0** | 3h | 8 | 6 |
| **Phase 3** | 响应式与移动端适配 | P1 | 2.5h | 6 | 5 |
| **Phase 4** | 无障碍访问 (a11y) | P1 | 2h | 6 | 4 |
| **Phase 5** | 性能优化 | P1 | 2.5h | 6 | 7 |
| **Phase 6** | 代码质量与架构优化 | P2 | 3h | 7 | 10 |
| **总计** | | | **~17h** | **42** | **~30** |

---

## Phase 1：设计系统与视觉打磨 (P0) — 4h

### 1.1 设计 Token 体系建立 (1h)

**现状**：Tailwind v4 `@theme` 内联定义，颜色仅 amber/stone 两套，无语义 token 层。

**任务**：
- [ ] 建立三层 token 架构：原始 → 语义 → 组件
- [ ] 增加语义颜色 token（`--color-surface-base`, `--color-text-primary`, `--color-border-subtle`）
- [ ] 增加阴影 token 系统（`--shadow-sm` ~ `--shadow-2xl`）
- [ ] 定义 `prefers-reduced-motion` 降级方案

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| visual-design-foundations | FED-7881 | 颜色/间距/字体系统设计指南 |
| design-system-patterns | FED-7875 | Token 层级、主题架构模式 |
| tailwind-design-system | FED-7826 | Tailwind 设计系统集成 |

### 1.2 字体与排版系统优化 (0.5h)

**现状**：Noto Serif/Sans，字号层级有限，行高/字距无系统化。

**任务**：
- [ ] 建立基于黄金比例的字体层级
- [ ] 统一行高/字距系统
- [ ] 设计标题与正文对比方案

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| visual-design-foundations | FED-7881 | 字体层级与排版系统 |
| web-design-guidelines | FED-0124 | 网页排版最佳实践 |

### 1.3 组件视觉一致性审查 (1h)

**现状**：组件分散开发，配色/圆角/间距不一致。

**任务**：
- [ ] 审查所有现有组件的视觉一致性
- [ ] 统一按钮/卡片/输入框等基础组件样式
- [ ] 使用 `browser` 截取当前页面做基准对比

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| design-system-patterns | FED-7875 | 组件一致性模式 |
| ui-ux-pro-max-v2 | FED-7938 | UI 视觉一致性审查 |
| frontend-design | FED-7926 | 前端设计规范 |
| browser | Codex 内置 | 页面截图基准 |

### 1.4 设计规范文档 (0.5h)

**任务**：
- [ ] 编写 `docs/design-system.md` 规范文档
- [ ] 生成设计示例图
- [ ] 记录组件使用规则

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| web-design-guidelines | FED-0124 | 设计规范编写 |
| imagegen | Codex 内置 | 设计文档配图 |
| documents:documents | Codex 内置 | 规范文档生成 |

---

## Phase 2：交互动效增强 (P0) — 3h

### 2.1 微交互系统 (1h)

**现状**：基础 hover/focus 状态，缺过渡动画和反馈设计。

**任务**：
- [ ] 设计微交互时序与缓动曲线
- [ ] 增加按钮/卡片/导航的过渡动画
- [ ] 实现状态反馈微动效

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| interaction-design | FED-7876 | 交互时序/缓动/反馈设计 |
| ui-ux-pro-max | FED-0122 | UI/UX 微交互打磨 |
| frontend-ui-ux | FED-7898 | 前端交互优化 |

### 2.2 页面级过渡动画 (1h)

**现状**：页面切换无过渡效果。

**任务**：
- [ ] 实现页面切换过渡动画
- [ ] 增加滚动驱动的视差/渐入效果
- [ ] 优化加载/骨架屏状态

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| interaction-design | FED-7876 | 页面过渡设计 |
| frontend-design | FED-7888 | 前端动画设计 |
| browser | Codex 内置 | 动画性能验证 |

### 2.3 3D 交互增强 (1h)

**现状**：Three.js 场景已存在，交互较基础。

**任务**：
- [ ] 优化 3D 场景的用户交互反馈
- [ ] 增加鼠标/触摸交互效果
- [ ] 优化 3D 元素过渡动效

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| ui-ux-pro-max | FED-0122 | 3D 交互体验优化 |
| frontend-ui-ux | FED-7898 | 前端交互模式 |
| frontend-design | FED-7926 | 3D 场景交互设计 |

---

## Phase 3：响应式与移动端适配 (P1) — 2.5h

### 3.1 移动端布局适配 (1h)

**现状**：桌面端优先，移动端可能未充分适配。

**任务**：
- [ ] 审查所有页面在移动端（375px~428px）的布局
- [ ] 修复断点适配问题
- [ ] 使用 `browser` 进行移动端模拟验证

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| responsive-design | FED-7880 | 响应式布局设计 |
| mobile-android-design | FED-7877 | Android 移动端设计规范 |
| mobile-ios-design | FED-7878 | iOS 移动端设计规范 |
| browser | Codex 内置 | 移动端模拟/截图验证 |

### 3.2 多端交互适配 (0.5h)

**任务**：
- [ ] 适配触摸事件（touch vs click）
- [ ] 优化移动端导航/操作
- [ ] 处理安全区域（safe area）

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| responsive-design | FED-7880 | 交互适配模式 |
| mobile-android-design | FED-7877 | Android 交互规范 |

### 3.3 多尺寸/多平台验证 (1h)

**任务**：
- [ ] 在多个断点下验证布局正确性
- [ ] 横竖屏切换测试
- [ ] 跨浏览器兼容性检查

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| responsive-design | FED-7880 | 多尺寸适配策略 |
| browser | Codex 内置 | 多设备模拟/截图对比 |

---

## Phase 4：无障碍访问 (P1) — 2h

### 4.1 语义化 ARIA 标注 (0.5h)

**现状**：基础语义标签可能缺失，ARIA 属性不完整。

**任务**：
- [ ] 检查并补充 landmark 标签（`<nav>`, `<main>`, `<aside>`）
- [ ] 补充 ARIA 属性（`aria-label`, `aria-expanded`, `aria-current`）
- [ ] 确保键盘导航路径完整

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| accessibility-compliance | FED-7874 | ARIA 标注规范 |
| web-design-guidelines | FED-0124 | 语义化 HTML 指南 |

### 4.2 对比度与可读性优化 (0.5h)

**任务**：
- [ ] 检查所有前景/背景对比度（WCAG AA ≥ 4.5:1）
- [ ] 优化暗色主题下的文字可读性
- [ ] 使用 `browser` 截取当前页面做对比度审计

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| accessibility-compliance | FED-7874 | 对比度合规标准 |
| wcag-audit-patterns | FED-7781 | WCAG 审计模式 |
| browser | Codex 内置 | 对比度验证/截图 |

### 4.3 焦点管理 (0.5h)

**任务**：
- [ ] 确保焦点可见（focus-visible 样式）
- [ ] 修复模态框/弹窗的焦点陷阱
- [ ] 实现跳转链接（skip-to-content）

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| accessibility-compliance | FED-7874 | 焦点管理规范 |
| web-design-guidelines | FED-0124 | 键盘导航最佳实践 |

### 4.4 屏幕阅读器兼容 (0.5h)

**任务**：
- [ ] 检查动态内容更新通知（aria-live）
- [ ] 优化图片替代文本
- [ ] 验证表单错误提示关联

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| accessibility-compliance | FED-7874 | 屏幕阅读器兼容模式 |
| wcag-audit-patterns | FED-7781 | 无障碍审计流程 |

---

## Phase 5：性能优化 (P1) — 2.5h

### 5.1 加载性能优化 (1h)

**现状**：Next.js 16 默认已优化，但可能仍有改进空间。

**任务**：
- [ ] 使用 `browser` 运行 Lighthouse 审计
- [ ] 优化核心 Web 指标（LCP, FID, CLS）
- [ ] 配置图片优化（next/image 和 sharp）
- [ ] 代码分割与懒加载优化

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| next-best-practices | FED-0121 | Next.js 性能最佳实践 |
| optimization-mastery | FED-7889 | 性能优化策略 |
| browser | Codex 内置 | Lighthouse 性能审计 |

### 5.2 运行时性能优化 (1h)

**任务**：
- [ ] React 组件记忆化（memo / useMemo / useCallback）
- [ ] 优化 Three.js 渲染性能
- [ ] 减少不必要的重渲染
- [ ] 使用 `browser` 录制 Performance 面板

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| vercel-react-best-practices | FED-0123 | React 性能优化 |
| frontend-enhancer | FED-0131 | 前端运行时增强 |
| optimization-mastery | FED-7889 | 运行时性能策略 |

### 5.3 资源与网络优化 (0.5h)

**任务**：
- [ ] 字体加载优化（font-display / preload）
- [ ] 合理配置缓存策略
- [ ] 优化 API 请求合并

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| next-best-practices | FED-0121 | 资源加载优化 |
| optimization-mastery | FED-7889 | 网络优化策略 |

---

## Phase 6：代码质量与架构优化 (P2) — 3h

### 6.1 组件架构重构 (1.5h)

**现状**：组件内逻辑耦合度高。

**任务**：
- [ ] 提取公共 UI 组件（Button / Card / Badge / Input）
- [ ] 统一状态管理模式
- [ ] 分离数据处理与展示逻辑
- [ ] 使用 `component-refactoring` skill 指导重构

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| component-refactoring | FED-7908 | 组件重构模式 |
| react-state-management | FED-7825 | 状态管理优化 |
| nextjs-app-router-patterns | FED-7823 | App Router 架构模式 |
| codebase-design | mattpocock | 模块接口设计 |
| improve-codebase-architecture | mattpocock | 架构深化机会扫描 |
| typescript-advanced-types | FED-7835 | TypeScript 类型优化 |

### 6.2 代码审查与测试 (1h)

**任务**：
- [ ] 代码审查现有组件
- [ ] 添加关键路径测试
- [ ] 类型定义完善

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| frontend-testing | FED-7909 | 前端测试实践 |
| frontend-ui-ux | FED-7898 | UI 代码质量审查 |
| code-review | mattpocock | 双轴代码审查 |
| tdd | mattpocock | 测试驱动开发（新功能） |

### 6.3 文档完善 (0.5h)

**任务**：
- [ ] 更新 `README.md` 添加优化说明
- [ ] 编写优化变更日志
- [ ] 更新 `docs/` 目录下的技术文档

**Skills 映射**：
| Skill | 来源 | 具体用途 |
|-------|------|----------|
| web-design-guidelines | FED-0124 | 文档编写规范 |
| documents:documents | Codex 内置 | 文档生成 |
| imagegen | Codex 内置 | 文档配图生成 |

---

## 执行路径规划

### 推荐执行顺序

```
Day 1 (4h)  → Phase 1: 设计系统与视觉打磨
Day 2 (3h)  → Phase 2: 交互动效增强
Day 3 (2.5h)→ Phase 3: 响应式适配
Day 4 (2h)  → Phase 4: 无障碍访问
Day 5 (2.5h)→ Phase 5: 性能优化
Day 6 (3h)  → Phase 6: 代码质量
```

### 并行策略

| 并行组 | 阶段 | 原因 |
|--------|------|------|
| **A** | Phase 1 + Phase 4 | 设计系统与无障碍不冲突，可同时进行 |
| **B** | Phase 2 + Phase 5 | 动效和性能需要协同优化，互不阻塞 |
| **C** | Phase 3 + Phase 6 | 响应式修改与重构同步进行更高效 |

### 每个阶段启动前

1. 读取对应 SKILL.md 文件获取完整指导
2. 使用 `browser` 截取当前状态作为基准
3. 实施修改
4. 验证效果
5. 更新进度追踪表

---

## 进度追踪表

| 日期 | 阶段 | 子任务 | 状态 | 使用 Skills |
|------|------|--------|------|-------------|
| - | Phase 1 | 1.1 Token 体系 | ⏳ 待开始 | FED-7881, FED-7875, FED-7826 |
| - | Phase 1 | 1.2 字体排版 | ⏳ 待开始 | FED-7881, FED-0124 |
| - | Phase 1 | 1.3 组件一致性 | ⏳ 待开始 | FED-7875, FED-7938, FED-7926, browser |
| - | Phase 1 | 1.4 规范文档 | ⏳ 待开始 | FED-0124, imagegen, documents |
| - | Phase 2 | 2.1 微交互 | ⏳ 待开始 | FED-7876, FED-0122, FED-7898 |
| - | Phase 2 | 2.2 页面动画 | ⏳ 待开始 | FED-7876, FED-7888, browser |
| - | Phase 2 | 2.3 3D 交互 | ⏳ 待开始 | FED-0122, FED-7898, FED-7926 |
| - | Phase 3 | 3.1 移动端布局 | ⏳ 待开始 | FED-7880, FED-7877, FED-7878, browser |
| - | Phase 3 | 3.2 多端适配 | ⏳ 待开始 | FED-7880, browser |
| - | Phase 3 | 3.3 多尺寸验证 | ⏳ 待开始 | FED-7880, browser |
| - | Phase 4 | 4.1 语义化 ARIA | ⏳ 待开始 | FED-7874, FED-0124 |
| - | Phase 4 | 4.2 对比度缩放 | ⏳ 待开始 | FED-7874, FED-7781, browser |
| - | Phase 4 | 4.3 焦点管理 | ⏳ 待开始 | FED-7874, FED-0124 |
| - | Phase 4 | 4.4 屏幕阅读器 | ⏳ 待开始 | FED-7874, FED-7781 |
| - | Phase 5 | 5.1 加载性能 | ⏳ 待开始 | FED-0121, FED-7889, browser |
| - | Phase 5 | 5.2 运行时性能 | ⏳ 待开始 | FED-0123, FED-0131, FED-7889 |
| - | Phase 5 | 5.3 资源网络 | ⏳ 待开始 | FED-0121, FED-7889 |
| - | Phase 6 | 6.1 架构重构 | ⏳ 待开始 | FED-7908, FED-7825, FED-7823, codebase-design, improve-codebase-architecture, FED-7835 |
| - | Phase 6 | 6.2 测试审查 | ⏳ 待开始 | FED-7909, FED-7898, code-review, tdd |
| - | Phase 6 | 6.3 文档完善 | ⏳ 待开始 | FED-0124, documents, imagegen |

---

> 说明：每个阶段启动时会读取对应 SKILL.md 获取完整指导，实施完成后更新追踪表。
> 所有技能路径基于 `E:\skills库\Final_Product_Library\02_全栈大前端包\` 目录。
