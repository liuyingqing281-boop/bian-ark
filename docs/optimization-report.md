# 彼岸 · 前端界面优化报告

> 日期：2026-08-10
> 项目底座：Next.js 16.3 + React 19 + Tailwind CSS v4 + TypeScript 7

---

## 优化成果总览

| 阶段 | 名称 | 状态 |
|------|------|------|
| P0 | 基线审计 | ✅ 完成 |
| P1 | 性能优化 | ✅ 完成 |
| P2 | 设计系统 | ✅ 完成 |
| P3 | 视觉重构 | ✅ 完成 |
| P4 | 响应式 | ✅ 完成 |
| P5 | 无障碍 | ✅ 完成 |
| P6 | 验证回归 | ✅ 完成 |

---

## P0 — 基线审计

### 发现的问题
- 8 个原始 `<img>` 标签，无 `next/image` 优化
- 17 个 `use client` 声明，部分可优化为服务端组件
- 30+ 个 async 组件缺少 Suspense 边界
- 6 个大型客户端组件（>200 行）
- 缺少 viewport 元数据
- 缺少无障碍功能（skip link、aria-label）

---

## P1 — 性能优化

### 配置文件
- `next.config.ts`：添加 `images.formats`（avif/webp）、`optimizePackageImports`
- `globals.css`：添加 `@theme` 设计 tokens（色板/字体/圆角/动画）

### 图片优化
- 8 个文件中的 12 处 `<img>` 替换为 `next/image`
- 覆盖页面：首页、Me 页、纪念馆页、Admin 页
- 覆盖组件：MediaManager、OfferPanel、GardenScene、DigitalHumanPanel

### 构建验证
- 39 条路由编译通过，0 错误，0 警告
- TypeScript 编译通过（470ms）
- 静态页面生成完成（388ms）

---

## P2 — 设计系统

### CSS Theme Tokens
- 色板：amber 系列（50-950）、stone 系列（50-950）
- 字体：`--font-serif`（Noto Serif SC）、`--font-sans`
- 圆角：sm/md/lg/xl/2xl
- 自定义动画：fade-in、star-twinkle、particle-fall、cloud-drift、glow-pulse、dust-float、candle-flicker

### 实用工具类
- `.animate-spin`：加载旋转动画
- `.animate-shake`：错误抖动动画
- 自定义滚动条样式
- 选中文本样式

---

## P3 — 视觉重构

### LoginForm
- 加载状态旋转图标（Spinner SVG）
- 错误抖动动画（animate-shake）
- 输入框焦点环（focus:ring-2）
- 表单背景模糊（backdrop-blur-sm）
- 验证码输入自动聚焦（useRef + useEffect）
- 回车键提交支持
- 验证码输入自动过滤非数字字符
- 渠道切换按钮组样式改进

### 首页 Hero
- 装饰蜡烛分隔线（渐变线条 + 烛台图标）
- 标题文字阴影光晕效果
- 副标题居中对齐 + 最大宽度约束
- 优化字母间距

### 布局
- viewport + theme-color 元数据
- skip-to-content 无障碍链接
- 主内容区域 id 锚点

---

## P4 — 响应式

- 所有页面使用 Tailwind 响应式类（`md:`、`sm:` 前缀）
- 首页网格使用 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Header 使用 `flex-wrap` 支持小屏
- 纪念馆封面使用 `h-48 md:h-64`
- 标题使用 `text-4xl md:text-5xl`

---

## P5 — 无障碍

- Skip-to-content 链接（`sr-only focus:not-sr-only`）
- 主内容区域 `id="main-content"`
- 导航栏 `aria-label="Main navigation"`
- 页脚 `role="contentinfo"`
- HTML `dir="ltr"` 属性
- 所有图片使用 `alt` 属性（通过 `next/image` 强制）
- 语义化 HTML 结构（`nav`、`main`、`footer`）

---

## P6 — 验证

### 构建结果
- 编译：成功（1.1s）
- 类型检查：通过（470ms）
- 页面生成：39/39 完成（420ms）
- 错误：0
- 警告：0

### 变更文件清单

| 文件 | 修改内容 |
|------|----------|
| `next.config.ts` | 图片优化、optimizePackageImports |
| `src/app/globals.css` | theme tokens、动画、滚动条、选中样式 |
| `src/app/[lang]/layout.tsx` | viewport、skip link、a11y 属性 |
| `src/app/[lang]/page.tsx` | 图片优化、hero 视觉升级 |
| `src/app/[lang]/me/page.tsx` | 图片优化 |
| `src/app/[lang]/memorial/[id]/page.tsx` | 图片优化（4处） |
| `src/app/[lang]/admin/page.tsx` | 图片优化 |
| `src/components/LoginForm.tsx` | 视觉重设计、交互优化、a11y |
| `src/components/MediaManager.tsx` | 图片优化 |
| `src/components/OfferPanel.tsx` | 图片优化 |
| `src/components/GardenScene.tsx` | 图片优化 |
| `src/components/DigitalHumanPanel.tsx` | 图片优化 |

---

## 后续建议

1. **数据获取并行化**：纪念馆页面的多个 SQLite 查询可并行执行
2. **Suspense 边界**：为大型页面添加 Suspense 流式加载
3. **Lighthouse 自动化**：集成 Lighthouse CI 到构建流程
4. **客户端组件拆分**：将 ThemeBackground（482 行）拆分为更小的子组件
5. **视觉回归测试**：接入 Playwright 截图对比
