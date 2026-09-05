# 星海正式前端实现与交互优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将纪念园 `/[lang]/garden` 从旧“墓位/墓碑”页面升级为正式的“星海”体验，并打通馆级数据、园 → 馆 → 人路由、星群交互、择位、无障碍、性能和回归验收。

**Architecture:** `halls` 是星海的唯一空间单位，`hallId` 是园与馆之间的 canonical ID；`memorials` 只作为馆内人物（灯）的数据来源。正式星海先以客户端 2.5D 场景交付，复用现有底部抽屉和供奉流程；3D 作为同一空间数据之上的 progressive enhancement，所有语义热区、键盘操作和回退逻辑由 DOM 交互层承担。园与馆共用一个状态契约：URL 保存可分享的浏览状态，`sessionStorage` 保存镜头快照。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、SQLite/better-sqlite3、现有 `halls`/`memorials` API、CSS Variables、Three.js（仅 3D 增强层）、Playwright。

**Spec:** `docs/四模型分工/墓园页面前端设计规格.md` §1–§8；`docs/web/01-PC前端设计文档.md` §10；`docs/13-馆内多人合馆（长明灯阵）展示方案.md` §11；接口契约见 `docs/08-API接口说明书.md` §3.13。

## Global Constraints

- 星海的一个单位是一个馆：单人馆 = 孤星，N 人馆 = N 星小星阵；馆内人物仍是一盏灯。
- 星海页面为无框场景全宽铺满；仅保留顶部悬浮导航、搜索和视图控制，不显示全局左导航、全局聊天条和页脚。
- 星海只展示 `halls.in_garden = 1` 且 `visibility = 'public'` 的馆；私密馆和群组馆不得进入星海。
- 星群亮度只表达最近 24 小时内是否有人祭扫；不展示访问量、热度、榜单或商业化位置/亮度。
- 星群热区至少 `44 × 44px`；正文对比度至少 `4.5:1`；焦点环统一为 `2px` 烛金。
- 搜索输入姓名、别名或墓志铭，防抖 `300–500ms`；不匹配星群降亮但不从场景中删除或重排。
- 聚焦/页面过渡 `400–700ms`；微交互 `120–180ms`；仪式反馈不超过 `1.2s`。
- `prefers-reduced-motion` 下缩放连续体使用静态或 `0–100ms` 切换；隐藏或静止场景不得持续高频动画。
- URL 只同步视图、搜索、筛选、馆 ID、人物 ID 和抽屉模式；像素高度与镜头坐标写入 `sessionStorage`，不写入 URL。
- 供奉失败必须保留祭品选择和留言并原地重试；任何 HTTP 非 2xx 都不得显示成功。
- 所有修改遵循现有迁移、CSS token、Playwright 和部署脚本；不重置工作区已有用户改动。
- 实施前先阅读当前 Next.js 指南 `node_modules/next/dist/docs/index.md`，确认 Next.js 16 的 layout、route handler 和 client boundary 约定。

## 现状基线

执行者先确认以下事实，再开始任何实现：

- `src/app/[lang]/garden/page.tsx` 仍直接查询 `memorials.in_garden/garden_slot`。
- `src/components/GardenScene.tsx` 渲染的是 `Tombstone`，`src/components/Garden3D.tsx` 渲染的是石碑 mesh。
- `src/app/api/garden/starsea/route.ts` 已提供 `hallId/x/y/zone/lampCount/candleLit`，但正式页面未消费。
- `src/app/[lang]/hall/[id]/page.tsx` 当前把参数当作 `memorial.id` 查询；传入 `hallId` 会落到“不存在”。
- `src/app/api/memorials/route.ts` 创建 hall 后没有把新 memorial 的 `hall_id` 写成对应 hall ID。
- `src/app/[lang]/layout.tsx` 无条件挂载 `NavBar`、`PcShell`、`ThemeBackground` 和 footer；星海需要独立沉浸壳。
- 现有 `tools/test-starsea.cjs` 测的是 `/proto` 原型，不足以证明正式 `/zh/garden`。

## 文件与职责地图

