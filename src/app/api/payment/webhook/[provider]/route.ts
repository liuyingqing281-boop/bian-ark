import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "../../../../../lib/payment";
import { applyPaymentEvents } from "../../../../../lib/payment/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  const provider = getPaymentProvider(name);
  if (!provider) return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  const raw = await req.text();
  try {
    const events = await provider.verifyWebhook(raw, req.headers);
    const result = applyPaymentEvents(provider.name, events);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "webhook_failed" }, { status: 400 });
  }
}
