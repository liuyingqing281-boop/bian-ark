import { expect, test } from "@playwright/test";
import { apiLogin, emailOf, RUN } from "./helpers";

test.describe("登录旅程", () => {
  test("邮箱验证码完整 UI 登录（dev 显示验证码）", async ({ page }) => {
    const mail = emailOf("auth");
    await page.goto("/zh/login");

    await page.getByPlaceholder("you@example.com").fill(mail);
    await page.getByRole("button", { name: "发送验证码" }).click();

    const codeText = await page.getByText(/开发模式验证码：/).textContent();
    const code = codeText?.match(/(\d{6})/)?.[1];
    expect(code, "dev 验证码应显示在页面上").toBeTruthy();

    await page.getByPlaceholder("6 位验证码").fill(code!);
    await page.getByPlaceholder("昵称（可选，首次登录）").fill(`E2E-${RUN}`);
    await page.getByRole("button", { name: "登录 / 注册" }).click();

    await page.waitForURL(/\/zh\/me/, { timeout: 10_000 });
    await expect(page.getByText("我的空间")).toBeVisible();
  });

  test("登录态在导航栏体现（我的）", async ({ page }) => {
    await apiLogin(page.context().request, emailOf("auth2"));
    await page.goto("/zh");
    await expect(page.getByRole("link", { name: "我的" })).toBeVisible();
  });

  test("退出登录后回到未登录态", async ({ page }) => {
    await apiLogin(page.context().request, emailOf("auth3"));
    await page.goto("/zh/me");
    await page.getByRole("button", { name: "退出登录" }).click();
    await page.waitForURL(/\/zh\/login/, { timeout: 10_000 });
  });
});