| 文件 | 责任 | 计划动作 |
|---|---|---|
| `migrations/025_garden_canonical.sql` | 固化馆级索引与存量关联 | 新建 |
| `src/app/api/memorials/route.ts` | 新建馆与首位人物的一致写入 | 修改 |
| `src/app/api/memorials/[id]/garden/route.ts` | 兼容旧入园接口 | 修改为 canonical hall 委托 |
| `src/app/api/garden/starsea/route.ts` | 星海分片数据源 | 修改查询、游标和边界校验 |
| `src/lib/garden-sea.ts` | `GardenSeaHall`、请求参数和状态快照类型 | 新建 |
| `src/lib/garden-sea-state.ts` | 纯状态 reducer 与 URL/session 序列化 | 新建 |
| `src/components/immersive/AppFrame.tsx` | 按 pathname 隐藏普通应用壳 | 新建 |
| `src/app/[lang]/layout.tsx` | 使用 `AppFrame`，保留服务端用户态 | 修改 |
| `src/app/[lang]/garden/page.tsx` | 输出星海客户端入口和初始 query | 重写数据查询 |
| `src/components/starsea/GardenSea.tsx` | 星海主控制器、数据加载和状态机 | 新建 |
| `src/components/starsea/StarSeaScene.tsx` | 2.5D 星群渲染、缩放和平移 | 新建 |
| `src/components/starsea/StarCluster.tsx` | 单人孤星/多人星阵和 DOM 热区 | 新建 |
| `src/components/starsea/StarSeaDrawer.tsx` | 列表、详情、供奉三态抽屉 | 新建，复用既有供奉契约 |
| `src/components/starsea/StarSeaControls.tsx` | 返回、搜索、筛选、视图、复位 | 新建 |
| `src/components/starsea/StarSea3D.tsx` | 可选 Three.js 层和 2D overlay | 新建 |
| `src/app/[lang]/hall/[id]/page.tsx` | 接受 canonical hall ID 与旧 memorial ID 兼容 | 修改 |
| `src/components/hall/HallSceneClient.tsx` | 馆级灯阵入口、人物聚焦和返回星海 | 新建/抽离 |
| `src/app/globals.css` | 星海 token、沉浸壳、响应式和 motion | 修改 |
| `tests/e2e/starsea.spec.ts` | 正式星海桌面/移动回归 | 新建 |
| `tools/test-starsea-formal.mjs` | API、状态、错误和大数据冒烟 | 新建 |
| `tools/visual-garden.mjs` | 固定视口视觉基线 | 修改为正式星海 |
| `docs/08-API接口说明书.md`、`docs/09-数据库设计.md` | 契约和迁移记录 | 修改 |

## 交付阶段

### Task 1: 锁定馆级数据与 canonical ID

**目标：** 让所有新旧入口都能明确区分“馆 ID”和“人物 ID”，且新建馆一定拥有可查询的首位人物。

**Files:**
- Create: `migrations/025_garden_canonical.sql`
- Modify: `src/app/api/memorials/route.ts`
- Modify: `src/app/api/memorials/[id]/garden/route.ts`
- Modify: `src/app/api/garden/starsea/route.ts`
- Test: `tools/test-starsea-formal.mjs`

**Interfaces:**
- `GardenSeaHall.hallId` 永远是 `halls.id`，格式仍兼容现有 `hall_<memorial uuid>`。
- `POST /api/memorials` 成功后必须满足：`memorials.hall_id = halls.id`、`halls.owner_user_id = memorials.user_id`、两者 visibility 一致。
- `POST /api/memorials/[id]/garden` 仍接受旧 `{ in_garden: boolean }`，内部解析人物所属 hall 后调用同一馆级写路径；响应增加 `hallId`、`inGarden`、`x`、`y`，保留旧字段兼容客户端。
- `GET /api/garden/starsea` 响应保持 `{ halls: GardenSeaHall[], nextCursor: string | null }`；不返回原始姓名、访问量或热度字段。

- [ ] **Step 1: 写迁移幂等性与存量关联检查**

```sql
-- 025 星海 canonical 数据约束与查询索引
UPDATE memorials
SET hall_id = 'hall_' || id
WHERE COALESCE(hall_id, '') = ''
  AND EXISTS (SELECT 1 FROM halls h WHERE h.id = 'hall_' || memorials.id);

CREATE INDEX IF NOT EXISTS idx_memorials_hall_public
  ON memorials (hall_id, is_published, created_at);

CREATE INDEX IF NOT EXISTS idx_halls_garden_lookup
  ON halls (in_garden, visibility, garden_zone, garden_x, garden_y);
```

- [ ] **Step 2: 运行空库和现有库迁移验证**

运行：

```powershell
npm run db:migrate
npm run db:verify
```

预期：所有迁移为 `applied`，`integrity_check` 为 `ok`，原有 memorial/hall 数量不减少，重复执行不产生 checksum 或唯一键错误。

- [ ] **Step 3: 修复建馆事务**

在 `src/app/api/memorials/route.ts` 中使用事务包住两次 INSERT，先生成 `hallId = "hall_" + id`，再同时写入：

```ts
db.transaction(() => {
  db.prepare(/* memorial insert */).run(id, /* ..., */);
  db.prepare(/* hall insert */).run(hallId, name, visibility, user.id);
  db.prepare("UPDATE memorials SET hall_id = ? WHERE id = ?").run(hallId, id);
  db.prepare("INSERT INTO memorial_audit_logs ...").run(id, user.id);
})();
```

事务回滚时不得留下只有 memorial 或只有 hall 的半成品。

- [ ] **Step 4: 让旧入园 API 委托馆级写路径**

读取 `memorials.hall_id`，找不到时使用 `hall_ + memorial.id` 作为兼容候选；只允许馆主操作；公开馆调用同一 `garden_x/garden_y` 写入逻辑。旧 `garden_section/garden_slot` 字段只保留给历史客户端读取，不再驱动正式星海。

- [ ] **Step 5: 增强星海 API 参数和查询边界**

实现以下参数：

