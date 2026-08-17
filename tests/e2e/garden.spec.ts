import { expect, test } from "@playwright/test";
import { apiLogin, createMemorialViaApi, emailOf, patchMemorialViaApi, RUN } from "./helpers";

// 公共墓园旅程（F4）：安放 → 浏览 → 点击进馆
test.describe("公共墓园旅程", () => {
  const owner = emailOf("gardenowner");
  const memorialName = `${RUN}墓园馆`;
  let memorialId = "";

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    await apiLogin(ctx.request, owner);
    memorialId = await createMemorialViaApi(ctx.request, memorialName);
    await patchMemorialViaApi(ctx.request, memorialId, { visibility: "public" });
    const place = await ctx.request.post(`/api/memorials/${memorialId}/garden`, { data: { in_garden: true } });
    if (!place.ok()) throw new Error(`place garden failed: ${place.status()}`);
    await ctx.close();
  });

  test("墓园页展示已安放的纪念馆并可点击进馆", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/zh/garden");

    // 卡片是真实 <Link>，按 href 定位最稳（不受场景动画层干扰）
    const card = page.locator(`a[href="/zh/memorial/${memorialId}"]`);
    await expect(card).toBeVisible({ timeout: 20_000 });

    await card.click();
    await page.waitForURL(new RegExp(`/zh/memorial/${memorialId}`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: memorialName })).toBeVisible();
  });

  test.afterAll(async () => {
    const { cleanupRun } = await import("./helpers");
    cleanupRun();
  });
});
