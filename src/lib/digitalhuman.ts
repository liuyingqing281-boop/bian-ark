import path from "path";
import fs from "fs";
import sharp from "sharp";
import { getDb } from "./db";
import { trackEvent } from "./events";
import { arkVideoModel, arkPost, arkGet, localFileToDataUrl, downloadVideoTo } from "./ark";

const UPLOAD_SUBDIR = "digitalhuman";
const MOCK_DELAY_MS = 4000;
const ARK_POLL_INTERVAL_MS = 10_000;
const ARK_POLL_DEADLINE_MS = 15 * 60_000;

function uploadDir(): string {
  const dir = path.join(process.cwd(), "data", "uploads", UPLOAD_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function activeProvider(): string {
  if (process.env.DIGITALHUMAN_PROVIDER) return process.env.DIGITALHUMAN_PROVIDER;
  if (process.env.ARK_API_KEY) return "ark";
  return "mock";
}

function dataPathFromUrl(url: string): string | null {
  if (!url || !url.startsWith("/uploads/")) return null;
  const filePath = path.join(process.cwd(), "data", url);
  const root = path.resolve(process.cwd(), "data", "uploads");
  return path.resolve(filePath).startsWith(root) ? filePath : null;
}

/** 退还该任务最近一次消费的重做额度（PRD F3.6：失败不烧钱）。 */
export function refundRedoCredit(taskId: string): void {
  const db = getDb();
  const task = db.prepare("SELECT memorial_id, user_id FROM digital_humans WHERE id = ?").get(taskId) as
    | { memorial_id: string; user_id: string }
    | undefined;
  if (!task) return;
  db.prepare(
    `UPDATE dh_redo_credits SET used = 0 WHERE id = (
       SELECT id FROM dh_redo_credits WHERE memorial_id = ? AND user_id = ? AND used = 1
       ORDER BY created_at DESC LIMIT 1)`
  ).run(task.memorial_id, task.user_id);
}

function markFailed(taskId: string, message: string, provider: string): void {
  const db = getDb();
  db.prepare("UPDATE digital_humans SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?").run(
    message,
    taskId
  );
  refundRedoCredit(taskId);
  trackEvent("dh_job", { status: "failed", error: message, provider });
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
  const name = crypto.randomUUID() + ".webp";
  await sharp(photoPath)
    .resize(640, 640, { fit: "cover" })
    .composite([{ input: Buffer.from(watermark), top: 0, left: 0 }])
    .webp({ quality: 85 })
    .toFile(path.join(uploadDir(), name));
  return `/uploads/${UPLOAD_SUBDIR}/${name}`;
}

function runMockJob(taskId: string): void {
  const timer = setTimeout(async () => {
    try {
      const url = await buildMockAsset(taskId);
      getDb()
        .prepare("UPDATE digital_humans SET status = 'reviewing', result_video_url = ?, updated_at = datetime('now') WHERE id = ?")
        .run(url, taskId);
      trackEvent("dh_job", { status: "reviewing", provider: "mock" });
    } catch (err) {
      markFailed(taskId, err instanceof Error ? err.message : "mock_failed", "mock");
    }
  }, MOCK_DELAY_MS);
  if (typeof timer.unref === "function") timer.unref();
}

function buildArkPrompt(script: string, hasAudio: boolean): string {
  const lines = [
    `请以图片1中的人物为主体，生成一段人物开口说话的视频：人物面对镜头，用温和的语气说以下内容：「${script}」；口型与语音同步，表情自然，姿态沉稳，背景简洁柔和，固定半身构图。`,
  ];
  if (hasAudio) lines.push("音色与音频1保持一致。");
  return lines.join("");
}

// Seedance 系列按 5/10 秒档位最稳；短文稿 5 秒，其余 10 秒
function estimateDuration(script: string): number {
  const override = Number(process.env.DH_VIDEO_DURATION);
  if (override >= 3 && override <= 12) return override;
  return script.length <= 24 ? 5 : 10;
}

function extractVideoUrl(task: unknown): string | null {
  const t = task as { content?: { video_url?: string }; video_url?: string; data?: Array<{ url?: string }> } | null;
  return t?.content?.video_url || t?.video_url || t?.data?.[0]?.url || null;
}

async function createArkTask(task: {
  script: string;
  ratio: string;
  photoUrl: string;
  audioUrl: string;
}): Promise<{ jobId: string; usedAudio: boolean }> {
  const photoDataUrl = await localFileToDataUrl(task.photoUrl, "image");
  if (!photoDataUrl) throw new Error("photo_missing");
  const audioDataUrl = task.audioUrl ? await localFileToDataUrl(task.audioUrl, "audio") : null;

  const buildPayload = (withAudio: boolean) => {
    const content: Array<Record<string, unknown>> = [
      { type: "text", text: buildArkPrompt(task.script, withAudio) },
      { type: "image_url", image_url: { url: photoDataUrl }, role: "reference_image" },
    ];
    if (withAudio && audioDataUrl) {
      content.push({ type: "audio_url", audio_url: { url: audioDataUrl }, role: "reference_audio" });
    }
    return {
      model: arkVideoModel(),
      content,
      generate_audio: true,
      ratio: task.ratio || process.env.DH_VIDEO_RATIO || "9:16",
      duration: estimateDuration(task.script),
      watermark: true, // PRD F3.5：AI 生成视频强制带水印
    };
  };

  try {
    const created = (await arkPost("/contents/generations/tasks", buildPayload(!!audioDataUrl))) as { id?: string };
    if (!created?.id) throw new Error("ark_create_failed");
    return { jobId: created.id, usedAudio: !!audioDataUrl };
  } catch (err) {
    // 参考音频的 data URI 被拒时，降级为无音频重试一次（改用模型默认音色）
    if (!audioDataUrl) throw err;
    const created = (await arkPost("/contents/generations/tasks", buildPayload(false))) as { id?: string };
    if (!created?.id) throw new Error("ark_create_failed");
    return { jobId: created.id, usedAudio: false };
  }
}

function pollArkTask(taskId: string, jobId: string, deadline: number): void {
  const timer = setTimeout(async () => {
    try {
      const task = (await arkGet(`/contents/generations/tasks/${jobId}`)) as {
        status?: string;
        error?: { message?: string };
      };
      const status = task?.status;
      if (status === "succeeded") {
        const url = extractVideoUrl(task);
        if (!url) throw new Error("ark_empty_video");
        // Ark 返回的 TOS 链接是临时的，必须立即转存本地
        const localUrl = await downloadVideoTo(url, UPLOAD_SUBDIR);
        getDb()
          .prepare("UPDATE digital_humans SET status = 'reviewing', result_video_url = ?, updated_at = datetime('now') WHERE id = ?")
          .run(localUrl, taskId);
        trackEvent("dh_job", { status: "reviewing", provider: "ark" });
        return;
      }
      if (status === "failed" || status === "cancelled") {
        throw new Error(task?.error?.message || "ark_task_failed");
      }
      if (Date.now() > deadline) throw new Error("ark_timeout");
      pollArkTask(taskId, jobId, deadline);
    } catch (err) {
      markFailed(taskId, err instanceof Error ? err.message : "ark_failed", "ark");
    }
  }, ARK_POLL_INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
}

async function runArkJob(taskId: string): Promise<void> {
  const db = getDb();
  const task = db
    .prepare("SELECT photo_url, audio_url, script, ratio FROM digital_humans WHERE id = ?")
    .get(taskId) as { photo_url: string; audio_url: string; script: string; ratio: string } | undefined;
  if (!task) return;

  const { jobId } = await createArkTask({
    script: task.script,
    ratio: task.ratio,
    photoUrl: task.photo_url,
    audioUrl: task.audio_url,
  });
  // 回写供应商真实任务号，覆盖 startDigitalHumanJob 写入的占位符
  db.prepare("UPDATE digital_humans SET provider_job_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    jobId,
    taskId
  );
  pollArkTask(taskId, jobId, Date.now() + ARK_POLL_DEADLINE_MS);
}

export function startDigitalHumanJob(taskId: string): void {
  const provider = activeProvider();
  const db = getDb();
  db.prepare(
    "UPDATE digital_humans SET provider = ?, provider_job_id = ?, status = 'processing', updated_at = datetime('now') WHERE id = ?"
  ).run(provider, `${provider}-${taskId}`, taskId);

  if (provider === "ark") {
    // 全程自吞错误：失败置 failed + 退额度，不向调用方抛出
    runArkJob(taskId).catch((err) => {
      markFailed(taskId, err instanceof Error ? err.message : "ark_failed", "ark");
    });
    return;
  }

  runMockJob(taskId);
}