```ts
type StarSeaQuery = {
  zone: "public" | "family" | "official" | null;
  bbox: [number, number, number, number] | null;
  cursor: string | null;
  limit: number; // 默认 200，上限 500
};
```

对 `bbox` 做 `0 <= x1 <= x2 <= 1`、`0 <= y1 <= y2 <= 1` 校验；非法参数返回 `400 invalid_bbox`，不要静默查询全表。按 `h.id ASC` 稳定排序，返回 `nextCursor`；没有下一页时返回 `null`。没有可见人物的 hall 不返回，避免 `lampCount=0` 空星群。

- [ ] **Step 6: 执行正式 API 冒烟**

`tools/test-starsea-formal.mjs` 至少断言：

```js
assert(Array.isArray(body.halls));
assert(body.halls.every((h) => h.hallId && h.lampCount >= 1));
assert(body.halls.every((h) => h.nameMasked.includes("*") || h.nameMasked.length <= 1));
assert(body.halls.every((h) => !Object.hasOwn(h, "views") && !Object.hasOwn(h, "heat")));
assert((await get("?bbox=0.4,0.2,0.6,0.45")).halls.every((h) => h.x >= 0.4 && h.x <= 0.6));
```

- [ ] **Step 7: 提交独立变更**

运行 `node tools/test-starsea-formal.mjs` 和 `npm run db:verify` 均通过后提交：

```powershell
git add migrations/025_garden_canonical.sql src/app/api/memorials/route.ts src/app/api/memorials/[id]/garden/route.ts src/app/api/garden/starsea/route.ts tools/test-starsea-formal.mjs
git commit -m "feat: 固化星海馆级数据契约"
```

### Task 2: 建立星海沉浸式应用壳

**目标：** `/[lang]/garden` 和 `/[lang]/hall/[id]` 不再被普通页面的左导航、全局聊天条、主题背景和 footer 挤压或覆盖。

**Files:**
- Create: `src/components/immersive/AppFrame.tsx`
- Modify: `src/app/[lang]/layout.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/starsea.spec.ts`

**Interfaces:**
- `AppFrame` props：`{ lang: string; user: boolean; dict: Dictionary; children: React.ReactNode }`。
- `isImmersivePath(pathname)` 对 `/${lang}/garden` 和 `/${lang}/hall/` 返回 `true`，其他路径返回 `false`。
- 沉浸页仍保留 skip link 和页面主内容，但普通 `NavBar/PcShell/footer/ThemeBackground` 不渲染。

- [ ] **Step 1: 写布局验收断言**

在 `tests/e2e/starsea.spec.ts` 先加入：

```ts
test("星海使用沉浸壳", async ({ page }) => {
  await page.goto("/zh/garden");
  await expect(page.locator(".starsea-shell")).toBeVisible();
  await expect(page.locator(".pc-sidenav")).toBeHidden();
  await expect(page.locator(".pc-chat-strip")).toBeHidden();
  await expect(page.locator('footer[role="contentinfo"]')).toBeHidden();
  await expect(page.locator(".starsea-scene")).toHaveCSS("position", "fixed");
});
```

- [ ] **Step 2: 实现 `AppFrame` 路径分流**

`AppFrame` 使用 `usePathname()` 判断沉浸路径。普通路径渲染现有 `ThemeBackground + NavBar + PcShell + main + footer`；沉浸路径只渲染 `main`，并给 body 内容容器加 `data-immersive="true"`。不要在各页面复制一套导航。

- [ ] **Step 3: 调整根 layout**

把 `src/app/[lang]/layout.tsx` 的普通壳替换为 `AppFrame`。服务端继续调用 `getSessionUser()`，不把 Cookie 或用户对象下发给星海客户端；`AppFrame` 只接收 `user: boolean` 和字典文案。

- [ ] **Step 4: 添加沉浸 token 与安全区**

新增 CSS 变量和类：

```css
.starsea-shell {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #070912;
  isolation: isolate;
}
.starsea-scene { position: absolute; inset: 0; z-index: 0; }
.starsea-controls { position: fixed; inset: env(safe-area-inset-top) 0 auto; z-index: 20; }
.starsea-drawer { position: fixed; inset: auto 0 0; z-index: 30; }
```

桌面端顶部控件内部最大宽度 `1120px`；移动端使用 `padding-inline: 12px`，不产生横向滚动。

- [ ] **Step 5: 完成桌面/移动布局验收**

运行：

```powershell
npx playwright test tests/e2e/starsea.spec.ts --project=desktop-chromium --project=mobile-chromium
```

预期：桌面和 Pixel 7 均无横向溢出；移动端不出现两套顶部导航；星海场景高度等于可视区，不因 footer 产生额外滚动。

### Task 3: 定义空间数据和浏览状态

**目标：** 将数据、镜头、选中项、抽屉和 URL 历史从散落的 React state 收敛为可测试的状态机。

**Files:**
- Create: `src/lib/garden-sea.ts`
- Create: `src/lib/garden-sea-state.ts`
- Modify: `src/app/[lang]/garden/page.tsx`
- Test: `tests/e2e/starsea.spec.ts`

