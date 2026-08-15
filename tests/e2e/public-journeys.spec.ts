import { expect, test } from "@playwright/test";

test("健康检查和安全头可用", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const body = await response.json();
  expect(body.checks.database.ok).toBe(true);
  expect(body.checks.storage.ok).toBe(true);
});

for (const pathname of ["/zh", "/zh/garden", "/zh/membership", "/zh/login"]) {
  test(`${pathname} 无阻断级页面错误`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(pathname, { waitUntil: "networkidle" });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
}
