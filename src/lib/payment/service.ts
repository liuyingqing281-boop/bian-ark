import { v4 as uuid } from "uuid";
import { getDb } from "../db";
import { trackEvent } from "../events";
import { PaymentEvent } from "./types";

export function applyPaymentEvents(provider: string, events: PaymentEvent[]): { processed: number; duplicates: number } {
  const db = getDb();
  let processed = 0;
  let duplicates = 0;
  const run = db.transaction(() => {
    for (const event of events) {
      try {
        db.prepare("INSERT INTO payment_events (provider_event_id, event_type, payload) VALUES (?, ?, ?)").run(`${provider}:${event.id}`, `${provider}.${event.type}`, JSON.stringify(event.raw || event));
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE")) { duplicates += 1; continue; }
        throw error;
      }
      const order = db.prepare("SELECT * FROM orders WHERE provider_session_id = ? OR provider_order_id = ? LIMIT 1").get(event.sessionId || "", event.sessionId || "") as {
        id: string; user_id: string; kind: string; provider_session_id: string; amount_cents: number; status: string;
      } | undefined;
      if (!order) { trackEvent("payment_webhook", { provider, status: "orphan", event: event.type }); processed += 1; continue; }
      if (event.amountCents && Number(event.amountCents) !== Number(order.amount_cents)) throw new Error("amount_mismatch");
      if (event.type === "paid") {
        if (order.status !== "paid") {
          db.prepare("UPDATE orders SET status = 'paid', provider_payment_id = ?, updated_at = datetime('now') WHERE id = ?").run(event.paymentId || "", order.id);
          if (order.kind === "premium_monthly" || order.kind === "premium_yearly") {
            const days = order.kind === "premium_monthly" ? 31 : 366;
            db.prepare("UPDATE users SET membership_tier = 'premium', membership_expires_at = datetime(COALESCE(NULLIF(membership_expires_at, ''), 'now'), '+' || ? || ' days') WHERE id = ?").run(days, order.user_id);
            db.prepare("INSERT INTO membership_history (id, user_id, action, source, expires_at) SELECT ?, id, 'activated', ?, membership_expires_at FROM users WHERE id = ?").run(uuid(), provider, order.user_id);
          } else if (order.kind === "dh_redo") {
            const memorial = db.prepare("SELECT memorial_id FROM payment_order_meta WHERE order_id = ?").get(order.id) as { memorial_id: string } | undefined;
            if (memorial) db.prepare("INSERT OR IGNORE INTO dh_redo_credits (id, memorial_id, user_id, stripe_session_id) VALUES (?, ?, ?, ?)").run(uuid(), memorial.memorial_id, order.user_id, order.provider_session_id);
          }
        }
        trackEvent("payment_webhook", { provider, status: "success", event: event.type }, order.user_id);
      } else if (event.type === "failed") {
        db.prepare("UPDATE orders SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ? AND status = 'pending'").run(`${provider}_payment_failed`, order.id);
        trackEvent("payment_webhook", { provider, status: "failed", event: event.type }, order.user_id);
      } else if (event.type === "refunded") {
        db.prepare("UPDATE orders SET status = 'refunded', refunded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(order.id);
        trackEvent("payment_webhook", { provider, status: "refunded", event: event.type }, order.user_id);
      }
      processed += 1;
    }
  });
  run();
  return { processed, duplicates };
}