**Interfaces:**

```ts
export type GardenZone = "public" | "family" | "official";

export interface GardenSeaHall {
  hallId: string;
  nameMasked: string;
  x: number;
  y: number;
  zone: GardenZone;
  lampCount: number;
  candleLit: boolean;
  avatarUrl: string;
  birthDate: string;
  deathDate: string;
  epitaph: string;
  constellationOf: string | null;
}

export type GardenPanel = "list" | "detail" | "offer";
export type GardenDrawer = "collapsed" | "half" | "full";
export type GardenView = "2d" | "3d";

export interface GardenSeaState {
  view: GardenView;
  query: string;
  zone: GardenZone | null;
  drawer: GardenDrawer;
  panel: GardenPanel;
  selectedHallId: string | null;
  selectedMemorialId: string | null;
  scale: number;
  offset: { x: number; y: number };
}
```

- [ ] **Step 1: 写 reducer 单元行为的可执行检查**

由于仓库当前没有新增 unit test runner，先在 `tools/test-starsea-formal.mjs` 使用 `node:assert/strict` 导入纯 JS 可执行版本，覆盖：

```js
assert.equal(reduce(initial, { type: "selectHall", hallId: "h1" }).panel, "detail");
assert.equal(reduce(detailState, { type: "back" }).panel, "list");
assert.equal(reduce(offerState, { type: "back" }).panel, "detail");
assert.equal(serializeUrl(detailState).get("hall"), "h1");
assert.equal(deserializeUrl(new URLSearchParams("hall=h1&panel=detail")).selectedHallId, "h1");
```

- [ ] **Step 2: 实现 `garden-sea-state.ts`**

提供 `initialGardenSeaState()`、`gardenSeaReducer(state, action)`、`serializeGardenUrl(state)`、`parseGardenUrl(searchParams)`、`saveGardenCamera(key, camera)`、`loadGardenCamera(key)`。URL 只写 `view/q/zone/hall/memorial/panel`；`scale/offset` 只写 `sessionStorage`，且 JSON 解析失败时回到默认镜头。

- [ ] **Step 3: 定义稳定的星群排序和确定性成员布局**

以 `hallId` 做 hash，按 `lampCount` 取 1–6 个固定偏移，不能使用 `Math.random()`。同一馆在刷新、缩放、搜索后必须保持同一星阵形状。

- [ ] **Step 4: 重写 garden page 输入**

`src/app/[lang]/garden/page.tsx` 不再查 `memorials` 和 `garden_slot`，只读取合法化后的初始 `q` 并渲染：

```tsx
<GardenSea lang={lang} initialQuery={keyword} />
```

星海数据由客户端按当前视口调用 `/api/garden/starsea`；初次加载显示固定尺寸骨架，不因数据返回改变布局。

- [ ] **Step 5: 验证 URL 和浏览器后退**

测试步骤：选星群 → 详情 → 供奉 → 返回详情 → 返回列表 → 清除搜索。每一步都断言 URL 和 `page.goBack()` 结果；刷新带 `?hall=...&panel=detail` 时恢复详情态，不恢复像素坐标。

### Task 4: 交付正式 2.5D 星海垂直切片

**目标：** 用正式 API 渲染“散星 + 单人孤星 + 多人小星阵”，支持点星聚焦、亮灭语义和馆卡片。

**Files:**
- Create: `src/components/starsea/GardenSea.tsx`
- Create: `src/components/starsea/StarSeaScene.tsx`
- Create: `src/components/starsea/StarCluster.tsx`
- Create: `src/components/starsea/StarSeaControls.tsx`
- Create: `src/components/starsea/StarSeaDrawer.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/e2e/starsea.spec.ts`

**Interfaces:**

```tsx
<GardenSea lang={lang} initialQuery={query} />
<StarSeaScene
  halls={halls}
  state={state}
  placementHallId={placementHallId}
  onSelectHall={(hallId) => dispatch({ type: "selectHall", hallId })}
  onEnterHall={(hallId) => enterHall(hallId)}
  onCameraChange={(camera) => saveCamera(camera)}
/>
```

- [ ] **Step 1: 先写正式页面失败断言**

```ts
test("正式页按馆显示星群而不是墓碑", async ({ page }) => {
  await page.goto("/zh/garden");
  await expect(page.locator(".starsea-cluster[data-hall-id='hall_demo_family']")).toBeVisible();
  await expect(page.locator(".starsea-cluster[data-hall-id='hall_demo_family'] .starsea-dot")).toHaveCount(3);
  await expect(page.locator(".tombstone")).toHaveCount(0);
});
```

- [ ] **Step 2: 实现星海数据加载和状态**

首次使用 `bbox=0,0,1,1`，缩放或平移后根据可视区域扩大 10% 请求；请求带 `AbortController`，旧请求返回时不得覆盖新镜头。API 错误显示可重试状态，场景背景仍可操作。

- [ ] **Step 3: 实现星群渲染**

`StarCluster` 要求：

