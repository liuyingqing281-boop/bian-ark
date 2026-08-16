import path from "path";
import fs from "fs";
import sharp from "sharp";

export const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

export function arkApiKey(): string {
  const key = process.env.ARK_API_KEY;
  if (!key) throw new Error("ark_key_missing");
  return key;
}

export function arkImageModel(): string {
  return process.env.ARK_IMAGE_MODEL || "doubao-seedream-4-5-251128";
}

export function arkVideoModel(): string {
  return process.env.ARK_VIDEO_MODEL || "doubao-seedance-2-5-260628";
}

async function arkRequest(pathname: string, init: RequestInit): Promise<unknown> {
  const resp = await fetch(`${ARK_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${arkApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    const err = body as { error?: { code?: string; message?: string } } | null;
    const detail = err?.error?.code || err?.error?.message || "";
    throw new Error(`ark_http_${resp.status}${detail ? `: ${detail}` : ""}`);
  }
  return body;
}

export async function arkPost(pathname: string, payload: unknown): Promise<unknown> {
  return arkRequest(pathname, { method: "POST", body: JSON.stringify(payload) });
}

export async function arkGet(pathname: string): Promise<unknown> {
  return arkRequest(pathname, { method: "GET" });
}

function uploadFilePath(url: string): string | null {
  if (!url || !url.startsWith("/uploads/")) return null;
  const filePath = path.join(process.cwd(), "data", url);
  const root = path.resolve(process.cwd(), "data", "uploads");
  return path.resolve(filePath).startsWith(root) ? filePath : null;
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** 读取本地上传文件为 data URI；照片先压到 1280px JPEG 控制 base64 体积。 */
export async function localFileToDataUrl(url: string, kind: "image" | "audio" | "video"): Promise<string | null> {
  const filePath = uploadFilePath(url);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  if (kind === "image") {
    const jpeg = await sharp(buffer)
      .rotate()
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  }
  const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()];
  if (!mime) return null;
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** 下载生成结果二进制（视频）到本地存储，返回相对 URL。 */
export async function downloadVideoTo(url: string, subdir: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`download_failed_${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  const dir = path.join(process.cwd(), "data", "uploads", subdir);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.mp4`;
  fs.writeFileSync(path.join(dir, name), buffer);
  return `/uploads/${subdir}/${name}`;
}
