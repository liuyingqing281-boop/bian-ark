# Kimi-K3 视觉线 · 合并前评审说明（交 Opus-5 / 集成方）

> 分支：`feat/visual-polish`（已 rebase 到最新 master，推送至 origin）
> 范围：任务书 `KimiK3-前端工艺.md` 的 B2′ / B3 / B5 / B7 全部完成 + 1 个逻辑层 bug 修复（方案 A，集成方已确认）
> 日期：2026-08-19（刷新：补充 fix commit `7f34122`）｜ 状态：**待评审，未合并**

## 一、Commit 清单（8 个，自下而上）

| Commit | 主题 | 类型 |
|---|---|---|
| `b47cda9` | B2′ 纪念馆页视觉实调（晕环/饰线/墓志铭） | feat |
| `d7d4101` | 任务实施拆解文档 | docs |
| `4b4b603` | B3 公共墓园场景润色（2.5D层次/卡片/3D优化） | feat |
| `ce0d71b` | B5 动效与仪式反馈（火焰/供奉成功） | feat |
| `81a6059` | B7 无障碍细节（对比度/焦点环/alt） | feat |
| `e9e7a99` | 本评审说明 | docs |
| `e2b91f5` | 供奉误报 bug Issue 草稿 | docs |
| `7f34122` | **fix：供奉成功误报失败——tribute API 改返 JSON（方案 A）** | fix |

## 二、Diff 范围核对（vs origin/master，42 文件，+746/-68）

**视觉/样式改动（白名单内，9 个文件）：**

| 文件 | 改动量 | 内容 | 边界判定 |
|---|---|---|---|
| `src/components/MemorialHero.tsx` | ±8 | B2′ 晕环/墓志铭参数；B7 生卒文字升档 | B2′ 任务书直接指定 |
| `src/app/globals.css` | +40 | B2′ 饰线；B5 ritual keyframes；B7 全局焦点环+页脚对比度 | 白名单 |
| `src/components/GardenScene.tsx` | ±69 | B3 场景层次+墓位卡片；B7 墓碑 alt | 白名单 |
| `src/components/Garden3D.tsx` | ±14 | B3-4 DPR/anisotropy/maxDistance | 白名单 |
| `src/components/GardenViewSwitch.tsx` | ±8 | B3-4 加载占位；B7 alt 透传 | 白名单 |
| `src/app/[lang]/garden/page.tsx` | ±7 | B3-3 空态样式；B7 对比度+alt 接线 | 白名单（仅样式类与 props） |
| `src/components/Flame.tsx` | ±20 | B5-1 锥形/呼吸/钳制 | 白名单 |
| `src/components/OfferPanel.tsx` | ±30 | B5-2 success 动效挂钩；B7 对比度+焦点环；fix 错误码映射 | 白名单限定处 + fix 经集成方确认 |
| `src/app/[lang]/dictionaries.ts` | +18 | **仅追加**：`visual:` section（4 键）+ memorial 段 3 个 `err_*` 键（zh/en），未动现有键 | 词典分区规则 |

**逻辑层修复（`7f34122`，越界但经集成方书面确认走方案 A）：**

| 文件 | 改动量 | 内容 |
|---|---|---|
| `src/app/api/tribute/route.ts` | ±12 | 成功 307 → `{ ok: true }`；失败改 JSON 错误码：`memorial_not_found`(404) / `tribute_not_allowed`(403) / `content_blocked`(422) / `item_unavailable`(400) |
| `tests/e2e/tribute.spec.ts` | +4 | 新增断言：成功后 `.ui-status-success` 可见且无 `.ui-status-error` |
| `tests/e2e/permissions.spec.ts` | ±5 | 匿名供奉断言由"任意 3xx"收紧为 `200 + ok:true` |
| `tools/smoke-p1.mjs` | ±4 | 同上收紧 |
| `tools/smoke-p2.mjs` | ±7 | 同上收紧 + **修正隐藏问题**：原"任意 3xx"断言掩盖了 p2 自定义祭品供奉未带登录态的静默失败，已改为带 owner 凭证 |