- `lampCount === 1` 渲染一个孤星；`lampCount > 1` 渲染确定性 2–6 星阵。
- 外层 `button` 或等价 DOM 热区最小 `44 × 44px`，`aria-label` 包含脱敏馆名和人数。
- `candleLit=true` 使用暖橙高亮；`false` 使用低亮冷白，不显示“热度”等文案。
- 名牌只显示 `nameMasked`；全景下不逐灯显示姓名。
- `zone=official` 只改变不超过一个 token 的亮度，不改变位置、尺寸或排序。
- 星群位置使用 `left/top` 百分比和场景 camera transform，不用 flex/grid 重排。

- [ ] **Step 4: 实现顶部控制**

顶部只包含返回、搜索、筛选入口、`2.5D/3D` 分段和复位按钮。搜索框拥有真实 `<label>`、清除按钮和结果数 `aria-live="polite"`；搜索不直接改变星群坐标。

- [ ] **Step 5: 实现星群聚焦卡**

单击或触控星群：在 `400–700ms` 内聚焦并打开详情抽屉；卡片展示馆名、人数、生卒摘要、墓志铭和“进馆/供奉”两个并列主操作。双击或 Enter 直接执行进馆，但必须先完成一次可见聚焦状态。

- [ ] **Step 6: 实现抽屉三态**

复用规格中的 `collapsed/half/full`：移动端收起 `64–72px`，半展开 `45%–55%`；桌面宽屏使用底部横向卡片轨道，详情状态最大宽度 `880px`。打开时焦点进入抽屉，关闭时恢复把手焦点；背景设置 `inert`，Esc 按列表 → 详情 → 供奉层级回退。

- [ ] **Step 7: 修复供奉错误分支**

提交 `/api/tribute` 后必须按 `response.status` 处理：

```ts
if (response.ok) {
  dispatch({ type: "offerSucceeded" });
} else if (response.status === 401) {
  dispatch({ type: "offerRequiresLogin" });
} else {
  dispatch({ type: "offerFailed", message: await readApiError(response) });
}
```

成功后保留 `800–1200ms` 反馈并回详情；失败不清空祭品和留言；请求期间按钮禁用但抽屉仍可 Esc 返回。

- [ ] **Step 8: 运行垂直切片验收**

运行：

```powershell
npx playwright test tests/e2e/starsea.spec.ts --project=desktop-chromium --project=mobile-chromium
node tools/test-starsea-formal.mjs
```

通过标准：正式页不出现 `Tombstone`、不读取 `/api/garden` 旧接口、多人馆可见 3 个星点、搜索不改变 `[data-hall-id]` 节点数量和位置、供奉 401/500 不报成功。

### Task 5: 打通园 → 馆 → 人和旧链接兼容

**目标：** 星海点击的 `hallId` 能进入真正馆级页面；馆内人物仍以 `memorialId` 聚焦，旧 memorial URL 不断链。

**Files:**
- Modify: `src/app/[lang]/hall/[id]/page.tsx`
- Create: `src/components/hall/HallSceneClient.tsx`
- Modify: `src/app/api/halls/[id]/route.ts`
- Modify: `src/components/starsea/GardenSea.tsx`
- Test: `tests/e2e/starsea.spec.ts`

**Interfaces:**

```ts
type HallRouteResolution =
  | { kind: "hall"; hallId: string }
  | { kind: "legacyMemorial"; memorialId: string; hallId: string }
  | { kind: "notFound" };
```

canonical 页面地址：`/[lang]/hall/[hallId]`；人物直达使用 `?p=[memorialId]`；从星海进入时附 `from=garden`，仅用于返回状态恢复，不作为权限判断。

- [ ] **Step 1: 写路由兼容测试**

```ts
test("星海 hallId 进入馆页并能聚焦人物", async ({ page }) => {
  await page.goto("/zh/hall/hall_demo_family");
  await expect(page.locator("[data-hall-id='hall_demo_family']")).toBeVisible();
  await page.goto("/zh/hall/31bb8fcc-4e2b-4923-89c3-cc7bcde4237d");
  await expect(page).toHaveURL(/\/zh\/hall\/hall_/);
  await expect(page).toHaveURL(/p=31bb8fcc/);
});
```

- [ ] **Step 2: 实现 ID 解析**

先按 `halls.id` 查询；查不到再按 `memorials.id` 查询并解析 `hall_id`，随后使用 `permanentRedirect` 或等价 canonical redirect 到 hall URL。解析顺序不能让用户提供的 memorial ID 被当作 hall ID 直接查询成员。

- [ ] **Step 3: 把馆级数据接入页面**

页面读取 `GET /api/halls/[hallId]` 同源契约，渲染馆名、1–6 盏灯和馆级公共层；人物详情仍通过现有 memorial API/组件读取。访客视角使用 `nameMasked`，馆主视角才显示原文。

- [ ] **Step 4: 实现进入与返回状态**

`enterHall(hallId)` 在 session snapshot 中保存 `query/zone/selectedHallId/drawer/panel/scale/offset`，再导航到 `/hall/[hallId]`。馆页点击返回或接收到拉远阈值时回 `/garden`，恢复 snapshot；snapshot 过期或 JSON 无效时回默认星海。

