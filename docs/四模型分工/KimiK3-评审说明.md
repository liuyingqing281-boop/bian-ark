# Kimi-K3 视觉线 · 合并前评审说明（交 Opus-5 / 集成方）

> 分支：`feat/visual-polish`（已 rebase 到最新 master，推送至 origin）
> 范围：任务书 `KimiK3-前端工艺.md` 的 B2′ / B3 / B5 / B7 全部完成
> 日期：2026-08-19 ｜ 状态：**待评审，未合并**

## 一、Commit 清单（5 个，自下而上）

| Commit | 主题 | 类型 |
|---|---|---|
| `b47cda9` | B2′ 纪念馆页视觉实调（晕环/饰线/墓志铭） | feat |
| `d7d4101` | 任务实施拆解文档 | docs |
| `4b4b603` | B3 公共墓园场景润色（2.5D层次/卡片/3D优化） | feat |
| `ce0d71b` | B5 动效与仪式反馈（火焰/供奉成功） | feat |
| `81a6059` | B7 无障碍细节（对比度/焦点环/alt） | feat |

## 二、Diff 范围核对（vs origin/master，35 文件，+584/-52）

**源码改动（9 个文件，均在任务书白名单内或为 B2′/B7 任务明确指向的文件）：**

| 文件 | 改动量 | 内容 | 边界判定 |
|---|---|---|---|
| `src/components/MemorialHero.tsx` | ±8 | B2′ 晕环/墓志铭参数；B7 生卒文字升档 | B2′ 任务书直接指定 |
| `src/app/globals.css` | +40 | B2′ 饰线；B5 ritual keyframes；B7 全局焦点环+页脚对比度 | 白名单 |
| `src/components/GardenScene.tsx` | ±69 | B3 场景层次+墓位卡片；B7 墓碑 alt | 白名单 |
| `src/components/Garden3D.tsx` | ±14 | B3-4 DPR/anisotropy/maxDistance | 白名单 |
| `src/components/GardenViewSwitch.tsx` | ±8 | B3-4 加载占位；B7 alt 透传 | 白名单 |
| `src/app/[lang]/garden/page.tsx` | ±7 | B3-3 空态样式；B7 对比度+alt 接线（仅样式类与 props） | 白名单（仅样式类） |
| `src/components/Flame.tsx` | ±20 | B5-1 锥形/呼吸/钳制 | 白名单 |
| `src/components/OfferPanel.tsx` | ±26 | B5-2 success 节点动效挂钩；B7 对比度+焦点环 | 白名单限定"动效挂钩处"+B7 任务直接要求 |
| `src/app/[lang]/dictionaries.ts` | +12 | **仅追加** `visual:` section（zh/en 各 4 键），未动任何现有键 | 词典分区规则 |

**零改动确认**：业务逻辑、API 路由、数据层、迁移、提交/权限/支付逻辑均未触碰；`Tombstone` 的 `Link`/`href`/DOM 层级保持不变（E2E garden 用例依赖 href 定位）。

**需要评审留意的两点**：
1. `.maestroignore`（+10）是代提交时混入的工具配置文件，非本线产出，**建议合并前剔除或确认保留**。
2. `tools/` 下 6 个新脚本是本地验证工具（截图/回归编排），不进运行时、无依赖新增，可保留作回归基础设施；其中 `tools/local-regression.mjs` 支持 `BASE_URL` 环境变量，各线可复用。

## 三、验收证据

**回归门槛（合并必要条件）逐项**：
- [x] `tsc --noEmit` 通过
- [x] smoke 3/3（p1/p2/p4，本分支工作区 3003 端口实测）
- [x] E2E 40/40 双端通过（桌面+移动，约 52-57s）
- [x] 移动审计六页：无横向溢出、无新增触控/字号问题（遗留告警见第四节）

**性能实测**（headless dev 模式，memorial 页 6 条燃烧火焰）：桌面 FPS 47-49，移动模拟 60；3D 视图正常渲染。reduced-motion 由 `globals.css` 全局 media query 兜底，所有新动效单次 ≤1.2s。

**截图证据（`docs/shots/`，前后可对照）**：
- B2′：`b2prime-{before,after}-{desktop,mobile}.png`
- B3-1：`garden-b3-1-{before,after}-{desktop,mobile}.png`
- B3-2：`garden-b3-2-after-{desktop,mobile}.png`、`garden-b3-2-hover-desktop.png`（hover 暖光态）
- B3-4：`garden-b3-4-3d-desktop.png`
- B5：`b5-flame-desktop.png`（多火焰）、`b5-ritual-{mid,end}.png`（动效中/后）
- B7：`b7-focus-{garden-search,item-card}.png`（焦点走查）

**B5 验证方法说明**：因存在第四节第 1 条的既有 bug（成功被误报失败），动效截图采用 Playwright 拦截 `/api/tribute` 返回 200 的方式触发真实 success 渲染路径，未改任何提交逻辑；该拦截仅存在于 `tools/b5-verify.mjs`。

## 四、发现上报清单（随 PR 转 Issue，本分支均未越界修复）

1. **[逻辑层·建议 P1] 供奉成功误报失败**：`OfferPanel` fetch POST `/api/tribute` 成功返 307，浏览器跟随 307 **保留 POST** 打到页面路由 → 被当 Server Action → 404 → 用户见"操作失败，请重试"，实际已入库。master 双端可复现（2026-08-19）。建议 API 改返 JSON 或改用 303。
2. **[结构层] 页脚触控**：全站「用户协议/隐私政策」48×33px（<44px），六页均报。
3. **[结构层] 会员页支付按钮**：微信支付/支付宝 151×34px。
4. **[结构层] memorial 页隐藏 input 13×13**：建议 `sr-only` 语义或审计豁免。
5. **[结构层] memorial 页「← 返回墓园」74×20px**。
6. **[跨边界·附接法] AI 候选图 alt 硬编码**：`visual.candidateImage` 词典已备；需在 `memorial/[id]/page.tsx` 给 OfferPanel labels 加 `visualCandidate: dict.visual.candidateImage` 一行，再把 `alt="candidate"` 换掉。
7. **[跨边界] 对比度未达标清单**：`DigitalHumanPanel`/`MediaManager`/`TimelineManager`/admin/me/membership/legal/memorial 页的 `text-stone-600`（≈2.6:1）与 `text-stone-500`（≈4.0:1）正文，建议归属方按"600→500→400"升档；边界内部分本分支已修。

## 五、合并建议

- diff 干净、无依赖新增、无逻辑改动，评审重点可放在：视觉参数品味（截图对照）+ `.maestroignore` 去留 + 第四节第 1 条是否单独立 Issue。
- 合并顺序按总纲（视觉→支付→主线）；合并后三重回归由集成方执行。
