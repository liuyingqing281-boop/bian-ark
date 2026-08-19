import { createSign, createVerify, randomUUID } from "node:crypto";
import { PaymentEvent, PaymentIntent, PaymentProvider, PaymentResult } from "./types";

const env = (name: string) => process.env[name] || "";
const configured = () => ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY", "ALIPAY_NOTIFY_URL"].every((key) => !!env(key));
const key = (name: string) => env(name).replace(/\\n/g, "\n");
function signParams(params: Record<string, string>) {
  const content = Object.keys(params).filter((k) => k !== "sign" && params[k] !== "").sort().map((k) => `${k}=${params[k]}`).join("&");
  return createSign("RSA-SHA256").update(content).sign(key("ALIPAY_PRIVATE_KEY"), "base64");
}

export class AlipayProvider implements PaymentProvider {
  readonly name = "alipay";
  configured() { return configured(); }
  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    if (!configured()) throw new Error("payment_not_configured");
    const mobile = /Mobile|Android|iPhone/i.test(intent.userAgent || "");
    const method = mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
    const params: Record<string, string> = { app_id: env("ALIPAY_APP_ID"), method, format: "JSON", charset: "utf-8", sign_type: "RSA2", timestamp: new Date().toISOString().slice(0, 19).replace("T", " "), version: "1.0", notify_url: env("ALIPAY_NOTIFY_URL"), biz_content: JSON.stringify({ out_trade_no: intent.orderId, product_code: mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY", total_amount: (intent.amountCents / 100).toFixed(2), subject: intent.description }) };
    params.sign = signParams(params);
    const query = new URLSearchParams(params).toString();
    return { provider: this.name, sessionId: intent.orderId, payUrl: `https://openapi.alipay.com/gateway.do?${query}` };
  }
  async verifyWebhook(raw: string): Promise<PaymentEvent[]> {
    if (!configured()) throw new Error("payment_not_configured");
    const params = Object.fromEntries(new URLSearchParams(raw).entries());
    const signature = params.sign || "";
    const content = Object.keys(params).filter((k) => !["sign", "sign_type"].includes(k) && params[k] !== "").sort().map((k) => `${k}=${params[k]}`).join("&");
    if (!createVerify("RSA-SHA256").update(content).verify(key("ALIPAY_PUBLIC_KEY"), signature, "base64")) throw new Error("invalid_signature");
    const success = params.trade_status === "TRADE_SUCCESS" || params.trade_status === "TRADE_FINISHED";
    return [{ id: params.notify_id || randomUUID(), type: success ? "paid" : "failed", sessionId: params.out_trade_no, paymentId: params.trade_no, amountCents: Math.round(Number(params.total_amount || 0) * 100), currency: "CNY", raw: params }];
  }
}
