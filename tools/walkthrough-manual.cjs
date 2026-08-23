// M4 走查清单遗留 5 个手动项自动化复核（对原型 legacy/pc.html，1440 档）
// G06 焦点环 / G07 Esc / G08 hover / A12 吸顶 / A16 烛火动效
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:7106/legacy/pc.html";
const OUT = "E:/彼岸/docs/web/walkthrough";

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const results = {};

  // 预置：身份说明已读，便于直接操作
  await page.addInitScript(() => {
    try {
      localStorage.setItem("pc.chat.intro", "1");
    } catch {}
  });
  await page.goto(BASE, { waitUntil: "networkidle" });

  // ---------- G06 键盘 Tab 焦点环 ----------
  const focusTrail = await page.evaluate(() => {
    const seq = [];
    const seen = new Set();
    return new Promise((resolve) => {
      let steps = 0;
      function step() {
        const el = document.activeElement;
        if (el && el !== document.body) {
          const cs = getComputedStyle(el);
          const desc =
            (el.tagName || "") + " " + (el.textContent || "").trim().slice(0, 12);
          const outlineVisible =
            (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1) ||
            parseFloat(cs.boxShadow.split(" ").length) > 3 ||
            cs.boxShadow !== "none";
          seq.push({
            el: desc,
            outline: `${cs.outlineWidth} ${cs.outlineStyle}`,
            boxShadow: cs.boxShadow !== "none" ? cs.boxShadow.slice(0, 60) : "none",
            visible: outlineVisible,
          });
          seen.add(el);
        }
        if (++steps >= 14) return resolve(seq);
        // 模拟 Tab
        const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
        el && el.dispatchEvent(ev);
        // 手动移动焦点（evaluate 里无法触发默认 Tab 行为）
        const focusables = Array.from(
          document.querySelectorAll(
            'a[href], button, input, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((n) => n.offsetParent !== null);
        const idx = focusables.indexOf(el);
        const next = focusables[(idx + 1) % focusables.length];
        next && next.focus();
        setTimeout(step, 30);
      }
      step();
    });
  });
  const focusVisibleCount = focusTrail.filter((f) => f.visible).length;
  results.G06 = {
    pass: focusVisibleCount >= focusTrail.length - 1 && focusTrail.length >= 5,
    detail: `${focusVisibleCount}/${focusTrail.length} 个焦点位有可见焦点指示`,
    trail: focusTrail.map((f) => `${f.visible ? "✓" : "✗"} ${f.el} [${f.outline}]`),
  };
  await page.screenshot({ path: OUT + "/manual-G06-focus.png" });

  // ---------- G07 Esc 行为 ----------
  // 打开对话侧板 → Esc 应收起
  await page.evaluate(() => {
    const btn = document.querySelector(".chat-strip, [data-open-chat], #chatStrip");
    btn && btn.click();
  });
  await page.waitForTimeout(400);
  const panelOpenBefore = await page.evaluate(() => {
    const p = document.querySelector(".chat-panel");
    if (!p) return null;
    return !p.classList.contains("collapsed");
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const panelAfterEsc = await page.evaluate(() => {
    const p = document.querySelector(".chat-panel");
    if (!p) return null;
    return p.classList.contains("collapsed");
  });
  // 身份说明弹层 Esc 不可关闭：强制打开后按 Esc
  await page.evaluate(() => localStorage.removeItem("pc.chat.intro"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const introShown = await page.evaluate(() => {
    const m = document.querySelector(".intro-mask");
    return !!m && m.offsetParent !== null;
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const introStillThere = await page.evaluate(() => {
    const m = document.querySelector(".intro-mask");
    return !!m && m.offsetParent !== null;
  });
  results.G07 = {
    pass: panelOpenBefore === true && panelAfterEsc === true && introShown && introStillThere,
    detail: `侧板 Esc 收起=${panelAfterEsc}；弹层 Esc 后仍在=${introStillThere}`,
  };
  await page.screenshot({ path: OUT + "/manual-G07-esc.png" });
  // 恢复已读状态
  await page.evaluate(() => localStorage.setItem("pc.chat.intro", "1"));

  // ---------- G08 hover 态 ----------
  const hoverCheck = await page.evaluate(() => {
    // 统计样式表中 :hover 规则覆盖的可点选择器
    const sheets = Array.from(document.styleSheets);
    let hoverRules = 0;
    for (const s of sheets) {
      try {
        for (const r of Array.from(s.cssRules)) {
          if (r.selectorText && r.selectorText.includes(":hover")) hoverRules++;
        }
      } catch {}
    }
    const clickables = Array.from(
      document.querySelectorAll("a[href], button, .chat-strip")
    ).filter((n) => n.offsetParent !== null).length;
    return { hoverRules, clickables };
  });
  // 实际 hover 导航链接，对比背景变化
  const navLink = page.locator(".side-link").first();
  const beforeBg = await navLink.evaluate((el) => getComputedStyle(el).backgroundColor);
  await navLink.hover();
  await page.waitForTimeout(300);
  const afterBg = await navLink.evaluate((el) => getComputedStyle(el).backgroundColor);
  const hoverChanged = beforeBg !== afterBg;
  results.G08 = {
    pass: hoverCheck.hoverRules >= 5 && hoverChanged,
    detail: `样式表 :hover 规则 ${hoverCheck.hoverRules} 条；导航 hover 背景 ${beforeBg} → ${afterBg}`,
  };
  await page.screenshot({ path: OUT + "/manual-G08-hover.png" });

  // ---------- A12 滚动吸顶 ----------
  const tabs = page.locator(".anchor-tabs, .pc-anchor-tabs").first();
  const tabsCount = await tabs.count();
  let a12 = { pass: false, detail: "未找到锚点 Tab 栏" };
  if (tabsCount) {
    const posBefore = await tabs.evaluate((el) => getComputedStyle(el).position);
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(400);
    const stickyInfo = await tabs.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        position: cs.position,
        top: r.top,
        bg: cs.backgroundColor,
        backdrop: cs.backdropFilter,
        borderBottom: cs.borderBottom,
      };
    });
    a12 = {
      pass:
        (posBefore === "sticky" || stickyInfo.position === "sticky" || stickyInfo.position === "fixed") &&
        stickyInfo.top <= 2 &&
        (stickyInfo.backdrop.includes("blur") || stickyInfo.bg !== "rgba(0, 0, 0, 0)"),
      detail: `position=${stickyInfo.position}, 滚动后 top=${stickyInfo.top}, 背景=${stickyInfo.bg}, blur=${stickyInfo.backdrop}`,
    };
  }
  results.A12 = a12;
  await page.screenshot({ path: OUT + "/manual-A12-sticky.png" });

  // ---------- A16 烛火动效 ----------
  const flameInfo = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll(".flame, .candle, [class*='flame'], [class*='candle']")
    );
    const animated = [];
    for (const el of candidates) {
      const cs = getComputedStyle(el);
      if (cs.animationName && cs.animationName !== "none") {
        animated.push({
          cls: el.className,
          name: cs.animationName,
          duration: cs.animationDuration,
        });
      }
    }
    // 也扫全局动画
    return animated;
  });
  const durations = flameInfo.map((f) => parseFloat(f.duration));
  results.A16 = {
    pass: flameInfo.length > 0 && durations.every((d) => d <= 1.2),
    detail: flameInfo.length
      ? flameInfo.map((f) => `${f.cls}: ${f.name} ${f.duration}`).join(" | ")
      : "未找到烛火动画元素",
  };

  await browser.close();

  // 汇总
  let md = "\n";
  for (const [k, v] of Object.entries(results)) {
    md += `- ${v.pass ? "✅" : "❌"} **${k}**：${v.detail}\n`;
    if (v.trail) md += "  - " + v.trail.join("\n  - ") + "\n";
  }
  console.log(md);
  const allPass = Object.values(results).every((v) => v.pass);
  console.log("ALL_PASS=" + allPass);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
