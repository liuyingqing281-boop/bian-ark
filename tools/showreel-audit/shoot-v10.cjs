/* 10s 星海版关键帧验收截图 */
const { chromium } = require("@playwright/test");
const fs = require("fs");

const FRAMES = [30, 46, 70, 100, 130, 150, 186, 212, 236, 252, 282, 295];

(async () => {
  fs.mkdirSync("tools/showreel-audit/v10", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1304, height: 850 } });
  await page.goto("http://localhost:7104/showreel?v=10", { waitUntil: "networkidle" });
  await page.addInitScript(() => {
    const hide = () => {
      if (!document.body) return;
      for (const el of document.body.children) {
        if (el.id !== "__next" && el.shadowRoot) el.style.display = "none";
      }
    };
    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
    hide();
  });
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  const stage = page.locator("[data-stage]");
  for (const fr of FRAMES) {
    await page.evaluate((v) => {
      const slider = document.querySelector('input[type="range"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(slider, v);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    }, fr);
    await page.waitForTimeout(250);
    await stage.screenshot({ path: `tools/showreel-audit/v10/F${String(fr).padStart(3, "0")}.png` });
    console.log("shot F" + fr);
  }
  await browser.close();
})();
