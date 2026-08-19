import Stripe from "stripe";
import { getStripe, stripeConfigured } from "../stripe";
import { PaymentEvent, PaymentIntent, PaymentProvider, PaymentResult } from "./types";

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";
  configured() { return stripeConfigured(); }
  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    if (!this.configured()) throw new Error("payment_not_configured");
    const price = intent.kind === "premium_monthly" ? process.env.STRIPE_PRICE_PREMIUM_MONTHLY : intent.kind === "premium_yearly" ? process.env.STRIPE_PRICE_PREMIUM_YEARLY : "";
    const lineItems = intent.kind === "dh_redo" ? [{ quantity: 1, price_data: { currency: "cny", unit_amount: intent.amountCents, product_data: { name: intent.description } } }] : [{ quantity: 1, price: price || undefined }];
    const session = await getStripe().checkout.sessions.create({ mode: intent.kind === "dh_redo" ? "payment" : "subscription", line_items: lineItems as never, metadata: { kind: intent.kind, user_id: intent.userId, memorial_id: intent.memorialId || "", order_id: intent.orderId }, customer_email: undefined, success_url: `${process.env.PUBLIC_APP_URL || "http://localhost:3002"}/zh/me?paid=1`, cancel_url: `${process.env.PUBLIC_APP_URL || "http://localhost:3002"}/zh/membership?canceled=1` });
    return { provider: this.name, sessionId: session.id, payUrl: session.url || undefined, raw: session };
  }
  async verifyWebhook(raw: string, headers: Headers): Promise<PaymentEvent[]> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !this.configured()) throw new Error("webhook_not_configured");
    const event = getStripe().webhooks.constructEvent(raw, headers.get("stripe-signature") || "", secret);
    if (event.type !== "checkout.session.completed") return [];
    const session = event.data.object as Stripe.Checkout.Session;
    return [{ id: event.id, type: "paid", sessionId: session.metadata?.order_id || session.id, paymentId: String(session.payment_intent || ""), kind: session.metadata?.kind as PaymentEvent["kind"], userId: session.metadata?.user_id, memorialId: session.metadata?.memorial_id, amountCents: session.amount_total ?? undefined, currency: session.currency?.toUpperCase(), raw: event }];
  }
}
