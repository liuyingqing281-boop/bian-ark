// B3 截图工具：node tools/garden-shot.mjs <tag>
// 公共墓园页 2.5D 场景：桌面整页 + 移动端整页
import { chromium, devices } from "@playwright/test";

const tag = process.argv[2] || "baseline";
const url = process.argv[3] || "http://localhost:3002/zh/garden";

const browser = await chromium.launch();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(url, { waitUntil: "networkidle" });
await desktop.waitForTimeout(800);
await desktop.screenshot({ path: `docs/shots/garden-${tag}-desktop.png`, fullPage: false });
await desktop.close();

const mobile = await browser.newPage({ ...devices["iPhone 14"] });
await mobile.goto(url, { waitUntil: "networkidle" });
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: `docs/shots/garden-${tag}-mobile.png` });
await mobile.close();

await browser.close();
console.log("saved: docs/shots/garden-" + tag + "-{desktop,mobile}.png");
