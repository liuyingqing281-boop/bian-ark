import nodemailer from "nodemailer";

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
