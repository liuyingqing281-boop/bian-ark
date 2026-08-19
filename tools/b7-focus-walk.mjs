// B7 焦点走查：墓园页 Tab 至搜索框、纪念馆页 Tab 至祭品卡，各截一张焦点态
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://localhost:3003";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// 墓园页：Tab 到搜索输入框
await page.goto(`${base}/zh/garden`, { waitUntil: "networkidle" });
for (let i = 0; i < 12; i++) {
  await page.keyboard.press("Tab");
  const tag = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.tagName}.${el.getAttribute("name") || el.textContent?.trim().slice(0, 12)}` : "";
  });
  if (tag.startsWith("INPUT.q")) break;
}
await page.screenshot({ path: "docs/shots/b7-focus-garden-search.png" });

// 纪念馆页：Tab 至第一枚祭品卡（radio）
await page.goto(`${base}/zh/memorial/b5verify-0000-0000-0000-000000000001`, { waitUntil: "networkidle" });
let found = false;
for (let i = 0; i < 30; i++) {
  await page.keyboard.press("Tab");
  const isRadio = await page.evaluate(() => document.activeElement?.getAttribute("name") === "item_id");
  if (isRadio) { found = true; break; }
}
console.log("item radio focused:", found);
const card = page.locator('label:has(input[name="item_id"])').first();
await card.scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/shots/b7-focus-item-card.png" });

await browser.close();
console.log("saved b7 focus shots");
