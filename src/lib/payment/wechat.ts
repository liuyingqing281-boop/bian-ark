import { createSign, randomBytes, verify, createDecipheriv } from "node:crypto";
import { PaymentEvent, PaymentIntent, PaymentProvider, PaymentResult } from "./types";

const env = (name: string) => process.env[name] || "";
const configured = () => ["WECHAT_PAY_MCH_ID", "WECHAT_PAY_API_V3_KEY", "WECHAT_PAY_SERIAL_NO", "WECHAT_PAY_PRIVATE_KEY", "WECHAT_PAY_NOTIFY_URL"].every((key) => !!env(key)) && !!(env("WECHAT_PAY_APP_ID") || env("WECHAT_APP_ID"));
const pem = () => env("WECHAT_PAY_PRIVATE_KEY").replace(/\\n/g, "\n");

function sign(message: string) {
  return createSign("RSA-SHA256").update(message).sign(pem(), "base64");
}

export class WechatPayProvider implements PaymentProvider {
  readonly name = "wechat";
  configured() { return configured(); }

  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    if (!configured()) throw new Error("payment_not_configured");
    const nonce = randomBytes(16).toString("hex");
    const mobile = /Mobile|Android|iPhone/i.test(intent.userAgent || "");
    const endpoint = mobile ? "https://api.mch.weixin.qq.com/v3/h5/pay" : "https://api.mch.weixin.qq.com/v3/pay/transactions/native";
    const body = mobile
      ? { mchid: env("WECHAT_PAY_MCH_ID"), out_trade_no: intent.orderId, appid: env("WECHAT_PAY_APP_ID") || env("WECHAT_APP_ID"), description: intent.description, notify_url: env("WECHAT_PAY_NOTIFY_URL"), scene_info: { payer_client_ip: intent.clientIp || "127.0.0.1", h5_info: { type: "Wap", app_name: "彼岸" } }, amount: { total: intent.amountCents, currency: intent.currency.toUpperCase() } }
      : { mchid: env("WECHAT_PAY_MCH_ID"), out_trade_no: intent.orderId, appid: env("WECHAT_PAY_APP_ID") || env("WECHAT_APP_ID"), description: intent.description, notify_url: env("WECHAT_PAY_NOTIFY_URL"), amount: { total: intent.amountCents, currency: intent.currency.toUpperCase() } };
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify(body);
    const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${env("WECHAT_PAY_MCH_ID")}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${env("WECHAT_PAY_SERIAL_NO")}",signature="${sign(`${timestamp}\n${nonce}\n${payload}\n`)}"`;
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authorization }, body: payload });
    if (!response.ok) throw new Error("wechat_create_failed");
    const data = await response.json() as { code_url?: string; h5_url?: string };
    if (!data.code_url && !data.h5_url) throw new Error("wechat_missing_payment_url");
    return { provider: this.name, sessionId: intent.orderId, qrCode: data.code_url, payUrl: data.h5_url, raw: data };
  }

  async verifyWebhook(raw: string, headers: Headers): Promise<PaymentEvent[]> {
    if (!configured()) throw new Error("payment_not_configured");
    const timestamp = headers.get("wechatpay-timestamp") || "";
    const nonce = headers.get("wechatpay-nonce") || "";
    const signature = headers.get("wechatpay-signature") || "";
    const message = `${timestamp}\n${nonce}\n${raw}\n`;
    const publicKey = env("WECHAT_PAY_PLATFORM_PUBLIC_KEY").replace(/\\n/g, "\n");
    if (!publicKey || !verify("RSA-SHA256", Buffer.from(message), publicKey, Buffer.from(signature, "base64"))) throw new Error("invalid_signature");
    const envelope = JSON.parse(raw) as { id: string; resource: { ciphertext: string; nonce: string; associated_data: string } };
    const key = Buffer.from(env("WECHAT_PAY_API_V3_KEY"));
    const data = Buffer.from(envelope.resource.ciphertext, "base64");
    const authTag = data.subarray(data.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.resource.nonce));
    decipher.setAAD(Buffer.from(envelope.resource.associated_data));
    decipher.setAuthTag(authTag);
    const payment = JSON.parse(Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]).toString()) as Record<string, unknown>;
    const trade = String(payment.trade_state || "");
    return [{ id: envelope.id, type: trade === "SUCCESS" ? "paid" : "failed", sessionId: String(payment.out_trade_no || ""), paymentId: String(payment.transaction_id || ""), amountCents: Number((payment.amount as { total?: number })?.total || 0), currency: String((payment.amount as { currency?: string })?.currency || "CNY"), raw: payment }];
  }
}
