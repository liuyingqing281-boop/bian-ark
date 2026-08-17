import { expect, test } from "@playwright/test";
import { apiLogin, emailOf, PNG, RUN } from "./helpers";

// PRD 3.0 核心闭环的 UI 旅程：建馆 → 上传 → 建群共享 → 成员入群访问 → 公开
// 角色上下文跨用例复用（每邮箱只走一次验证码登录，避开 60s 频控）
test.describe.configure({ mode: "serial" });

const owner = emailOf("owner");
const member = emailOf("member");
const memorialName = `${RUN}纪念馆`;

let memorialId = "";
let inviteCode = "";
let ownerCtx: Awaited<ReturnType<import("@playwright/test").Browser["newContext"]>>;

test.beforeAll(async ({ browser }) => {
  ownerCtx = await browser.newContext();
  await apiLogin(ownerCtx.request, owner);
});

test.afterAll(async () => {
  await ownerCtx.close();
  const { cleanupRun } = await import("./helpers");
  cleanupRun();
});

test("馆主在「我的」页创建纪念馆", async () => {
  const page = await ownerCtx.newPage();
  await page.goto("/zh/me");

  await page.getByRole("button", { name: "创建纪念馆" }).click();
  await page.getByPlaceholder("姓名 *").fill(memorialName);
  await page.getByRole("button", { name: "创建", exact: true }).click();

  // me 页纪念馆卡片为纯文本列表（非 heading）
  await expect(page.getByText(memorialName).first()).toBeVisible({ timeout: 10_000 });
});

test("馆主进入纪念馆并上传照片到影像记忆", async () => {
  const page = await ownerCtx.newPage();
  await page.goto("/zh/me");

  await page.getByRole("link", { name: "查看 →" }).click();
  await page.waitForURL(/\/zh\/memorial\//, { timeout: 10_000 });
  memorialId = page.url().match(/\/zh\/memorial\/([^/?#]+)/)?.[1] || "";
  expect(memorialId).toBeTruthy();
  await expect(page.getByRole("heading", { name: memorialName })).toBeVisible();

  // MediaManager 的多文件输入（name=files，区别于页头的头像/背景输入）
  const mediaInput = page.locator('input[type="file"][name="files"]');
  await mediaInput.setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "上传照片 / 视频" }).click();
  // next/image 会把 src 改写为 _next/image?url=%2Fuploads%2Fmedia...，两种形态都匹配
  const thumb = page.locator('img[src*="/uploads/media/"], img[src*="%2Fuploads%2Fmedia"]').first();
  await expect(thumb).toBeVisible({ timeout: 15_000 });
});

test("馆主创建缅怀群组并拿到邀请码", async () => {
  const page = await ownerCtx.newPage();
  await page.goto("/zh/me");

  await page.getByPlaceholder("群组名称（如：家人）").fill(`${RUN}家人群`);
  await page.getByRole("button", { name: "创建群组" }).click();

  const linkText = await page.getByText(/join\//).first().textContent();
  inviteCode = linkText?.match(/join\/([0-9a-f]+)/)?.[1] || "";
  expect(inviteCode, "应显示邀请链接").toBeTruthy();
});

test("馆主把纪念馆共享给群组（可见性=指定群组）", async () => {
  const page = await ownerCtx.newPage();
  await page.goto("/zh/me");

  await page.getByRole("combobox").selectOption("group");
  await page.getByRole("checkbox", { name: `${RUN}家人群` }).check();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存")).toBeVisible({ timeout: 10_000 });
});

test("亲友用邀请码入群后可访问群组可见的纪念馆", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await apiLogin(ctx.request, member);
  await page.goto("/zh/me");

  await page.getByPlaceholder("邀请码").fill(inviteCode);
  await page.getByRole("button", { name: "加入", exact: true }).click();
  await expect(page.getByText(`${RUN}家人群`).first()).toBeVisible({ timeout: 10_000 });

  await page.goto(`/zh/memorial/${memorialId}`);
  await expect(page.getByRole("heading", { name: memorialName })).toBeVisible();
  await ctx.close();
});

test("馆主切换为公开后，匿名访客可访问", async ({ browser }) => {
  const page = await ownerCtx.newPage();
  await page.goto("/zh/me");
  await page.getByRole("combobox").selectOption("public");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存")).toBeVisible({ timeout: 10_000 });

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`/zh/memorial/${memorialId}`);
  await expect(anonPage.getByText(memorialName)).toBeVisible();
  await anon.close();
});
