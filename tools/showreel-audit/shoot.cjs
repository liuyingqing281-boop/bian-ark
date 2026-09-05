/* Showreel 六帧验收截图（临时工具，用完即弃） */
const { chromium } = require("@playwright/test");

const FRAMES = [88, 500, 648, 800];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1420, height: 900 } });
  await page.goto("http://localhost:7102/showreel", { waitUntil: "networkidle" });
  await page.keyboard.press("Space"); // 暂停，进入手动拖帧
  for (const fr of FRAMES) {
    await page.evaluate((v) => {
      const slider = document.querySelector('input[type="range"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(slider, v);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    }, fr);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `tools/showreel-audit/F${String(fr).padStart(3, "0")}.png` });
    console.log("shot F" + fr);
  }
  await browser.close();
})();
