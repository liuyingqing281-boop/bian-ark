import path from "path";
import fs from "fs";
import { createHash, randomUUID } from "crypto";
import sharp from "sharp";

const IMAGE_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const VIDEO_MIME: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const AUDIO_MIME: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
};
const AUDIO_MAX_BYTES = 30 * 1024 * 1024;

export type UploadKind = "image" | "video" | "audio";

export interface SavedUpload {
  url: string;
  thumbUrl: string;
  kind: UploadKind;
  objectKey: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
}

export interface StorageAdapter {
  put(objectKey: string, data: Buffer, mime: string): Promise<string>;
  delete(objectKey: string): Promise<void>;
  health(): Promise<boolean>;
}

class LocalStorageAdapter implements StorageAdapter {
  async put(objectKey: string, data: Buffer): Promise<string> {
    const filePath = path.join(process.cwd(), "data", "uploads", objectKey);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data);
    return `/uploads/${objectKey.replace(/\\/g, "/")}`;
  }
  async delete(objectKey: string): Promise<void> {
    const root = path.resolve(process.cwd(), "data", "uploads");
    const filePath = path.resolve(root, objectKey);
    if (!filePath.startsWith(root + path.sep)) throw new Error("invalid_object_key");
    try { fs.unlinkSync(filePath); } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  async health(): Promise<boolean> {
    const root = path.join(process.cwd(), "data", "uploads");
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  }
}

const localStorage = new LocalStorageAdapter();
export function getStorageAdapter(): StorageAdapter {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "local") return localStorage;
  throw new Error(`storage_provider_not_configured:${provider}`);
}

export function isImageMime(mime: string): boolean {
  return mime in IMAGE_MIME;
}

export async function saveUpload(file: File, subdir: string, allowAudio = false): Promise<SavedUpload> {
  const isImage = file.type in IMAGE_MIME;
  const isVideo = file.type in VIDEO_MIME;
  const isAudio = allowAudio && file.type in AUDIO_MIME;
  if (!isImage && !isVideo && !isAudio) throw new Error("unsupported_type");
  const maxBytes = isImage ? IMAGE_MAX_BYTES : isVideo ? VIDEO_MAX_BYTES : AUDIO_MAX_BYTES;
  if (file.size > maxBytes) throw new Error("file_too_large");

  const ext = isImage ? IMAGE_MIME[file.type] : isVideo ? VIDEO_MIME[file.type] : AUDIO_MIME[file.type];
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = randomUUID() + ext;
  const objectKey = `${subdir}/${name}`;
  const adapter = getStorageAdapter();
  const url = await adapter.put(objectKey, buffer, file.type);

  let thumbUrl = url;
  if (isImage && file.type !== "image/gif") {
    try {
      const thumbName = randomUUID() + ".webp";
      const thumbBuffer = await sharp(buffer)
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      thumbUrl = await adapter.put(`${subdir}/${thumbName}`, thumbBuffer, "image/webp");
    } catch (err) {
      console.error("[upload] thumbnail generation failed", err);
    }
  }
  return {
    url,
    thumbUrl,
    kind: isImage ? "image" : isVideo ? "video" : "audio",
    objectKey,
    mime: file.type,
    sizeBytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export function deleteUpload(url: string): void {
  if (!url || !url.startsWith("/uploads/")) return;
  const filePath = path.join(process.cwd(), "data", url);
  if (!path.resolve(filePath).startsWith(path.resolve(process.cwd(), "data", "uploads"))) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    // already gone
  }
}
