import { expect, test, type Page } from "@playwright/test";
import { apiLogin, emailOf, gotoStable } from "./helpers";

// 2026-08-24/25 契约适配（登录/注册分离 + 密码体系）：
// 默认登录 tab·密码方式；注册专门 tab（验证码 + 密码两行 + 协议勾选）。
// 原断言意图保留：完整验证码 UI 流程、dev 验证码回显、登录态体现与登出。

/** 登录页挂 ConceptStage 大客户端包：等静态资源加载完（水合就绪）再交互，
 *  避免 fill/click 落在水合前被 React 重置（dev 并行加载下的已知竞态） */
async function settleHydration(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

/** 依次填表直至提交钮就绪：若受控输入被水合重置（按钮仍禁用），稍候重填 */
async function fillUntilEnabled(page: Page, fills: Array<() => Promise<void>>, submitLabel: string): Promise<void> {
  const submit = page.getByRole("button", { name: submitLabel, exact: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const fill of fills) await fill();
    if (await submit.isEnabled().catch(() => false)) return;
    await page.waitForTimeout(300);
  }
  await expect(submit).toBeEnabled();
}

test.describe("登录旅程", () => {
  test("注册 tab 邮箱验证码完整 UI 注册（dev 显示验证码）", async ({ page }) => {
    test.setTimeout(60_000);
    const mail = emailOf("auth");
    await gotoStable(page, "/zh/login");
    await settleHydration(page);

    await page.getByRole("button", { name: "注册", exact: true }).click();
    await page.getByRole("button", { name: "邮箱", exact: true }).click();
    await page.getByPlaceholder("you@example.com").fill(mail);
    await page.getByRole("button", { name: "发送验证码" }).click();

    const codeText = await page.getByText(/开发模式验证码：/).textContent();
    const code = codeText?.match(/(\d{6})/)?.[1];
    expect(code, "dev 验证码应显示在页面上").toBeTruthy();

    // 勾选协议：直接操作 checkbox（协议文案 span 内嵌条款链接，点文本会误跳条款页）
    await page.getByRole("checkbox").check();
    await fillUntilEnabled(
      page,
      [
        () => page.getByPlaceholder("6 位验证码").fill(code!),
        () => page.getByPlaceholder("密码", { exact: true }).fill("Test1234!ok"),
        () => page.getByPlaceholder("确认密码").fill("Test1234!ok"),
      ],
      "注册并进入"
    );
    await page.getByRole("button", { name: "注册并进入", exact: true }).click();

    // dev 冷编译下 verify 响应可能偏慢，toast 在响应后仅显示约 1 秒：放宽等待窗口
    await expect(page.getByText("注册成功")).toBeVisible({ timeout: 15_000 });
    // commit：跳转一提交即算到达，不等 /zh/me 首编译的完整 load（dev 下偏慢）
    await page.waitForURL(/\/zh\/me/, { timeout: 20_000, waitUntil: "commit" });
    await expect(page.getByText("我的空间")).toBeVisible();
  });

  test("登录 tab 密码方式完整 UI 登录", async ({ page, request }) => {
    test.setTimeout(60_000);
    const mail = emailOf("auth-pw");
    // request 夹具为独立上下文：注册种子不把浏览器置为已登录，保持纯 UI 登录旅程
    await apiLogin(request, mail);
    await gotoStable(page, "/zh/login");
    await settleHydration(page);

    await fillUntilEnabled(
      page,
      [
        () => page.getByPlaceholder("手机号 / 邮箱").fill(mail),
        () => page.getByPlaceholder("密码", { exact: true }).fill("Test1234!ok"),
      ],
      "进入彼岸"
    );
    await page.getByRole("button", { name: "进入彼岸", exact: true }).click();

    await page.waitForURL(/\/zh\/me/, { timeout: 20_000, waitUntil: "commit" });
    await expect(page.getByText("我的空间")).toBeVisible();
  });

  test("登录态在导航栏体现（我的）", async ({ page }) => {
    await apiLogin(page.context().request, emailOf("auth2"));
    await gotoStable(page, "/zh");
    // dev 下 /zh 首编译可能偏慢：放宽首帧断言窗口
    await expect(page.getByRole("link", { name: "我的" })).toBeVisible({ timeout: 15_000 });
  });

  test("退出登录后回到未登录态", async ({ page }) => {
    await apiLogin(page.context().request, emailOf("auth3"));
    await gotoStable(page, "/zh/me");
    await settleHydration(page);
    await page.getByRole("button", { name: "退出登录" }).click();
    await page.waitForURL(/\/zh\/login/, { timeout: 20_000, waitUntil: "commit" });
  });
});
