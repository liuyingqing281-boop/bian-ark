import { expect, test } from "@playwright/test";
import { apiLogin, createMemorialViaApi, emailOf, patchMemorialViaApi, RUN } from "./helpers";

// 权限矩阵（PRD 3.0 §4 三级可见性 + D4 匿名规则 + admin 门禁）
// 每个角色一个持久上下文，beforeAll 只登录一次（避开 60s 验证码频控）
test.describe.configure({ mode: "serial" });

const ownerMail = emailOf("permowner");
const strangerMail = emailOf("permstranger");
const memberMail = emailOf("permmember");
const memorialName = `${RUN}权限馆`;

let memorialId = "";
let groupId = "";
let ownerCtx: Awaited<ReturnType<import("@playwright/test").Browser["newContext"]>>;
let strangerCtx: Awaited<ReturnType<import("@playwright/test").Browser["newContext"]>>;
let memberCtx: Awaited<ReturnType<import("@playwright/test").Browser["newContext"]>>;

test.beforeAll(async ({ browser }) => {
  ownerCtx = await browser.newContext();
  strangerCtx = await browser.newContext();
  memberCtx = await browser.newContext();

  await apiLogin(ownerCtx.request, ownerMail);
  await apiLogin(strangerCtx.request, strangerMail);
  await apiLogin(memberCtx.request, memberMail);

  memorialId = await createMemorialViaApi(ownerCtx.request, memorialName);
  const groupRes = await ownerCtx.request.post("/api/groups", { data: { name: `${RUN}权限群` } });
  const group = (await groupRes.json()) as { id: string; invite_code: string };
  groupId = group.id;
  await memberCtx.request.post("/api/groups/join", { data: { invite_code: group.invite_code } });
});

test.afterAll(async () => {
  await ownerCtx?.close();
  await strangerCtx?.close();
  await memberCtx?.close();
  const { cleanupRun } = await import("./helpers");
  cleanupRun();
});

test("private：匿名与陌生人不可见，馆主可见", async ({ browser }) => {
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`/zh/memorial/${memorialId}`);
  await expect(anonPage.getByText("纪念馆不存在")).toBeVisible();
  await anon.close();

  const strangerPage = await strangerCtx.newPage();
  await strangerPage.goto(`/zh/memorial/${memorialId}`);
  await expect(strangerPage.getByText("纪念馆不存在")).toBeVisible();

  const ownerPage = await ownerCtx.newPage();
  await ownerPage.goto(`/zh/memorial/${memorialId}`);
  await expect(ownerPage.getByText(memorialName)).toBeVisible();
});

test("group：授权前成员不可见，授权后成员可见", async () => {
  const page = await memberCtx.newPage();
  await page.goto(`/zh/memorial/${memorialId}`);
  await expect(page.getByText("纪念馆不存在")).toBeVisible();

  await patchMemorialViaApi(ownerCtx.request, memorialId, { visibility: "group", group_ids: [groupId] });

  await page.reload();
  await expect(page.getByRole("heading", { name: memorialName })).toBeVisible();
});

test("public：匿名可见且可匿名供奉（D4）", async ({ browser }) => {
  await patchMemorialViaApi(ownerCtx.request, memorialId, { visibility: "public" });

  const anon = await browser.newContext();
  const tribute = await anon.request.post("/api/tribute", {
    form: { memorial_id: memorialId, lang: "zh", item_id: "flower_white", message: `匿名E2E ${RUN}` },
  });
  expect(tribute.status()).toBe(200);
  expect((await tribute.json()).ok).toBe(true);

  const anonPage = await anon.newPage();
  await anonPage.goto(`/zh/memorial/${memorialId}`);
  await expect(anonPage.getByText(memorialName)).toBeVisible();
  await anon.close();
});

test("admin：匿名 403，登录用户（dev 放行）可见漏斗看板", async ({ browser }) => {
  const anon = await browser.newContext();
  const anonAdmin = await anon.request.get("/api/admin");
  expect(anonAdmin.status()).toBe(403);
  await anon.close();

  const adminRes = await ownerCtx.request.get("/api/admin");
  expect(adminRes.ok()).toBeTruthy();
  const body = (await adminRes.json()) as { funnel?: Record<string, unknown> };
  expect(body.funnel).toBeTruthy();
  expect(body.funnel).toHaveProperty("northStarActiveMemorials7d");
});
