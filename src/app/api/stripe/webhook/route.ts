import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../../lib/db";
import { getStripe } from "../../../../lib/stripe";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.includes("xxxx")) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      customer?: string | null;
      metadata?: Record<string, string> | null;
    };
    const meta = session.metadata || {};
    const db = getDb();
    if (meta.kind === "premium_monthly" || meta.kind === "premium_yearly") {
      const days = meta.kind === "premium_monthly" ? 31 : 366;
      db.prepare(
        `UPDATE users
         SET membership_tier = 'premium',
             membership_expires_at = datetime(COALESCE(NULLIF(membership_expires_at, ''), 'now'), '+' || ? || ' days'),
             stripe_customer_id = COALESCE(?, stripe_customer_id)
         WHERE id = ?`
      ).run(days, String(session.customer || ""), meta.user_id || "");
    } else if (meta.kind === "dh_redo") {
      db.prepare(
        "INSERT INTO dh_redo_credits (id, memorial_id, user_id, stripe_session_id) VALUES (?, ?, ?, ?)"
      ).run(uuid(), meta.memorial_id || "", meta.user_id || "", session.id);
    }
  }
  return NextResponse.json({ received: true });
}