# Kimi-K3 · 前端工艺 实施拆解（B3/B5/B7）

> 基于任务书 `KimiK3-前端工艺.md` 的可执行细化。B2′ 已完成（commit `80689d0`）。
> 每一小项给出：目标文件、定位（行号基于 master `7a9ab9c`）、具体改法、验收方式。
> 通用约定：只改白名单文件；词典只追加 `visual:` section；改词典前先 `git pull --rebase`。

---

## B3 · 公共墓园场景润色（主任务，拆 5 小项，每小项独立截图+验收）

基线截图已存在：`docs/shots/garden-2d.png`、`docs/shots/garden-3d.png`（若过期先重截）。
截图工具沿用 `tools/b2prime-shot.mjs`，另加 garden 版：访问 `http://localhost:3002/zh/garden`，桌面整页 + 移动端整页各一张。

### B3-1 · 2.5D 场景层次质感（`GardenScene.tsx`）

现状问题（按行号）：
- L110 背景渐变：夜空 `#0b1126→#141c38` 与地面 `#2c3524→#141a0f` 在 33%/34% 处硬切，地平线生硬。
- L139 月亮：`bg-amber-100/90` 纯色圆盘 + 静态光晕，无月晕层次。
- L143-148 远山：两层 SVG 山脊 `#1a2140/#141a30`，无雾遮挡感。
- L151-157 雾层：单条 16px 高横向渐变带，`garden-mist` 26s 平移，仅一条、偏薄。
- L160-173 萤火：8 个点全部 `w-1 h-1` 同尺寸，光晕相同，缺近大远小。

改法（全部限样式层，不动 DOM 结构与 Link 卡层级）：
1. **地平线软化**：背景渐变 33%/34% 硬切改为 30%→38% 过渡带，中间插一档 `#232a3f`（夜空）→ `#263021`（地面）。
2. **月晕两层**：月亮 div 外加一层更大更淡的晕：`shadow-[0_0_60px_20px_rgba(254,243,199,0.25)]` 保留，新增 `before` 或包裹 div 用 `bg-[radial-gradient(circle,rgba(254,243,199,0.10),transparent_65%)]` 尺寸 `w-40 h-40` 居中于月亮。若用伪元素，样式写进组件内 `<style>` 块（L113 已有惯例）。
3. **远山加雾底**：山脊 div（L143）内 SVG 下方追加一条 `bg-gradient-to-b from-transparent to-[#0b1126]/60` 的绝对定位条，模拟山脚没入夜雾。
4. **雾层加一条**：现有雾带复制一条，`top-[38%]`、`h-10`、透明度降为 0.05/0.08、动画时长改 34s、`animation-direction: alternate-reverse`，形成双雾不同速。
5. **萤火分级**：FIREFLIES 数组（L23-32）每项加 `size`（1/1.5/2px 三档）与 `glow`（光晕强度两档），渲染处 `w-1 h-1` 与 `boxShadow` 改为按项取值。近处大点亮、远处小点暗。

验收：
- [ ] `node tools/garden-shot.mjs b3-1` 截图入 `docs/shots/garden-b3-1-{desktop,mobile}.png`，与基线并置确认四层（星/山雾/萤火/地）过渡自然
- [ ] `npx playwright test` 双端全过
- [ ] 夜间基调不变（不与 ThemeBackground 四季主题冲突——本页背景是自包含渐变，无联动）

### B3-2 · 墓位卡片质感（`GardenScene.tsx` L49-74 `Tombstone`）

现状问题：
- 碑身 `from-stone-400 via-stone-500 to-stone-600` 是亮灰色，在夜景里偏"白天石碑"；hover 变 `from-stone-300` 更亮，方向反了——夜里 hover 应该是"烛光照亮"而非"整体提亮"。
- 头像圈 `bg-stone-700/60 border-stone-500/50` 偏冷。
- 姓名 `text-stone-900`、生卒 `text-stone-700` 在亮碑身上可读，但若碑身调暗需同步调字色。
- 基座（L71）`w-28 h-2.5` 与碑身 `w-24` 衔接处无阴影层次。

改法：
1. **碑身压暗半档**：`from-stone-400 via-stone-500 to-stone-600` → `from-stone-500/90 via-stone-600 to-stone-700`；文字随之改 `text-stone-100`（姓名）/`text-stone-400`（生卒）。
2. **hover 改暖光**：去掉 `group-hover:from-stone-300 group-hover:via-stone-400`，改为加暖色外光：`group-hover:shadow-[0_0_28px_-6px_rgba(200,140,55,0.45)]`，位移 `-translate-y-1` 保留。
3. **头像圈呼应 B2′**：`border-stone-500/50` → `border-amber-700/40`，加 `shadow-[0_0_14px_-4px_rgba(200,140,55,0.35)]`。
4. **基座衔接**：基座加 `bg-gradient-to-b from-stone-600 to-stone-700` 替代纯色 `bg-stone-700`。

