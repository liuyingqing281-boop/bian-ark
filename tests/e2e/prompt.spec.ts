// 旅程（Issue #8）：登录 → 公开纪念馆 → 我的祭品 tab → 帮我写 → 结果可编辑 → 回填生成框
// provider 自适应：mock 环境（无 ARK key）结果以【模拟扩写】开头；ark 环境为真实扩写。
// 不点真生成（避免花额度），只断言回填。
import { expect, test } from "@playwright/test";
import { apiLogin, createMemorialViaApi, emailOf, patchMemorialViaApi, RUN } from "./helpers";

test("祭品提示词助手全旅程", async ({ browser, page }) => {
  test.setTimeout(60_000);

  // 数据准备：owner 建馆并公开
  const owner = emailOf("promptowner");
  const ctx = await browser.newContext();
  await apiLogin(ctx.request, owner);
  const mid = await createMemorialViaApi(ctx.request, `${RUN}提示词馆`);
  await patchMemorialViaApi(ctx.request, mid, { visibility: "public" });
  await ctx.close();

  // 操作者登录后进入纪念馆
  await apiLogin(page.context().request, emailOf("promptuser"));
  await page.goto(`/zh/memorial/${mid}`);

  // 助手区块在「我的祭品」tab 内
  await page.getByRole("button", { name: "我的祭品" }).click();
  const ideaBox = page.getByPlaceholder("想供奉什么？例：一束白菊");
  await expect(ideaBox).toBeVisible();

  // 帮我写（mock 秒回；ark 真实约 4~6 秒）
  await ideaBox.fill("一束白菊");
  await page.getByRole("button", { name: "帮我写" }).click();
  await expect(page.getByText("扩写结果（可修改后生成）")).toBeVisible({ timeout: 20_000 });

  // 结果框：非馆主视图下页面上唯一的 textarea；断言非空（mock 时以【模拟扩写】开头）
  const resultBox = page.locator("textarea").first();
  const value = await resultBox.inputValue();
  expect(value.trim().length).toBeGreaterThan(4);

  // 用这个生成 → 回填生成输入框（按占位文案定位，值与结果一致）
  await page.getByRole("button", { name: "用这个生成" }).click();
  const genInput = page.getByPlaceholder("描述你想要的祭品，如：一束白色马蹄莲");
  await expect(genInput).toHaveValue(value);
});
