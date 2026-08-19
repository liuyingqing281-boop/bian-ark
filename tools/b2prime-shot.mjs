// B2′ 截图工具：node tools/b2prime-shot.mjs <tag> [url]
// 对纪念馆页顶部 Hero 区（头像晕环/饰线/墓志铭）做桌面+移动截图
import { chromium, devices } from "@playwright/test";

const tag = process.argv[2] || "before";
const url = process.argv[3] || "http://localhost:3002/zh/memorial/4fc5e476-cae8-4ff7-9b3a-4a2b8693a265";

const browser = await chromium.launch();

// 桌面：Hero 区域截图
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(url, { waitUntil: "networkidle" });
await desktop.waitForTimeout(600);
await desktop.screenshot({ path: `docs/shots/b2prime-${tag}-desktop.png`, clip: { x: 0, y: 0, width: 1440, height: 760 } });
await desktop.close();

// 移动：iPhone 14 视口
const mobile = await browser.newPage({ ...devices["iPhone 14"] });
await mobile.goto(url, { waitUntil: "networkidle" });
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: `docs/shots/b2prime-${tag}-mobile.png` });
await mobile.close();

await browser.close();
console.log("saved: docs/shots/b2prime-" + tag + "-{desktop,mobile}.png");
