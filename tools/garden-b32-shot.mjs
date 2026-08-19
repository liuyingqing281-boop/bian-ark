// B3-2 截图：墓园 2.5D 常态 + 首卡片 hover 态
import { chromium, devices } from "@playwright/test";

const url = "http://localhost:3002/zh/garden";
const browser = await chromium.launch();

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "docs/shots/garden-b3-2-after-desktop.png" });
// hover 第一块墓碑
const card = page.locator('a[href*="/memorial/"]').first();
await card.scrollIntoViewIfNeeded();
await card.hover();
await page.waitForTimeout(500);
await page.screenshot({ path: "docs/shots/garden-b3-2-hover-desktop.png" });
await page.close();

const mobile = await browser.newPage({ ...devices["iPhone 14"] });
await mobile.goto(url, { waitUntil: "networkidle" });
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: "docs/shots/garden-b3-2-after-mobile.png" });
await mobile.close();

await browser.close();
console.log("saved garden-b3-2 shots");
