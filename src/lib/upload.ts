import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
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
  const dir = path.join(process.cwd(), "data", "uploads", subdir);
  fs.mkdirSync(dir, { recursive: true });

  const name = randomUUID() + ext;
  fs.writeFileSync(path.join(dir, name), buffer);
  const url = `/uploads/${subdir}/${name}`;

  let thumbUrl = url;
  if (isImage && file.type !== "image/gif") {
    try {
      const thumbName = randomUUID() + ".webp";
      await sharp(buffer)
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(dir, thumbName));
      thumbUrl = `/uploads/${subdir}/${thumbName}`;
    } catch (err) {
      console.error("[upload] thumbnail generation failed", err);
    }
  }
  return { url, thumbUrl, kind: isImage ? "image" : isVideo ? "video" : "audio" };
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