注意：E2E `garden.spec.ts` 用 href 定位点击卡片——**`Link` 的 `href`、`className` 中的 `group`、DOM 层级一律不动**，只改视觉类。

验收：
- [ ] `docs/shots/garden-b3-2-*.png` 前后对比（含一张 hover 态截图：Playwright `hover()` 后截）
- [ ] E2E 双端全过、`node tools/mobile-audit-check.mjs <id>` 六页全过

### B3-3 · 章节铭牌与空态（`GardenScene.tsx` L184、墓园页 `page.tsx` L76-80）

1. 分区标题 `— label —`（L184）：`text-stone-400/60` → 复用饰线语言，改为 `text-amber-200/50`，两侧短线沿用 `ui-section-ornate` 的渐变值手写（组件内联，不引类以免样式耦合）。
2. 空态（page.tsx L76-80，仅样式类）：🕯️ 图标 `text-6xl mb-6` 后加一行小字已有；蜡烛图标加 `opacity-70` 与轻微 `drop-shadow(0 0 18px rgba(200,140,55,0.35))`（内联 style）。

### B3-4 · Garden3D 安全优化（`Garden3D.tsx`，只碰加载与材质）

1. **初始视角**：`camera.position.set(0, 5.2, center + 10.5)`（L197）保持；仅在墓位 >20 时把 `controls.maxDistance` 46 → 60，避免大墓园看不全。判断 `const total = sections.reduce((n,s)=>n+s.rows.length,0)`。
2. **贴图/文字纹理压缩**：`makeLabelTexture` canvas 256×160 保持；`texture.anisotropy = 4` → 取 `Math.min(4, renderer.capabilities.getMaxAnisotropy())`。
3. **DPR 钳制**：`Math.min(window.devicePixelRatio, 2)`（L73）→ `Math.min(window.devicePixelRatio, 1.75)`，移动端降锯齿负载（antialias 保持 true）。
4. **加载占位**（`GardenViewSwitch.tsx` L10-14）：`…` 改为复用 `animate-spin` 圆环 + `labels.loading`？**不加词典键**，直接保留 `…` 但加 `aria-label`，容器高度 `h-96` 与实际渲染高度 `clamp(480, w*0.55, 640)` 对齐为 `h-[480px] sm:h-[560px]` 减少跳动。

不动：交互（OrbitControls/点击导航）、灯光布局、几何结构。

### B3-5 · B3 整体回归

- [ ] `npx tsc --noEmit`
- [ ] `npm run smoke` 3/3
- [ ] `npx playwright test` 40/40
- [ ] `node tools/mobile-audit-check.mjs <memorialId>` 六页
- [ ] 截图清单齐全后 commit：`feat: 公共墓园场景润色 B3（2.5D层次/墓位卡片/3D加载优化）`，body 列全部 `docs/shots/garden-b3-*` 路径
- [ ] `git push`

---

## B5 · 动效与仪式反馈（拆 3 小项）

### B5-1 · Flame 火焰形态与性能（`Flame.tsx`）

现状：粒子 18 个上限（L63）、DPR ≤2（L35）、圆形粒子 + 底部辉光；reduced-motion 已降级为静态渐变（L115-120）✅。

改法：
1. **DPR 钳制**：`Math.min(window.devicePixelRatio, 2)` → `Math.min(window.devicePixelRatio, 1.5)`。
2. **粒子上限**：`particles.length > 18` → 上限按 `width` 缩放：`const MAX = Math.min(80, Math.round(width * 0.6))`（32px 宽 ≈ 19，与现状一致；更宽的燃烧条目封顶 80）。
3. **锥形摇曳**：发射 x 范围随上升收窄——在 update 里加向中轴的回拉：`p.vx += (width/2 - p.x) * 0.0015`；并让横向抖动随 progress 增大（顶部飘）：抖动系数 `0.3` → `0.15 + progress * 0.5`。
4. **明暗呼吸**：整体 alpha 乘一个低频呼吸因子 `0.85 + 0.15 * Math.sin(time / 380)`（在 animate 内算一次，作用于 glow 的 alpha）。

验收：多燃烧条目页面（memorial 页勾选"燃烧"祭品多条时）移动端开发者工具 FPS 抽查 ≥50，记录数值进 commit body。

### B5-2 · 供奉成功仪式反馈（`OfferPanel.tsx` 仅动效挂钩 + `globals.css`）

不改提交逻辑，只在 `success` 出现处挂一次性动效：
1. `globals.css` 追加 keyframes（≤1.2s、forwards、单次）：
   - `@keyframes ritual-flame-sway`：烛光轻颤——`transform: translateX` ±2px + opacity 0.8↔1，0.9s ease-in-out 1 次。
   - `@keyframes ritual-petal-fall`：花瓣缓落——3 片 12px 花瓣（椭圆 div，`border-radius: 60% 40% 60% 40%`，amber-200/30 色），从成功提示上方 24px 落 40px、透明度 0→0.8→0，1.2s ease-out 1 次，各延迟 0/0.15/0.3s。
   - 两个类 `.ritual-flame-sway` / `.ritual-petal`；`prefers-reduced-motion` 已由 globals 全局 media query 兜底（动画时长压 0.001ms），无需另写。
