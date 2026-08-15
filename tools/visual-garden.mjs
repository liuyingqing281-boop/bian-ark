// Visual check: 2D garden + 3D toggle screenshots via playwright-core (Edge channel)
import { createRequire } from "module";
const require2 = createRequire("C:/Users/liuli/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/package.json");
const { chromium } = require2("playwright-core");
import fs from "fs";

fs.mkdirSync("E:/彼岸/docs/shots", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto("http://localhost:3002/zh/garden", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: "E:/彼岸/docs/shots/garden-2d.png" });
console.log("2D saved");

const btn = page.getByRole("button", { name: "3D 视角" });
const count = await btn.count();
console.log("3D button count:", count);
if (count > 0) {
  await btn.first().click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "E:/彼岸/docs/shots/garden-3d.png" });
  console.log("3D saved");
}

await browser.close();