- [ ] **Step 5: 实现人物聚焦参数**

`?p=memorialId` 只在 hall 成员列表中命中时聚焦；不属于该馆时忽略并回馆级公共层。聚焦后 URL 保留 `p`，Esc 清除 `p` 并回馆级层，不产生跨馆读取。

- [ ] **Step 6: 运行链路回归**

断言：星海 → hall → 人物抽屉 → 返回星海；旧 `/hall/[memorialId]` 自动 canonical；不存在 hall 返回既有 404 UI；群组/私密馆继续返回 not found，不因 ID 兼容绕过权限。

### Task 6: 正式择位模式与空间搜索

**目标：** 让馆主在显式“择位”模式中拖拽星群，处理冲突建议位；普通浏览不因拖拽误触移动场景。

**Files:**
- Modify: `src/components/starsea/GardenSea.tsx`
- Modify: `src/components/starsea/StarSeaScene.tsx`
- Modify: `src/components/starsea/StarSeaControls.tsx`
- Modify: `src/components/MePanels.tsx`
- Modify: `src/app/api/halls/[id]/garden-pos/route.ts`
- Test: `tests/e2e/starsea.spec.ts`

**Interfaces:**

```ts
type PlacementState = { hallId: string; active: true } | { active: false };
type GardenPlacementResponse =
  | { ok: true; inGarden: true; x: number; y: number }
  | { error: "position_conflict"; suggested: { x: number; y: number } }
  | { error: "forbidden" | "visibility_required" | "not_found" };
```

- [ ] **Step 1: 写择位测试**

测试馆主进入择位后拖拽到空位，断言 PATCH body 为 `x/y`；拖到占用点，断言 UI 呈现建议位并可确认吸附；Esc 退出后普通点击重新恢复聚焦；访客看不到择位控制。

- [ ] **Step 2: 统一“我的”入口**

`MePanels.tsx` 不再只调用旧 `POST /api/memorials/[id]/garden`；公开馆使用 `/hall/[hallId]` 的星海择位入口。旧接口保留给历史客户端，但成功后跳转带 `?placing=[hallId]`。

- [ ] **Step 3: 实现显式拖拽**

只有 `placement.active === true` 时启用 pointer capture；普通模式 pointer down/up 只处理点击。坐标按 scene `getBoundingClientRect()` 转换为 0–1 并 clamp，发送前保留 3 位小数。拖拽期间显示 44px 目标环和当前坐标，不显示精确数值给普通访客。

- [ ] **Step 4: 处理写入状态**

发送中锁定当前星群但允许 Esc；200 后更新本地坐标并 toast；409 显示“这里太靠近其他纪念馆”，提供“使用建议位置”按钮；403 显示公开权限提示；网络错误保持原位置并支持重试。

- [ ] **Step 5: 保持搜索空间不变**

搜索只改变 `is-dimmed`、抽屉结果和选中候选，不改变场景节点数组。匹配别名需要 API/数据提供别名字段；在该字段未存在时只搜索馆名、首位人物名和墓志铭，不伪造别名命中。

### Task 7: 3D progressive enhancement、2D overlay 与降级

**目标：** 让 3D 共享星海数据，但不承担语义交互；GPU、键盘或 reduced-motion 条件不满足时自动回 2.5D。

**Files:**
- Create: `src/components/starsea/StarSea3D.tsx`
- Modify: `src/components/starsea/GardenSea.tsx`
- Modify: `src/components/Garden3D.tsx`（只保留旧页兼容或删除旧入口前先确认无调用）
- Modify: `src/app/globals.css`
- Test: `tests/e2e/starsea.spec.ts`

**Interfaces:**

```tsx
<StarSea3D
  halls={halls}
  camera={camera}
  onCameraChange={saveCamera}
  onSelectHall={selectHall}
  overlay={<StarSeaDomOverlay halls={halls} />}
  onFatalError={() => dispatch({ type: "fallback2d" })}
/>
```

- [ ] **Step 1: 先写降级验收**

用 Playwright 注入 WebGL 不可用和 `prefers-reduced-motion: reduce`：

```ts
await page.addInitScript(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});
await page.goto("/zh/garden?view=3d");
await expect(page.locator(".starsea-scene-2d")).toBeVisible();
await expect(page.locator("[role='status']")).toContainText("2.5D");
```

- [ ] **Step 2: 实现可回收的 Three.js 层**

使用 `ResizeObserver` 同步宽高；`devicePixelRatio` 上限 2；监听 `webglcontextlost`，阻止默认行为并调用 `onFatalError`。清理 geometry、material、texture、controls、renderer、rAF 和 observer。页面隐藏或 reduced-motion 时停止 rAF，只在镜头变化时渲染一帧。

- [ ] **Step 3: 实现独立 DOM overlay**

每个可见星群生成投影后的 `<button>`，包含 `aria-label`、`tabIndex` 和焦点环；canvas 设 `aria-hidden="true"`。方向键按当前屏幕距离选择上下左右最近星群，Enter 聚焦，Esc 回退；重叠时打开候选菜单而不是随机选择。

