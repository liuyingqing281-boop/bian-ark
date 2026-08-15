import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getDb } from "./db";
import { trackEvent } from "./events";

const UPLOAD_SUBDIR = "digitalhuman";
const MOCK_DELAY_MS = 4000;

function uploadDir(): string {
  const dir = path.join(process.cwd(), "data", "uploads", UPLOAD_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function activeProvider(): string {
  if (process.env.DIGITALHUMAN_PROVIDER) return process.env.DIGITALHUMAN_PROVIDER;
  return "mock";
}

function dataPathFromUrl(url: string): string | null {
  if (!url || !url.startsWith("/uploads/")) return null;
  const filePath = path.join(process.cwd(), "data", url);
  const root = path.resolve(process.cwd(), "data", "uploads");
  return path.resolve(filePath).startsWith(root) ? filePath : null;
}

async function buildMockAsset(taskId: string): Promise<string> {
  const db = getDb();
  const task = db.prepare("SELECT photo_url FROM digital_humans WHERE id = ?").get(taskId) as
    | { photo_url: string }
    | undefined;
  const photoPath = task ? dataPathFromUrl(task.photo_url) : null;
  if (!photoPath || !fs.existsSync(photoPath)) throw new Error("photo_missing");
  const watermark = `<svg width="640" height="640">
    <rect x="380" y="586" width="248" height="40" rx="6" fill="black" fill-opacity="0.55"/>
    <text x="618" y="614" text-anchor="end" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" fill="white" fill-opacity="0.95">AI 生成</text>
  </svg>`;
  const name = randomUUID() + ".webp";
  await sharp(photoPath)
    .resize(640, 640, { fit: "cover" })
    .composite([{ input: Buffer.from(watermark), top: 0, left: 0 }])
    .webp({ quality: 85 })
    .toFile(path.join(uploadDir(), name));
  return `/uploads/${UPLOAD_SUBDIR}/${name}`;
}

export function startDigitalHumanJob(taskId: string): void {
  const provider = activeProvider();
  const db = getDb();
  db.prepare(
    "UPDATE digital_humans SET provider = ?, provider_job_id = ?, status = 'processing', updated_at = datetime('now') WHERE id = ?"
  ).run(provider, `${provider}-${taskId}`, taskId);

  if (provider !== "mock") {
    // Real vendor integration point: submit materials to the vendor API here,
    // then wait for /api/digitalhumans/callback to flip status to reviewing/failed.
    return;
  }

  const timer = setTimeout(async () => {
    try {
      const url = await buildMockAsset(taskId);
      getDb()
        .prepare("UPDATE digital_humans SET status = 'reviewing', result_video_url = ?, updated_at = datetime('now') WHERE id = ?")
        .run(url, taskId);
      trackEvent("dh_job", { status: "reviewing", provider: "mock" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "mock_failed";
      const db = getDb();
      db.prepare("UPDATE digital_humans SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?")
        .run(message, taskId);
      // restore a consumed redo credit so a failed job never burns money (PRD F3.6)
      const task = db.prepare("SELECT memorial_id, user_id FROM digital_humans WHERE id = ?").get(taskId) as
        | { memorial_id: string; user_id: string }
        | undefined;
      if (task) {
        db.prepare(
          `UPDATE dh_redo_credits SET used = 0 WHERE id = (
             SELECT id FROM dh_redo_credits WHERE memorial_id = ? AND user_id = ? AND used = 1
             ORDER BY created_at DESC LIMIT 1)`
        ).run(task.memorial_id, task.user_id);
      }
      trackEvent("dh_job", { status: "failed", error: message });
    }
  }, MOCK_DELAY_MS);
  if (typeof timer.unref === "function") timer.unref();
}