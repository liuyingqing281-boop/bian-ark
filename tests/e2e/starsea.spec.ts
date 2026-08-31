import { expect, test } from "@playwright/test";

// 星海沉浸壳（Task 2）：/zh/garden 与 /zh/hall/* 不再被普通壳层（左导航/聊天条/footer）挤压
test.describe("星海沉浸壳", () => {
  test("星海使用沉浸壳", async ({ page }) => {
    await page.goto("/zh/garden");
    await expect(page.locator(".starsea-shell")).toBeVisible();
    await expect(page.locator(".pc-sidenav")).toBeHidden();
    await expect(page.locator(".pc-chat-strip")).toBeHidden();
    await expect(page.locator('footer[role="contentinfo"]')).toBeHidden();
    await expect(page.locator(".starsea-scene")).toHaveCSS("position", "fixed");
  });

  test("星海场景铺满可视区", async ({ page }) => {
    await page.goto("/zh/garden");
    const box = await page.locator(".starsea-scene").boundingBox();
    const viewport = page.viewportSize();
    expect(box, "starsea-scene 应存在").toBeTruthy();
    expect(Math.abs(box!.height - viewport!.height), "场景高度应等于可视区高度").toBeLessThanOrEqual(1);
  });

  test("星海页面无横向溢出", async ({ page }) => {
    await page.goto("/zh/garden");
    const overflowed = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflowed, "页面不应出现横向滚动").toBe(false);
  });

  test("星海页移动端不出现两套顶部导航", async ({ page }) => {
    await page.goto("/zh/garden");
    await expect(page.locator(".pc-topbar")).toBeHidden();
  });
});