**零改动确认**：除 `7f34122` 列明的 5 个文件外，业务逻辑、数据层、迁移、权限、支付均未触碰；`Tombstone` 的 `Link`/`href`/DOM 层级保持不变（E2E garden 用例依赖 href 定位）。

**需要评审留意的两点**：
1. `.maestroignore`（+10）是代提交时混入的工具配置文件，非本线产出，**建议合并前剔除或确认保留**。
2. `tools/` 下 6 个新脚本是本地验证工具（截图/回归编排），不进运行时、无依赖新增；`tools/local-regression.mjs` 支持 `BASE_URL` 环境变量，各线可复用。

## 三、验收证据

**回归门槛（合并必要条件）逐项**（最终 fix 提交后重跑）：
- [x] `tsc --noEmit` 通过
- [x] smoke 3/3（p1/p2/p4，本分支工作区 3003 端口实测）
- [x] E2E 40/40 双端通过（含新增的供奉成功断言）
- [x] 移动审计六页：无横向溢出、无新增触控/字号问题（遗留告警见第四节）

**性能实测**（headless dev 模式，memorial 页 6 条燃烧火焰）：桌面 FPS 47-49，移动模拟 60；3D 视图正常渲染。reduced-motion 由 `globals.css` 全局 media query 兜底，所有新动效单次 ≤1.2s。

**截图证据（`docs/shots/`，前后可对照）**：
- B2′：`b2prime-{before,after}-{desktop,mobile}.png`
- B3-1：`garden-b3-1-{before,after}-{desktop,mobile}.png`
- B3-2：`garden-b3-2-after-{desktop,mobile}.png`、`garden-b3-2-hover-desktop.png`（hover 暖光态）
- B3-4：`garden-b3-4-3d-desktop.png`
- B5：`b5-flame-desktop.png`（多火焰）、`b5-ritual-{mid,end}.png`（动效中/后，**方案 A 后为真实提交路径截图，无拦截**）
- B7：`b7-focus-{garden-search,item-card}.png`（焦点走查）

## 四、发现上报清单（随 PR 转 Issue）

1. ~~**[逻辑层·P1] 供奉成功误报失败**~~ → **已修复（`7f34122`，方案 A）**，存档文本见 `docs/四模型分工/issue-供奉成功误报.md`，合并后可关闭对应 Issue。
2. **[结构层] 页脚触控**：全站「用户协议/隐私政策」48×33px（<44px），六页均报。
3. **[结构层] 会员页支付按钮**：微信支付/支付宝 151×34px。
4. **[结构层] memorial 页隐藏 input 13×13**：建议 `sr-only` 语义或审计豁免。
5. **[结构层] memorial 页「← 返回墓园」74×20px**。
6. **[跨边界·附接法] AI 候选图 alt 硬编码**：`visual.candidateImage` 词典已备；需在 `memorial/[id]/page.tsx` 给 OfferPanel labels 加 `visualCandidate: dict.visual.candidateImage` 一行，再把 `alt="candidate"` 换掉。
7. **[跨边界] 对比度未达标清单**：`DigitalHumanPanel`/`MediaManager`/`TimelineManager`/admin/me/membership/legal/memorial 页的 `text-stone-600`（≈2.6:1）与 `text-stone-500`（≈4.0:1）正文，建议归属方按"600→500→400"升档；边界内部分本分支已修。

## 五、合并建议

- 视觉部分无逻辑改动、无依赖新增；评审重点：①视觉参数品味（截图对照）②`.maestroignore` 去留 ③`7f34122` 逻辑修复的 diff（已含测试补强，风险低）。
- 合并顺序按总纲（视觉→支付→主线）；合并后三重回归由集成方执行。
