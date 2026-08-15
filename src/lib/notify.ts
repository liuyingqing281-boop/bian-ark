import nodemailer from "nodemailer";

export type CodeChannel = "email" | "sms";

export interface SendResult {
  delivered: boolean;
  devCode?: string;
}

export async function sendLoginCode(
  channel: CodeChannel,
  target: string,
  code: string
): Promise<SendResult> {
  if (channel === "email" && process.env.SMTP_URL) {
    try {
      const transporter = nodemailer.createTransport(process.env.SMTP_URL);
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "no-reply@bian.local",
        to: target,
        subject: "彼岸登录验证码",
        text: `你的彼岸登录验证码是 ${code}，10 分钟内有效。`,
      });
      return { delivered: true };
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
  console.log(`[notify] ${channel} login code for ${target}: ${code}`);
  if (process.env.NODE_ENV !== "production") {
    return { delivered: false, devCode: code };
  }
  return { delivered: false };
}