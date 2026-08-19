// 移动端布局审计：量化检测每页的可用性问题
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3002";
const MID = process.argv[2];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/120 Mobile",
});
const page = await ctx.newPage();

const pages = [
  ["home", "/zh"],
  ["login", "/zh/login"],
  ["me", "/zh/me"],
  ["memorial", `/zh/memorial/${MID}`],
  ["garden", "/zh/garden"],
  ["membership", "/zh/membership"],
];

for (const [name, path] of pages) {
  await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(600);

  const audit = await page.evaluate(() => {
    const vw = window.innerWidth;
    const issues = { overflowX: null, smallTaps: [], tinyText: [], offscreen: [] };

    // 1. 横向溢出
    const sw = document.documentElement.scrollWidth;
    if (sw > vw + 1) {
      let culprit = "";
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > vw + 1 && !culprit) {
          culprit = `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}(${Math.round(r.width)}px)`;
        }
      });
      issues.overflowX = { scrollWidth: sw, viewport: vw, culprit };
    }

    // 2. 触控目标 <40px（可点击元素）
    document.querySelectorAll("button, a[href], input, select, textarea, [role=button], label:has(input)").forEach((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || r.width === 0) return;
      // 跳过行内文字链接（正文链接）与隐藏 input
      if (el.matches("input[type=hidden], input[type=file], .sr-only")) return;
      if (el.tagName === "A" && el.innerText.length > 8) return;
      if ((r.height > 0 && r.height < 36 && r.width < 200) || (r.width > 0 && r.width < 32)) {
        issues.smallTaps.push(`${el.tagName.toLowerCase()}"${(el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().slice(0, 10)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });

    // 3. 字号 <12px 的可见文本
    const seen = new Set();
    document.querySelectorAll("body *").forEach((el) => {
      if (el.children.length > 0) return;
      const t = (el.innerText || "").trim();
      if (!t || t.length < 2 || seen.has(t)) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) { issues.tinyText.push(`"${t.slice(0, 12)}" ${fs}px`); seen.add(t); }
    });

    // 4. 固定/吸顶元素遮挡高度
    const sticky = document.querySelector("header, [class*=sticky]");
    if (sticky) {
      const r = sticky.getBoundingClientRect();
      issues.stickyHeight = Math.round(r.height);
    }
    return issues;
  });

  const p = (label, arr) => (arr && arr.length ? `\n   · ${label}: ${arr.slice(0, 6).join(" | ")}` : "");
  console.log(`\n[${name}] ${path}`);
  console.log(audit.overflowX
    ? ` ❌ 横向溢出: ${audit.overflowX.scrollWidth}px > 视口${audit.overflowX.viewport}px，元凶 ${audit.overflowX.culprit}`
    : " ✅ 无横向溢出");
  if (audit.smallTaps.length) console.log(` ⚠️ 触控目标过小(${audit.smallTaps.length}):${p("", audit.smallTaps)}`);
  if (audit.tinyText.length) console.log(` ⚠️ 字号<12px(${audit.tinyText.length}):${p("", audit.tinyText)}`);
  if (audit.stickyHeight) console.log(` ℹ️ 吸顶高度: ${audit.stickyHeight}px`);
}

await browser.close();
