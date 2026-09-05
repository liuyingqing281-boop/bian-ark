/* 10s 星海版逐帧渲染：/showreel?v=10 → 300 帧 PNG（帧驱动，确定性输出）
 * 用法：SHOWREEL_URL=... node record-v10.cjs */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "..", "showreel", "frames-v10");
const TOTAL_OUT = 300;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  // 视口精确使舞台 scale=1（innerWidth-24=1280, innerHeight-130=720）
  const page = await browser.newPage({ viewport: { width: 1304, height: 850 } });
  await page.goto(`${process.env.SHOWREEL_URL || "http://localhost:7104/showreel"}?v=10`, { waitUntil: "networkidle" });
  // 隐藏 Next.js dev 工具角标与 Compiling 提示（不进入成片）
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
  await page.addStyleTag({ content: "nextjs-portal, #__next-build-watcher { display: none !important; }" });
  await page.keyboard.press("Space"); // 暂停自动播放
  await page.waitForTimeout(200);
  const stage = page.locator("[data-stage]");

  for (let i = 0; i < TOTAL_OUT; i++) {
    await page.evaluate((v) => {
      const slider = document.querySelector('input[type="range"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(slider, v);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    }, i);
    await page.waitForTimeout(90);
    await stage.screenshot({ path: path.join(OUT_DIR, `F${String(i).padStart(4, "0")}.png`) });
    if (i % 50 === 0) console.log("frame", i);
  }
  await browser.close();
  console.log(`done: ${TOTAL_OUT} frames`);
})();
