import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";
import { getPaymentProvider, getPaymentProviders, PaymentKind } from "../../../lib/payment";
import { trackEvent } from "../../../lib/events";

const KINDS = new Set<PaymentKind>(["premium_monthly", "premium_yearly", "dh_redo"]);
const amountFor = (kind: PaymentKind) => kind === "premium_monthly" ? Number(process.env.PREMIUM_MONTHLY_PRICE_CENTS || 990) : kind === "premium_yearly" ? Number(process.env.PREMIUM_YEARLY_PRICE_CENTS || 9900) : Number(process.env.DH_REDO_PRICE_CENTS || 2999);

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const kind = String(body?.kind || "") as PaymentKind;
  if (!KINDS.has(kind)) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  const providers = getPaymentProviders();
  if (!providers.length) return NextResponse.json({ error: "payment_not_configured" }, { status: 503 });
  const providerName = String(body?.provider || providers[0].name);
  const provider = getPaymentProvider(providerName);
  if (!provider) return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  const memorialId = kind === "dh_redo" ? String(body?.memorial_id || "") : "";
  if (kind === "dh_redo") {
    const memorial = getDb().prepare("SELECT user_id FROM memorials WHERE id = ?").get(memorialId) as { user_id: string } | undefined;
    if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const db = getDb();
  const orderId = uuid();
  const amountCents = amountFor(kind);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return NextResponse.json({ error: "invalid_amount" }, { status: 500 });
  db.prepare("INSERT INTO orders (id, user_id, kind, provider, provider_session_id, provider_order_id, status, amount_cents, currency, payment_method) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'cny', ?)").run(orderId, user.id, kind, provider.name, orderId, orderId, amountCents, provider.name);
  if (memorialId) db.prepare("INSERT INTO payment_order_meta (order_id, memorial_id) VALUES (?, ?)").run(orderId, memorialId);
  try {
    const result = await provider.createPayment({ kind, userId: user.id, memorialId, amountCents, currency: "CNY", description: kind === "dh_redo" ? "数字人重做" : kind === "premium_monthly" ? "彼岸会员月度" : "彼岸会员年度", orderId, userAgent: req.headers.get("user-agent") || "" });
    db.prepare("UPDATE orders SET provider_session_id = ?, updated_at = datetime('now') WHERE id = ?").run(result.sessionId, orderId);
    trackEvent("payment_create", { provider: provider.name, kind }, user.id);
    return NextResponse.json({ ok: true, provider: provider.name, session_id: result.sessionId, pay_url: result.payUrl, qr: result.qrCode });
  } catch (error) {
    db.prepare("UPDATE orders SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?").run(error instanceof Error ? error.message : "payment_create_failed", orderId);
    trackEvent("payment_create", { provider: provider.name, kind, status: "failed" }, user.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "payment_create_failed" }, { status: 502 });
  }
}
