import { expect, test } from "@playwright/test";
import { gotoStable } from "./helpers";

// Task 3（星海前端）：garden 页输入切换 —— 服务端墓园卡片渲染移除，页面只注入
// lang + 合法化初始 q（GardenSea lang/initialQuery），星海数据与交互由客户端
// 状态机（components/starsea/GardenSea + lib/garden-sea-state）接管。
// 注：本文件按控制器裁决承接 Task 3 的页面级断言（starsea.spec.ts 仍归沉浸壳契约）。
test.describe("星海页面输入切换（Task 3）", () => {
  test("沉浸壳保留，旧墓园卡片渲染已移除", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoStable(page, "/zh/garden");
    await expect(page.locator(".starsea-shell")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".starsea-scene")).toBeVisible();
    // 旧墓园 UI（卡片轨道/墓碑卡片/墓园导航）不应再由服务端渲染
    await expect(page.locator(".garden-card-rail")).toHaveCount(0);
    await expect(page.locator(".garden-card")).toHaveCount(0);
    await expect(page.locator(".garden-nav")).toHaveCount(0);
  });

  test("初次加载显示固定尺寸 garden-sea 骨架", async ({ page }) => {
    test.setTimeout(60_000);
    await gotoStable(page, "/zh/garden");
    const sea = page.locator(".garden-sea");
    await expect(sea).toBeVisible({ timeout: 15_000 });
    const box = await sea.boundingBox();
    expect(box, "garden-sea 应有非零尺寸").toBeTruthy();
    expect(box!.width, "garden-sea 宽度应铺满场景").toBeGreaterThan(0);
    expect(box!.height, "garden-sea 高度应铺满场景").toBeGreaterThan(0);
  });

  test("URL 状态往返：详情参数初始化后按白名单顺序规范化回写", async ({ page }) => {
    test.setTimeout(60_000);
    // 无交互的 reducer 相邻断言：URL → parseGardenUrl → serializeGardenUrl → replaceState。
    // 乱序入参被序列化为 view/q/zone/hall/memorial/panel 白名单顺序的规范 URL。
    await gotoStable(page, "/zh/garden?panel=detail&hall=h1&zone=public");
    await expect(page.locator(".garden-sea")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/zone=public&hall=h1&panel=detail/, { timeout: 15_000 });
  });
});

// 旧「公共墓园卡片旅程」依赖 Task 3 移除的服务端墓园卡片渲染，本任务起失效；
// Task 4/T9 将以星群交互（选星群 → 详情 → /zh/hall/hall_* 进馆）重写本旅程后启用
// （见 progress.md 预检裁决：旅程意图保留、定位器换星群语义）。
test.skip("墓园页展示已安放的纪念馆并可点击进馆（待 Task 4 以星群旅程重写）", async () => {
  // Task 4/T9：建馆安放 → 星海选星群 → 详情 → 进馆 /zh/hall/hall_* 旅程
});
