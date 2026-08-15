import path from "path";
import fs from "fs";
import { randomUUID, createHash } from "crypto";
import sharp from "sharp";

const UPLOAD_SUBDIR = "items";
const STYLE_SUFFIX = "，写实摄影风格，柔光，深色背景，居中构图，祭品静物";

function uploadDir(): string {
  const dir = path.join(process.cwd(), "data", "uploads", UPLOAD_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function hueFrom(text: string, salt: number): number {
  const hash = createHash("md5").update(text + salt).digest();
  return hash[0] % 360;
}

async function generateMock(prompt: string, count: number): Promise<string[]> {
  const urls: string[] = [];
  for (let index = 0; index < count; index++) {
    const hue = hueFrom(prompt, index);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs>
        <radialGradient id="g" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stop-color="hsl(${hue}, 38%, 46%)"/>
          <stop offset="60%" stop-color="hsl(${hue}, 32%, 22%)"/>
          <stop offset="100%" stop-color="hsl(${hue}, 28%, 10%)"/>
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#g)"/>
      <circle cx="256" cy="220" r="86" fill="hsl(${hue}, 45%, 68%)" opacity="0.55"/>
      <ellipse cx="256" cy="330" rx="120" ry="26" fill="black" opacity="0.35"/>
      <text x="256" y="470" text-anchor="middle" font-family="sans-serif" font-size="20" fill="white" opacity="0.6">MOCK ${index + 1}</text>
    </svg>`;
    const name = randomUUID() + ".webp";
    await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(path.join(uploadDir(), name));
    urls.push(`/uploads/${UPLOAD_SUBDIR}/${name}`);
  }
  return urls;
}

async function downloadTo(url: string, name: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download_failed_${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  await sharp(buffer).webp({ quality: 85 }).toFile(path.join(uploadDir(), name));
  return `/uploads/${UPLOAD_SUBDIR}/${name}`;
}

async function generateDashscopeSync(
  prompt: string,
  count: number,
  apiKey: string,
  model: string
): Promise<string[]> {
  const urls: string[] = [];
  for (let index = 0; index < count; index++) {
    const resp = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: {
            messages: [{ role: "user", content: [{ text: prompt + STYLE_SUFFIX }] }],
          },
          parameters: { prompt_extend: true, watermark: false, n: 1, size: "1280*1280" },
        }),
      }
    );
    const body = await resp.json();
    if (!resp.ok) throw new Error(body?.code || body?.message || "dashscope_sync_failed");
    const parts = body?.output?.choices?.[0]?.message?.content;
    const url = Array.isArray(parts)
      ? parts.find((part: { image?: string }) => part?.image)?.image
      : body?.output?.results?.[0]?.url;
    if (!url) throw new Error("dashscope_empty_result");
    urls.push(await downloadTo(url, randomUUID() + ".webp"));
  }
  return urls;
}

async function generateDashscope(prompt: string, count: number): Promise<string[]> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("dashscope_key_missing");
  const model = process.env.DASHSCOPE_MODEL || "wan2.6-t2i";
  if (model.startsWith("wan2.6")) return generateDashscopeSync(prompt, count, apiKey, model);
  const create = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model,
        input: { prompt: prompt + STYLE_SUFFIX },
        parameters: { size: "1024*1024", n: count },
      }),
    }
  );
  const created = await create.json();
  const taskId = created?.output?.task_id;
  if (!create.ok || !taskId) throw new Error(created?.message || "dashscope_create_failed");

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const poll = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const status = await poll.json();
    const taskStatus = status?.output?.task_status;
    if (taskStatus === "SUCCEEDED") {
      const results = (status.output.results || []) as { url: string }[];
      const urls: string[] = [];
      for (const result of results) {
        urls.push(await downloadTo(result.url, randomUUID() + ".webp"));
      }
      return urls;
    }
    if (taskStatus === "FAILED" || taskStatus === "CANCELED") {
      throw new Error(status?.output?.message || "dashscope_task_failed");
    }
  }
  throw new Error("dashscope_timeout");
}

export function activeProvider(): string {
  if (process.env.IMAGEGEN_PROVIDER) return process.env.IMAGEGEN_PROVIDER;
  return process.env.DASHSCOPE_API_KEY ? "dashscope" : "mock";
}

export async function generateOfferingImages(prompt: string, count = 4): Promise<string[]> {
  const provider = activeProvider();
  if (provider === "dashscope") return generateDashscope(prompt, count);
  return generateMock(prompt, count);
}