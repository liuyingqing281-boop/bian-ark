import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appId = process.env.WECHAT_APP_ID || "";
const appSecret = process.env.WECHAT_APP_SECRET || "";
if (!appId || !appSecret) throw new Error("缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET；请使用重置后的密钥，不要使用已泄露密钥");

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok || data.errcode) throw new Error(`微信接口失败 ${data.errcode || response.status}: ${data.errmsg || response.statusText}`);
  return data;
}

async function getAccessToken() {
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.search = new URLSearchParams({ grant_type: "client_credential", appid: appId, secret: appSecret }).toString();
  return (await jsonFetch(url)).access_token;
}

async function uploadImage(token, file, type = "image") {
  const form = new FormData();
  form.append("media", new Blob([await fs.readFile(file)]), path.basename(file));
  const url = new URL("https://api.weixin.qq.com/cgi-bin/material/add_material");
  url.search = new URLSearchParams({ access_token: token, type }).toString();
  return (await jsonFetch(url, { method: "POST", body: form })).media_id;
}

async function uploadArticleImage(token, file) {
  const form = new FormData();
  form.append("media", new Blob([await fs.readFile(file)]), path.basename(file));
  const url = new URL("https://api.weixin.qq.com/cgi-bin/media/uploadimg");
  url.search = new URLSearchParams({ access_token: token }).toString();
  return (await jsonFetch(url, { method: "POST", body: form })).url;
}

function markdownToHtml(markdown, imageUrls) {
  const lines = markdown.split(/\r?\n/);
  const out = [];
  let paragraph = [];
  const flush = () => { if (paragraph.length) { out.push(`<p>${paragraph.join("<br>")}</p>`); paragraph = []; } };
  for (const line of lines) {
    if (!line.trim()) { flush(); continue; }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) { flush(); const url = imageUrls.get(image[2]); if (url) out.push(`<p><img src="${url}" alt="${image[1]}" /></p>`); continue; }
    if (line.startsWith("# ")) { flush(); out.push(`<h1>${line.slice(2)}</h1>`); continue; }
    if (line.startsWith("## ")) { flush(); out.push(`<h2>${line.slice(3)}</h2>`); continue; }
    if (line.startsWith("### ")) { flush(); out.push(`<h3>${line.slice(4)}</h3>`); continue; }
    if (line.startsWith("- ")) { flush(); out.push(`<p>• ${line.slice(2)}</p>`); continue; }
    paragraph.push(line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/^>\s?/, ""));
  }
  flush();
  return out.join("\n");
}

const markdownPath = path.join(root, "docs", "公众号文章-线上墓园介绍.md");
const markdown = await fs.readFile(markdownPath, "utf8");
const imageFiles = ["docs/web/concept/home-1440.png", "docs/web/concept/shot-1-candle.png", "docs/web/concept/shot-3-star.png"].map((p) => path.join(root, p));
const token = await getAccessToken();
const thumbMediaId = await uploadImage(token, imageFiles[0], "thumb");
const imageUrls = new Map();
for (const [index, file] of imageFiles.entries()) imageUrls.set(["web/concept/home-1440.png", "web/concept/shot-1-candle.png", "web/concept/shot-3-star.png"][index], await uploadArticleImage(token, file));
const content = markdownToHtml(markdown, imageUrls);
const draft = await jsonFetch(`https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(token)}`, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ articles: [{ title: "线上墓园，不只是“网上扫一次墓”", author: "彼岸纪念馆", digest: "从异地悼念、亲友协作与行业信任痛点出发，介绍彼岸线上墓园如何让思念有处安放。", content, content_source_url: "", thumb_media_id: thumbMediaId, need_open_comment: 1, only_fans_can_comment: 0, show_cover_pic: 1 }] }),
});
console.log(JSON.stringify({ ok: true, draftMediaId: draft.media_id }));
