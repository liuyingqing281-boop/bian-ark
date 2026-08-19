export type PaymentKind = "premium_monthly" | "premium_yearly" | "dh_redo";

export interface PaymentIntent {
  kind: PaymentKind;
  userId: string;
  memorialId?: string;
  amountCents: number;
  currency: string;
  description: string;
  orderId: string;
  clientIp?: string;
  userAgent?: string;
}

export interface PaymentResult {
  provider: string;
  sessionId: string;
  payUrl?: string;
  qrCode?: string;
  raw?: unknown;
}

export interface PaymentEvent {
  id: string;
  type: "paid" | "failed" | "refunded" | "subscription_canceled";
  sessionId?: string;
  paymentId?: string;
  kind?: PaymentKind;
  userId?: string;
  memorialId?: string;
  amountCents?: number;
  currency?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  configured(): boolean;
  createPayment(intent: PaymentIntent): Promise<PaymentResult>;
  verifyWebhook(raw: string, headers: Headers): Promise<PaymentEvent[]>;
}
