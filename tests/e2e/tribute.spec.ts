import { expect, test } from "@playwright/test";
import { apiLogin, createMemorialViaApi, emailOf, patchMemorialViaApi, RUN } from "./helpers";

// 北极星旅程：匿名访客对公开纪念馆完成一次祭奠（PRD 3.0 D4 匿名献祭）
test.describe("匿名祭奠旅程", () => {
  const owner = emailOf("tribowner");
  const memorialName = `${RUN}祭奠馆`;
  const message = `安息，来自E2E ${RUN}`;
  let memorialId = "";

  test.beforeAll(async ({ request }) => {
    await apiLogin(request, owner);
    memorialId = await createMemorialViaApi(request, memorialName);
    await patchMemorialViaApi(request, memorialId, { visibility: "public" });
  });

  test("匿名选择祭品、留言并完成供奉（含审核上墙）", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`/zh/memorial/${memorialId}`);
    await expect(page.getByText(memorialName)).toBeVisible();

    // 选择官方祭品（白菊），填留言，提交供奉
    await page.getByText("白菊", { exact: true }).first().click();
    await page.getByPlaceholder("想说点什么...").fill(message);
    await page.getByRole("button", { name: "供奉", exact: true }).click();

    // 成功反馈必须出现且不得误报失败（防 307-follow 误报回归）
    await expect(page.locator(".ui-status-success").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".ui-status-error").first()).toHaveCount(0);

    // 表单提交后重定向回纪念馆。审核状态取决于配置：
    // - 未配阿里云内容安全（或服务异常）→ pending，匿名暂不可见，需管理员批准
    // - 已配 → 正常文本自动 approved，立即可见
    await page.waitForURL(/\/zh\/memorial\//, { timeout: 10_000 });
    await page.waitForTimeout(1_000);
    const autoVisible = (await page.getByText(message).count()) > 0;

    if (!autoVisible) {
      // 人工审核链路：查库拿 tribute id → admin 批准 → 上墙
      const { dbPath } = await import("./helpers");
      const Database = (await import("better-sqlite3")).default;
      const db = new Database(dbPath());
      const tribute = db
        .prepare("SELECT id FROM tributes WHERE memorial_id = ? AND message = ?")
        .get(memorialId, message) as { id: string } | undefined;
      db.close();
      expect(tribute, "供奉应已入库").toBeTruthy();

      const admin = await page.context().browser()!.newContext();
      await apiLogin(admin.request, emailOf("tribadmin"));
      const review = await admin.request.post("/api/admin", {
        data: { action: "review_content", resource_type: "tribute", id: tribute!.id, decision: "approve", reason: "e2e" },
      });
      expect(review.ok()).toBeTruthy();
      await admin.close();
      await page.reload();
    }

    await expect(page.getByText(message)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/思念墙/).first()).toBeVisible();
  });

  test.afterAll(async () => {
    const { cleanupRun } = await import("./helpers");
    cleanupRun();
  });
});