2. `OfferPanel.tsx` L209-212 `aria-live` 区块：`success` 为 true 时，在 `<p className="ui-status-success">` 外包一层 `relative` div，追加 3 个 `<span className="ritual-petal" aria-hidden>` 与给提示文字加 `.ritual-flame-sway`。用 `key={success 计数}` 或 `onAnimationEnd` 后清态保证再次提交可重播（最简：`success` 由 false→true 时 React 重新挂载该节点即可，因 `setSuccess(false)` 在每次提交开头已调用，无需额外逻辑）。

验收：提交供奉后动效播放一次 ≤1.2s、不阻塞表单（busy 已复位）；reduced-motion 下无动画；E2E tribute 用例通过。

### B5-3 · B5 回归 + commit

- 同 B3-5 四件套；commit `feat: 动效与仪式反馈 B5（火焰锥形摇曳/供奉成功一次性反馈）`，body 记 FPS 抽查值与 reduced-motion 验证方式；push。

---

## B7 · 无障碍细节（拆 3 小项，1 天）

### B7-1 · 对比度（重点 stone-500/600 文案）

用 Playwright 或手算对比度（stone-500 `#78716c` 对 stone-950 `#0c0a09` ≈ 4.6:1 勉强过；stone-600 `#57534e` ≈ 3.0:1 **不过**）。做法：
1. 全局 grep `text-stone-600` / `text-stone-500`，逐处判断是否为正文（非装饰/非 placeholder）：
   - 正文 → `text-stone-500` 升 `text-stone-400`（`#a8a29e` ≈ 7.5:1）；`text-stone-600` 升 `text-stone-500`。
   - placeholder（`placeholder-stone-600`）不动（WCAG 对 placeholder 无强制）。
2. 已知点：`OfferPanel` L192 `text-stone-600`（noCustomItems）、L253 quotaHint、L277 loginToCustom；`MemorialHero` L130 生卒 `text-stone-500`（正文，升 `text-stone-400`）。
3. 产出修改清单（文件:行:前→后:对比度值）写进 commit body。

### B7-2 · 焦点可见（amber 焦点环统一）

1. `globals.css` 追加全局兜底：`:focus-visible { outline: 2px solid var(--accent-memorial); outline-offset: 2px; }`（`.ui-control:focus-visible` 已有自定义，优先级更高不冲突）。
2. 键盘 Tab 走查：导航（NavBar/语言切换）→ 墓园搜索/随机漫步 → 祭品选择（ItemCard 的 label+sr-only radio，焦点环落在 label 上需 `label:has(:focus-visible)` 同款 amber 环）→ 提交按钮 → 页脚链接。逐页验证并截 1-2 张焦点态图。

### B7-3 · 图片 alt 语义化（词典 `visual:` section）

1. `dictionaries.ts` **追加** `visual:` section（zh/en 双语，只加不碰他人键）：
   - `visual.tombstoneAvatar`: zh `{name}的遗像` / en `Portrait of {name}`
   - `visual.offeringItem`: zh `祭品：{label}` / en `Offering: {label}`
   - `visual.candidateImage`: zh `AI 生成候选图` / en `AI-generated candidate`
   - `visual.mediaImage`: zh `{name}的影像记忆` / en `Memory of {name}`
2. 替换硬编码：`GardenScene` L61 `alt={memorial.name}` → 词典格式串；`OfferPanel` L266 `alt="candidate"` → `visual.candidateImage`；`MediaManager`/memorial 页媒体图同理（如该组件在白名单外，记入"发现上报"不改）。
3. 走查清单截图/列表入 commit body。

### B7-4 · B7 回归 + commit

- 四件套回归；commit `feat: 无障碍细节 B7（对比度/焦点环/alt语义化）`；push；任务书第五节"发现上报"补齐所有遗留项（含 B2′ 已发现的页脚触控 48×33 与隐藏 input 13×13）。

---

## 全部完成后的收尾

- [ ] 三项 commit 均在 `feat/visual-polish`，push 完成
- [ ] 通知 Opus-5 评审 diff；等 GLM5.3 合并（**不自行合并 master**）
- [ ] 合并后由集成方跑三重回归与 deploy.sh

## 风险与边界备忘

- E2E garden 用例靠 href 定位 → Tombstone 的 Link/href/DOM 结构零改动
- 不引新 npm 依赖；Three.js 只调参数
- `dictionaries.ts` 改前 `git pull --rebase`，只追加 `visual:` section
- 所有动画时长 ≤1.2s、单次或低频循环；`prefers-reduced-motion` 全局兜底已存在（globals.css L198-205）