- [ ] **Step 4: 对齐 2D/3D 状态**

切换 view 不清除 query、zone、selected、drawer、panel；2D/3D 使用同一 `GardenSeaState` 和同一 `GardenSeaHall[]`。切换后保留 camera snapshot，若 3D 初始化失败只替换 scene renderer，不替换抽屉和控制条。

- [ ] **Step 5: 运行 GPU/键盘回归**

覆盖真实 canvas 存在、无 canvas fallback、Tab/方向键/Enter/Esc、焦点可见、`aria-hidden` 和无 pageerror。Three.js 的 deprecated warning 记录为依赖升级项，不把 warning 当作功能成功证据。

### Task 8: 性能、动效和规模策略

**目标：** 让星海在馆量增长、清明高峰和低性能设备上仍可操作。

**Files:**
- Modify: `src/app/api/garden/starsea/route.ts`
- Modify: `src/components/starsea/StarSeaScene.tsx`
- Modify: `src/components/starsea/GardenSea.tsx`
- Modify: `src/app/globals.css`
- Test: `tools/test-starsea-formal.mjs`
- Test: `tests/e2e/starsea.spec.ts`

- [ ] **Step 1: 生成大数据测试夹具**

在测试脚本中使用临时 SQLite 数据库或事务内插入 600 个可清理的 public halls，每个 hall 至少关联一个 published memorial，测试结束回滚或按运行前缀删除，不修改开发库基线。

- [ ] **Step 2: 验证 bbox、游标和稳定排序**

断言相邻 bbox 请求不重复丢失边界馆；使用 `nextCursor` 读取完整集合；相同数据重复请求顺序一致；超过 500 条不会静默截断成不可见空白。

- [ ] **Step 3: 实现前端 LOD**

远景只渲染光晕粒子和可访问的聚合数量，进入可视阈值后再挂载星群 DOM 和名牌；同一帧最多更新可见星群；抽屉卡片使用固定宽度和横向滚动，不一次性渲染超出可视区域的详情内容。

- [ ] **Step 4: 实现 reduced-motion 和低性能档**

`prefers-reduced-motion` 下关闭星光、雾气和萤火无限动画；低性能设备只保留静态星点和 CSS opacity，不创建 Three.js；提供用户可恢复完整动效的本地设置，但默认尊重系统偏好。

- [ ] **Step 5: 清理资源与监测指标**

记录首次星海可交互时间、首次 bbox 请求耗时、当前可见星群数、3D fallback 次数和 API 失败率；不记录馆访问量或用于排序的热度指标。生产日志只保留 request id、耗时和错误码。

### Task 9: 正式回归、视觉基线和文档同步

**目标：** 用正式 `/zh/garden` 证明实现完成，并把旧原型测试与正式测试区分开。

**Files:**
- Create: `tests/e2e/starsea.spec.ts`
- Modify: `tools/visual-garden.mjs`
- Modify: `tools/mobile-audit-check.mjs`
- Modify: `docs/08-API接口说明书.md`
- Modify: `docs/09-数据库设计.md`
- Modify: `docs/web/03-PC-API接口文档.md`
- Modify: `docs/服务器部署运维手册.md`（仅补发布验证命令）

- [ ] **Step 1: 桌面端 Playwright 测试**

覆盖：

```ts
test("桌面星海主旅程", async ({ page }) => {
  await page.goto("/zh/garden");
  await expect(page.locator(".starsea-cluster").first()).toBeVisible();
  await page.getByRole("textbox", { name: "搜索星海" }).fill("王");
  await expect(page.locator(".starsea-cluster")).toHaveCount(5);
  await page.locator(".starsea-cluster").first().click();
  await expect(page.getByRole("region", { name: "星群详情" })).toBeVisible();
  await page.getByRole("link", { name: "进入纪念馆" }).click();
  await expect(page).toHaveURL(/\/zh\/hall\/hall_/);
});
```

实际测试名称和 locator 以实现后的语义 DOM 为准，但必须覆盖同一行为，不得只做源码字符串断言。

- [ ] **Step 2: 移动端 Playwright/触控测试**

在 Pixel 7 项目验证：顶部安全区、双指/滚轮等价缩放、长按预览、抽屉拖拽、详情双 CTA 纵向排列、无横向溢出、键盘不可用时仍有 44px 热区。截图至少保存空态、多人星群、详情抽屉和择位态。

- [ ] **Step 3: 无障碍和 motion 测试**

断言：焦点顺序为控件 → 星群 → 抽屉；抽屉打开后背景 `inert`；`Escape` 逐层回退；状态播报不是只变颜色；`prefers-reduced-motion` 不存在无限动画且过渡时长不超过 `100ms`。

- [ ] **Step 4: 视觉基线**

更新 `tools/visual-garden.mjs` 只访问正式 `/zh/garden`，输出：

```text
docs/shots/garden-starsea-2d-desktop.png
docs/shots/garden-starsea-2d-mobile.png
docs/shots/garden-starsea-detail.png
docs/shots/garden-starsea-placement.png
```

