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

  const db = getDb();
  try {
    db.prepare("INSERT INTO payment_events (provider_event_id, event_type, payload) VALUES (?, ?, ?)")
      .run(event.id, event.type, payload.slice(0, 100000));
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      customer?: string | null;
      metadata?: Record<string, string> | null;
    };
    const meta = session.metadata || {};
    db.prepare("UPDATE orders SET status = 'paid', provider_payment_id = ?, updated_at = datetime('now') WHERE provider_session_id = ?")
      .run(String((event.data.object as { payment_intent?: string | null }).payment_intent || ""), session.id);
    if (meta.kind === "premium_monthly" || meta.kind === "premium_yearly") {
      const days = meta.kind === "premium_monthly" ? 31 : 366;
      db.prepare(
        `UPDATE users
         SET membership_tier = 'premium',
             membership_expires_at = datetime(COALESCE(NULLIF(membership_expires_at, ''), 'now'), '+' || ? || ' days'),
             stripe_customer_id = COALESCE(?, stripe_customer_id)
         WHERE id = ?`
      ).run(days, String(session.customer || ""), meta.user_id || "");
      db.prepare("INSERT INTO membership_history (id, user_id, action, source, expires_at) SELECT ?, id, 'activated', ?, membership_expires_at FROM users WHERE id = ?")
        .run(uuid(), meta.kind, meta.user_id || "");
    } else if (meta.kind === "dh_redo") {
      db.prepare(
        "INSERT INTO dh_redo_credits (id, memorial_id, user_id, stripe_session_id) VALUES (?, ?, ?, ?)"
      ).run(uuid(), meta.memorial_id || "", meta.user_id || "", session.id);
    }
  } else if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as { customer?: string | null };
    db.prepare("UPDATE orders SET status = 'failed', error = 'invoice_payment_failed', updated_at = datetime('now') WHERE user_id = (SELECT id FROM users WHERE stripe_customer_id = ?) AND status = 'paid'")
      .run(String(invoice.customer || ""));
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as { customer?: string | null };
    const row = db.prepare("SELECT id FROM users WHERE stripe_customer_id = ?").get(String(subscription.customer || "")) as { id: string } | undefined;
    if (row) {
      db.prepare("UPDATE users SET membership_tier = 'free', membership_expires_at = '' WHERE id = ?").run(row.id);
      db.prepare("INSERT INTO membership_history (id, user_id, action, source) VALUES (?, ?, 'canceled', 'stripe')").run(uuid(), row.id);
    }
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as { payment_intent?: string | null };
    db.prepare("UPDATE orders SET status = 'refunded', refunded_at = datetime('now'), updated_at = datetime('now') WHERE provider_payment_id = ?")
      .run(String(charge.payment_intent || ""));
  }
  return NextResponse.json({ received: true });
}
