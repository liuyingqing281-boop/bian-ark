import { PaymentEvent, PaymentIntent, PaymentProvider, PaymentResult } from "./types";

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  configured() { return true; }
  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    return { provider: this.name, sessionId: intent.orderId, payUrl: `/api/payment/mock/${intent.orderId}` };
  }
  async verifyWebhook(raw: string): Promise<PaymentEvent[]> {
    const body = JSON.parse(raw) as PaymentEvent | PaymentEvent[];
    return (Array.isArray(body) ? body : [body]).map((event) => ({ ...event, raw: body }));
  }
}