目检清单：星群不被控件遮挡、多人星阵可数、暗星与亮星有语义差异、名牌不溢出、抽屉不遮住主要 CTA、背景不出现旧墓碑。

- [ ] **Step 5: 更新接口与数据库文档**

记录 025 迁移、`hallId` canonical 规则、旧 memorial URL 重定向、`bbox/cursor/limit` 参数、3D fallback、正式测试入口；保留“家族星座连线在 M4 前为 `null`”的明确限制，不把未上线能力写成已实现。

- [ ] **Step 6: 全量验证和发布前门槛**

运行：

```powershell
npm run build
npm run db:verify
npm run smoke:p1
npm run smoke:p2
npm run smoke:p4
npm run smoke:auth
npx playwright test tests/e2e/starsea.spec.ts --project=desktop-chromium --project=mobile-chromium
node tools/test-starsea-formal.mjs
```

所有命令通过后，才把 `docs/release-checklist.md` 中“正式星海验证”标记为完成；任何 Stripe、微信、OSS、备案等外部条件仍按发布清单原状态处理，不因星海完成而误标。

## 建议提交节奏

每个 Task 独立提交，顺序固定为：

1. `feat: 固化星海馆级数据契约`
2. `feat: 增加星海沉浸式应用壳`
3. `feat: 收敛星海浏览状态`
4. `feat: 上线正式二维星海`
5. `fix: 统一星海馆级路由`
6. `feat: 增加星海择位模式`
7. `feat: 增加星海三维增强与降级`
8. `perf: 增加星海分片与低性能档`
9. `test: 增加正式星海回归与视觉基线`

每次提交前只加入该 Task 的文件；不要把现有工作区中的语音、微信、Showreel 或隐私政策改动混入星海提交。

## 验收定义

星海前端只有同时满足以下条件才算完成：

- `/zh/garden` 桌面和移动端均显示馆级星群，三人馆显示三颗确定性星点，不再显示墓碑。
- 星群使用 `halls.garden_x/garden_y`，搜索不重排空间；亮灭使用 24 小时祭扫语义。
- 星海点击进入 `/zh/hall/[hallId]`，馆页能按 `?p=[memorialId]` 聚焦人物；旧 memorial URL 自动 canonical。
- 普通浏览、详情、供奉、择位、返回恢复和浏览器后退均有明确状态闭环。
- 3D 失败、WebGL 不可用、reduced-motion 或低性能设备均能回到可操作 2.5D。
- 44px 热区、键盘、屏幕阅读器、焦点管理、错误重试、无横向溢出均通过 Playwright 验收。
- API 分片、游标、稳定排序、索引和资源清理在 600+ 馆夹具下通过性能冒烟。
- 文档、视觉基线、正式测试、构建和现有 P1/P2/P4/auth 回归全部通过。

## 风险与回滚

| 风险 | 触发条件 | 回滚动作 |
|---|---|---|
| 存量 hall 关联异常 | 025 迁移后出现 `hall_id` 空值或孤儿 hall | 停止前端切换，恢复数据库备份，修复迁移后重新执行；旧 `/api/garden` 保持可用 |
| canonical 路由误伤旧链接 | 旧 memorial URL 无法跳转或权限扩大 | 回滚 hall page 提交，保留 API 数据迁移；所有旧 URL 继续走既有 memorial 页面 |
| 沉浸壳影响普通页面 | 非 garden/hall 页面导航或 footer 消失 | 回滚 `AppFrame`，星海页面暂时通过独立 client wrapper 隔离 |
| 3D GPU/内存问题 | context lost、帧率低、页面崩溃 | 关闭 3D feature flag，默认 2.5D；不删除星海数据和 DOM overlay |
| API 分片误漏数据 | bbox 边界重复/缺失或 cursor 不稳定 | 回退到稳定全量上限接口，保留索引和日志，修复查询排序后再启用分片 |
| 供奉错误误报 | 非 2xx 仍显示成功 | 立即回退供奉 UI 到错误可见版本；数据库不做补偿性重复写入 |

## 计划自检结果

- 规格覆盖：§1–§7 由 Task 2–Task 4、Task 7–Task 9 覆盖；§8 星海模型由 Task 1、Task 4、Task 6、Task 8 覆盖；PC §10 由 Task 2、Task 4、Task 7 覆盖；13 号方案 §11 由 Task 5、Task 6 覆盖。
- 类型一致性：API 与组件统一使用 `GardenSeaHall.hallId`；状态统一使用 `selectedHallId`，人物聚焦统一使用 `selectedMemorialId`；canonical 路由统一使用 `hallId`。
- 测试覆盖：API 契约、迁移幂等、正式桌面/移动旅程、键盘/无障碍、reduced-motion、供奉失败、WebGL fallback、bbox/cursor/600+ 规模均有明确命令或断言。
- 未纳入本计划：M4 族谱驱动的星座连线、Stripe/微信/OSS/深度合成备案等外部发布条件；这些能力不因本次星海前端改造而提前宣称完成。
