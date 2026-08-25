// 移动端审计截图：Pixel 7 尺寸（412x915）抓取关键页面
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:7300";
const OUT = "docs/shots/mobile-audit";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
});
const page = await ctx.newPage();

// 登录测试号（登录/注册分离后：先试注册，固定邮箱已存在则回落登录）
const mail = `ui-audit@bian.dev`;
const rc = await ctx.request.post(`${BASE}/api/auth/request-code`, { data: { channel: "email", target: mail } });
const { devCode } = await rc.json();
let va = await ctx.request.post(`${BASE}/api/auth/verify`, { data: { channel: "email", target: mail, code: devCode, intent: "register", password: "Test1234!ok", agreed: true } });
if (va.status() === 409) va = await ctx.request.post(`${BASE}/api/auth/verify`, { data: { channel: "email", target: mail, code: devCode, intent: "login" } });

// 建演示馆（公开、带生平）
const cm = await ctx.request.post(`${BASE}/api/memorials`, {
  data: { name: "王秀兰", type: "person", birth_date: "1948-03-12", death_date: "2023-11-08", epitaph: "慈母手中线，游子身上衣", biography: "一生勤俭持家，温柔待人。退休后热衷园艺，阳台上的兰花陪伴了她最后的岁月。" },
});
const { id: mid } = await cm.json();
await ctx.request.patch(`${BASE}/api/memorials/${mid}`, { data: { visibility: "public" } });
// 匿名献两次祭品 + 留言（墙上有内容）
const anon = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const anonReq = anon.request;
await anonReq.post(`${BASE}/api/tribute`, { form: { memorial_id: mid, lang: "zh", item_id: "flower_white", sender_name: "女儿", message: "妈妈，今天路过花店看到白菊，想起您。" } });
await anonReq.post(`${BASE}/api/tribute`, { form: { memorial_id: mid, lang: "zh", item_id: "candle", sender_name: "儿子", message: "爸，天冷了，给您点盏灯。" } });
await anon.close();

const shots = [
  ["home", `${BASE}/zh`],
  ["login", `${BASE}/zh/login`],
  ["me", `${BASE}/zh/me`],
  ["memorial", `${BASE}/zh/memorial/${mid}`],
  ["garden", `${BASE}/zh/garden`],
  ["membership", `${BASE}/zh/membership`],
];
for (const [name, url] of shots) {
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("shot", name);
}

console.log("MEMORIAL_ID=" + mid);
await browser.close();
