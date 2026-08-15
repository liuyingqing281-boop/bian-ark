import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";
import { getStripe, stripeConfigured } from "../../../lib/stripe";

const KINDS = new Set(["premium_monthly", "premium_yearly", "dh_redo"]);

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "payment_not_configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const kind = String(body?.kind || "");
  if (!KINDS.has(kind)) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });

  const db = getDb();
  const metadata: Record<string, string> = { kind, user_id: user.id };
  let lineItem: { quantity: number; price?: string; price_data?: object };

  if (kind === "dh_redo") {
    const memorialId = String(body?.memorial_id || "");
    const memorial = db.prepare("SELECT user_id FROM memorials WHERE id = ?").get(memorialId) as
      | { user_id: string }
      | undefined;
    if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    metadata.memorial_id = memorialId;
    lineItem = {
      quantity: 1,
      price_data: {
        currency: "cny",
        unit_amount: Number(process.env.DH_REDO_PRICE_CENTS || 2999),
        product_data: { name: "数字人重做 / Digital human regeneration" },
      },
    };
  } else {
    const price =
      kind === "premium_monthly"
        ? process.env.STRIPE_PRICE_PREMIUM_MONTHLY
        : process.env.STRIPE_PRICE_PREMIUM_YEARLY;
    if (!price || price.includes("xxxx")) {
      return NextResponse.json({ error: "price_not_configured" }, { status: 503 });
    }
    lineItem = { quantity: 1, price };
  }

  const origin = req.nextUrl.origin;
  const session = await getStripe().checkout.sessions.create({
    mode: kind === "dh_redo" ? "payment" : "subscription",
    line_items: [lineItem as never],
    metadata,
    customer_email: user.email || undefined,
    success_url: `${origin}/zh/me?paid=1`,
    cancel_url: `${origin}/zh/membership?canceled=1`,
  });
  return NextResponse.json({ ok: true, url: session.url });
}