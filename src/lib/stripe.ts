import Stripe from "stripe";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return !!key && !key.includes("xxxx");
}

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("stripe_not_configured");
    client = new Stripe(key);
  }
  return client;
}