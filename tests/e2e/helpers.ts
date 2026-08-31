import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { APIRequestContext, Page } from "@playwright/test";

/** 全局唯一前缀：本次运行创建的所有数据（邮箱/馆名/群组名）都带它，结束时按前缀清理 */
export const RUN = `e2e${Date.now().toString(36)}`;
export const emailOf = (role: string) => `${RUN}-${role}@bian.dev`;

/** dev 首编译竞态兜底：Next 16 dev 偶发页面级运行时错浮层（Next 内部 JSON.parse，
 *  与应用代码无关，Turbopack/Webpack 皆可复现）。识别到错误 dialog 则重载一次；
 *  重载后仍失败由后续断言如实暴露。 */
export async function gotoStable(page: Page, url: string): Promise<void> {
  await page.goto(url);
  const errorDialog = page.getByRole("dialog").first();
  if (await errorDialog.isVisible().catch(() => false)) {
    await page.reload();
  }
}

/** 走浏览器上下文的共享 Cookie 完成 API 登录（登录态直接进入浏览器）。
 *  2026-08-24/25 契约：verify 必带 intent；注册另需 password（8–64 位、四类≥3）+ agreed。
 *  RUN 前缀邮箱全运行唯一 → 首次走注册；同邮箱重复调用（409 already_registered，分流校验
 *  不核销验证码）回落 intent=login 复用同码。 */
export async function apiLogin(request: APIRequestContext, mail: string): Promise<void> {
  const rc = await request.post("/api/auth/request-code", { data: { channel: "email", target: mail } });
  if (!rc.ok()) throw new Error(`request-code failed: ${rc.status()}`);
  const { devCode } = (await rc.json()) as { devCode: string };
  const vr = await request.post("/api/auth/verify", {
    data: { channel: "email", target: mail, code: devCode, intent: "register", password: "Test1234!ok", agreed: true },
  });
  if (vr.ok()) return;
  if (vr.status() !== 409) throw new Error(`verify register failed: ${vr.status()}`);
  const login = await request.post("/api/auth/verify", {
    data: { channel: "email", target: mail, code: devCode, intent: "login" },
  });
  if (!login.ok()) throw new Error(`verify login failed: ${login.status()}`);
}

export async function createMemorialViaApi(
  request: APIRequestContext,
  name: string
): Promise<string> {
  const res = await request.post("/api/memorials", { data: { name, type: "person", biography: `E2E ${RUN}` } });
  const body = (await res.json()) as { id?: string };
  if (!res.ok() || !body.id) throw new Error(`create memorial failed: ${res.status()}`);
  return body.id;
}

export async function patchMemorialViaApi(
  request: APIRequestContext,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const res = await request.patch(`/api/memorials/${id}`, { data });
  if (!res.ok()) throw new Error(`patch memorial failed: ${res.status()}`);
}

export function dbPath(): string {
  return process.env.SMOKE_DB_PATH || process.env.DATABASE_PATH || path.resolve(process.cwd(), "data", "bian.db");
}

function unlinkUploads(urls: Array<string | null | undefined>): void {
  const root = path.resolve(process.cwd(), "data", "uploads");
  for (const url of urls) {
    if (!url || !url.startsWith("/uploads/")) continue;
    const file = path.resolve(process.cwd(), "data", url);
    if (file.startsWith(root) && fs.existsSync(file)) fs.unlinkSync(file);
  }
}

/** 按 RUN 前缀清理本次 E2E 的全部数据与物理文件（幂等，可重复调用） */
export function cleanupRun(): void {
  const db = new Database(dbPath());
  try {
    const users = db.prepare("SELECT id FROM users WHERE email LIKE ?").all(`${RUN}-%`) as Array<{ id: string }>;
    const uids = users.map((u) => u.id);
    const memorials = db.prepare("SELECT id FROM memorials WHERE name LIKE ? OR biography LIKE ?").all(`${RUN}%`, `E2E ${RUN}`) as Array<{ id: string }>;
    const mids = memorials.map((m) => m.id);
    if (mids.length > 0) {
      const ph = mids.map(() => "?").join(",");
      unlinkUploads(
        (
          db.prepare(`SELECT avatar_url AS a, cover_url AS c FROM memorials WHERE id IN (${ph})`).all(...mids) as Array<{ a: string; c: string }>
        ).flatMap((r) => [r.a, r.c])
      );
      unlinkUploads(
        (
          db.prepare(`SELECT url AS u, thumb_url AS t FROM media WHERE memorial_id IN (${ph})`).all(...mids) as Array<{ u: string; t: string }>
        ).flatMap((r) => [r.u, r.t])
      );
      unlinkUploads(
        (
          db.prepare(`SELECT photo_url AS p, audio_url AS a, video_url AS v, result_video_url AS r FROM digital_humans WHERE memorial_id IN (${ph})`).all(...mids) as Array<{ p: string; a: string; v: string; r: string }>
        ).flatMap((r) => [r.p, r.a, r.v, r.r])
      );
      db.prepare(`DELETE FROM tributes WHERE memorial_id IN (${ph})`).run(...mids);
      db.prepare(`DELETE FROM media WHERE memorial_id IN (${ph})`).run(...mids);
      db.prepare(`DELETE FROM life_events WHERE memorial_id IN (${ph})`).run(...mids);
      db.prepare(`DELETE FROM digital_humans WHERE memorial_id IN (${ph})`).run(...mids);
      db.prepare(`DELETE FROM dh_redo_credits WHERE memorial_id IN (${ph})`).run(...mids);
      db.prepare(`DELETE FROM memorial_groups WHERE memorial_id IN (${ph})`).run(...mids);
      db.prepare(`DELETE FROM memorial_audit_logs WHERE memorial_id IN (${ph})`).run(...mids);
      for (const mid of mids) {
        db.prepare("DELETE FROM events WHERE json_extract(meta, '$.memorial_id') = ?").run(mid);
      }
    }
    if (uids.length > 0) {
      const ph = uids.map(() => "?").join(",");
      db.prepare(`DELETE FROM sessions WHERE user_id IN (${ph})`).run(...uids);
      db.prepare(`DELETE FROM ai_generation_jobs WHERE user_id IN (${ph})`).run(...uids);
      db.prepare(`DELETE FROM events WHERE user_id IN (${ph})`).run(...uids);
      db.prepare(`DELETE FROM prompt_usage WHERE user_id IN (${ph})`).run(...uids);
      db.prepare(`DELETE FROM items WHERE owner_user_id IN (${ph})`).run(...uids);
      db.prepare(`DELETE FROM group_members WHERE user_id IN (${ph})`).run(...uids);
      db.prepare(`DELETE FROM groups WHERE owner_user_id IN (${ph})`).run(...uids);
    }
    db.prepare("DELETE FROM login_codes WHERE target LIKE ?").run(`${RUN}-%`);
    if (mids.length > 0) {
      const ph = mids.map(() => "?").join(",");
      db.prepare(`DELETE FROM memorials WHERE id IN (${ph})`).run(...mids);
    }
    if (uids.length > 0) {
      const ph = uids.map(() => "?").join(",");
      db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...uids);
    }
  } finally {
    db.close();
  }
}

/** 1x1 测试 PNG（smoke 同款） */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
