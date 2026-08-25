import nodemailer from "nodemailer";
import { v4 as uuid } from "uuid";
import { getDb } from "./db";

export type CodeChannel = "email" | "sms";

export interface SendResult {
  delivered: boolean;
  devCode?: string;
}

// 测试专用域：自动化测试的账号全部使用 @bian.dev（不可路由的测试域），
// 对这些地址跳过真实 SMTP 发送，避免连发触发服务商限流拖慢/拖死测试。
// 生产环境（NODE_ENV=production）下跳过的结果是无验证码可用，不存在绕过风险。
function isTestTarget(target: string): boolean {
  return /@(.*\.)?bian\.dev$/i.test(target);
}

// 测试专用手机号段：1XX-0000-XXXX（中间四位 0000）。自动化测试统一用该段生成号码，
// 跳过真实短信发送（devCode 仍回显），避免向陌生真实号码发码产生费用与骚扰。
function isTestSmsTarget(target: string): boolean {
  return /^1\d{2}0000\d{4}$/.test(target);
}

// 阿里云短信直连（2026-08-24 开通）：RAM 子账号 bian-sms，仅 AliyunDysmsFullAccess 权限
function aliyunSmsConfigured(): boolean {
  return (
    process.env.SMS_PROVIDER === "aliyun" &&
    !!(process.env.SMS_ACCESS_KEY_ID && process.env.SMS_ACCESS_KEY_SECRET && process.env.SMS_SIGN_NAME && process.env.SMS_TEMPLATE_CODE)
  );
}

async function sendAliyunSms(phone: string, code: string): Promise<boolean> {
  const Dysmsapi = await import("@alicloud/dysmsapi20170525");
  const OpenApi = await import("@alicloud/openapi-client");
  const config = new OpenApi.Config({
    accessKeyId: process.env.SMS_ACCESS_KEY_ID,
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET,
  });
  config.endpoint = "dysmsapi.aliyuncs.com";
  const client = new Dysmsapi.default(config);
  const request = new Dysmsapi.SendSmsRequest({
    phoneNumbers: phone,
    signName: process.env.SMS_SIGN_NAME,
    templateCode: process.env.SMS_TEMPLATE_CODE,
    templateParam: JSON.stringify({ code }),
  });
  const resp = await client.sendSms(request);
  const body = resp.body!;
  if (body.code !== "OK") {
    console.error("[notify] aliyun sms rejected", body.code, body.message);
    return false;
  }
  return true;
}

export async function sendLoginCode(
  channel: CodeChannel,
  target: string,
  code: string
): Promise<SendResult> {
  if (channel === "email" && process.env.SMTP_URL && !isTestTarget(target)) {
    try {
      const transporter = nodemailer.createTransport(process.env.SMTP_URL, {
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 10_000,
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "no-reply@bian.local",
        to: target,
        subject: "彼岸登录验证码",
        text: `你的彼岸登录验证码是 ${code}，10 分钟内有效。`,
      });
      // dev/test 环境（NODE_ENV !== production）同时回显验证码：
      // 邮件已真实送达，但本地开发与自动化测试仍依赖 devCode 兜底
      const devEcho = process.env.NODE_ENV !== "production" ? { devCode: code } : {};
      return { delivered: true, ...devEcho };
    } catch (err) {
      console.error("[notify] email send failed", err);
    }
  }
  if (channel === "sms" && aliyunSmsConfigured() && !isTestSmsTarget(target)) {
    try {
      const ok = await sendAliyunSms(target, code);
      if (ok) {
        // dev/test 环境同时回显验证码（与邮件通道同规则），自动化测试仍依赖 devCode
        const devEcho = process.env.NODE_ENV !== "production" ? { devCode: code } : {};
        return { delivered: true, ...devEcho };
      }
    } catch (err) {
      console.error("[notify] aliyun sms send failed", err);
    }
  }
  if (channel === "sms" && process.env.SMS_WEBHOOK_URL) {
    try {
      const resp = await fetch(process.env.SMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, code, template: "login" }),
      });
      if (resp.ok) return { delivered: true };
      console.error("[notify] sms webhook status", resp.status);
    } catch (err) {
      console.error("[notify] sms send failed", err);
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[notify] ${channel} login code for ${target}: ${code}`);
    return { delivered: false, devCode: code };
  }
  return { delivered: false };
}

/* ---------- 通知中心（《11-建馆向导与我的板块方案》R5 / M4） ----------
 * 读取侧：GET /api/me/notifications；写入点：审核结论、协作组动态等。 */

export type NotificationKind = "review" | "collab" | "system";

/** 用户关闭了对应开关（users.settings.notifyReview/notifyCollab）时不写入 */
export function insertNotification(
  userId: string,
  kind: NotificationKind,
  title: string,
  opts: { body?: string; link?: string } = {}
): void {
  if (!userId || !title) return;
  const db = getDb();
  const row = db.prepare("SELECT settings FROM users WHERE id = ?").get(userId) as
    | { settings: string }
    | undefined;
  if (!row) return;
  try {
    const settings = JSON.parse(row.settings || "{}");
    if (kind === "review" && settings.notifyReview === false) return;
    if (kind === "collab" && settings.notifyCollab === false) return;
  } catch {
    /* settings 非 JSON 时按默认（全开）处理 */
  }
  db.prepare(
    "INSERT INTO notifications (id, user_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(uuid(), userId, kind, title.slice(0, 120), (opts.body || "").slice(0, 500), (opts.link || "").slice(0, 300));
}
