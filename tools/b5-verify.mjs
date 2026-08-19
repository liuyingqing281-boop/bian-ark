// B5 验证：火焰页截图 + FPS 抽查 + 供奉成功仪式动效捕获
import { chromium, devices } from "@playwright/test";

const base = "http://localhost:3003";
const mid = "b5verify-0000-0000-0000-000000000001";
const browser = await chromium.launch();

// 1) 桌面 memorial 页：火焰渲染 + FPS 抽查
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${base}/zh/memorial/${mid}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: "docs/shots/b5-flame-desktop.png", fullPage: true });

const fps = await page.evaluate(() => new Promise((resolve) => {
  let frames = 0;
  const start = performance.now();
  function tick() {
    frames++;
    if (performance.now() - start < 2000) requestAnimationFrame(tick);
    else resolve(Math.round(frames / 2));
  }
  requestAnimationFrame(tick);
}));
console.log("desktop FPS (2s avg):", fps);

// 2) 供奉成功仪式动效：拦截 /api/tribute 直接返回 200（绕过既有 bug：
//    fetch 跟随 307 保留 POST → 页面路由 404 → 误报错误，已上报，逻辑层不修）
await page.route("**/api/tribute", (route) => {
  console.log("[intercept] tribute", route.request().method());
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});
const item = page.locator('label:has(input[name="item_id"])').first();
await item.scrollIntoViewIfNeeded();
await item.click();
await page.fill('input[name="sender_name"]', "验证者");
await page.fill('input[name="message"]', "B5 动效验证");
await page.click('button[type="submit"]');
const ok = page.locator(".ui-status-success").first();
try {
  await ok.waitFor({ state: "visible", timeout: 15000 });
} catch {
  console.log("[debug] success not visible; error text:", await page.locator(".ui-status-error").first().textContent().catch(() => "(none)"));
  throw new Error("success state never appeared");
}
const live = page.locator('div[aria-live="polite"]').first();
await live.scrollIntoViewIfNeeded();
await page.waitForTimeout(300); // sway 0.9s / petal 1.2s 进行中
await live.screenshot({ path: "docs/shots/b5-ritual-mid.png" });
await page.waitForTimeout(1500); // 动效结束后
await live.screenshot({ path: "docs/shots/b5-ritual-end.png" });
await page.close();

// 3) 移动端 FPS 抽查
const mobile = await browser.newPage({ ...devices["iPhone 14"] });
await mobile.goto(`${base}/zh/memorial/${mid}`, { waitUntil: "networkidle" });
await mobile.waitForTimeout(1200);
const mfps = await mobile.evaluate(() => new Promise((resolve) => {
  let frames = 0;
  const start = performance.now();
  function tick() {
    frames++;
    if (performance.now() - start < 2000) requestAnimationFrame(tick);
    else resolve(Math.round(frames / 2));
  }
  requestAnimationFrame(tick);
}));
console.log("mobile-emulated FPS (2s avg):", mfps);
await mobile.close();

await browser.close();
console.log("saved: docs/shots/b5-flame-desktop.png, b5-ritual-mid.png, b5-ritual-end.png");
