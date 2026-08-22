import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { getSessionUser } from "../../../lib/auth";
import { canTributeMemorial, MemorialAccessRow } from "../../../lib/permissions";
import { moderateText } from "../../../lib/moderation";
import { trackEvent } from "../../../lib/events";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  // JSON 分支：契约见 docs/08《API 接口说明书》——{ memorialId, itemId, message?, senderName?, orderId? } → 201 { id }
  if ((req.headers.get("content-type") || "").includes("application/json")) {
    let body: { memorialId?: string; itemId?: string; message?: string; senderName?: string; orderId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const memorialId = body.memorialId;
    if (!memorialId) return NextResponse.json({ error: "missing memorial_id" }, { status: 400 });

    const db = getDb();
    const memorial = db
      .prepare("SELECT id, user_id, visibility FROM memorials WHERE id = ? AND is_published = 1")
      .get(memorialId) as MemorialAccessRow | undefined;
    if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (!canTributeMemorial(memorial, user.id)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const senderName = ((body.senderName || "").trim().slice(0, 40)) || user.name || "匿名";
    const message = (body.message || "").slice(0, 500);
    const check = await moderateText(senderName + " " + message);
    if (!check.pass) return NextResponse.json({ error: "content_rejected" }, { status: 422 });

    const itemId = body.itemId || "flower_white";
    const item = db.prepare("SELECT owner_user_id, review_status, is_premium FROM items WHERE id = ?").get(itemId) as
      | { owner_user_id: string; review_status: string; is_premium: number }
      | undefined;
    if (!item || (item.review_status !== "approved" && item.owner_user_id !== user.id)) {
      return NextResponse.json({ error: "item_unavailable" }, { status: 404 });
    }

    // G7 一口价链路：付费祭品必须关联本人已支付订单
    if (item.is_premium === 1) {
      const orderId = (body.orderId || "").trim();
      const order = orderId
        ? (db.prepare("SELECT status, user_id FROM orders WHERE id = ?").get(orderId) as { status: string; user_id: string } | undefined)
        : undefined;
      if (!order || order.status !== "paid" || order.user_id !== user.id) {
        return NextResponse.json({ error: "payment_required" }, { status: 402 });
      }
    }

    const id = uuid();
    db.prepare(
      "INSERT INTO tributes (id, memorial_id, item_id, message, sender_name, is_burning, user_id, review_status, review_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, memorialId, itemId, message, senderName, 0, user.id, check.status, check.reason || "");
    trackEvent(
      "tribute_completed",
      { memorial_id: memorialId, item_id: itemId, has_message: message ? 1 : 0, burning: 0, visibility: memorial.visibility },
      user.id
    );
    return NextResponse.json({ id }, { status: 201 });
  }

  // 表单分支：SSR 页面传统提交，成功后重定向回纪念馆页
  const formData = await req.formData();
  const memorial_id = formData.get("memorial_id") as string;
  const item_id = formData.get("item_id") as string;
  const rawLang = formData.get("lang") as string;
  const lang = rawLang === "en" ? "en" : "zh";

  if (!memorial_id) {
    return NextResponse.redirect(new URL(`/${lang}`, req.url));
  }

  const db = getDb();
  const memorial = db
    .prepare("SELECT id, user_id, visibility FROM memorials WHERE id = ? AND is_published = 1")
    .get(memorial_id) as MemorialAccessRow | undefined;
  if (!memorial) {
    return NextResponse.redirect(new URL(`/${lang}`, req.url));
  }

  const user = await getSessionUser();
  if (!canTributeMemorial(memorial, user?.id ?? null)) {
    return NextResponse.redirect(new URL(`/${lang}/login`, req.url));
  }

  const sender_name =
    ((formData.get("sender_name") as string) || "").trim().slice(0, 40) ||
    user?.name ||
    (lang === "en" ? "Anonymous" : "匿名");
  const message = ((formData.get("message") as string) || "").slice(0, 500);
  const senderCheck = await moderateText(sender_name + " " + message);
  if (!senderCheck.pass) {
    return NextResponse.redirect(new URL(`/${lang}/memorial/${memorial_id}?blocked=1`, req.url));
  }
  const is_burning = formData.get("is_burning") === "1" ? 1 : 0;
  const item = db.prepare("SELECT owner_user_id, review_status, is_premium FROM items WHERE id = ?").get(item_id || "flower_white") as
    | { owner_user_id: string; review_status: string; is_premium: number }
    | undefined;
  if (!item || (item.review_status !== "approved" && item.owner_user_id !== user?.id)) {
    return NextResponse.redirect(new URL(`/${lang}/memorial/${memorial_id}?item_unavailable=1`, req.url));
  }

  // G7 一口价链路：仅付费祭品需要关联已支付订单；免费项路径不变
  if (item.is_premium === 1) {
    const order_id = ((formData.get("order_id") as string) || "").trim();
    const order = order_id
      ? (db.prepare("SELECT status FROM orders WHERE id = ?").get(order_id) as { status: string } | undefined)
      : undefined;
    if (!order || order.status !== "paid") {
      return NextResponse.redirect(new URL(`/${lang}/memorial/${memorial_id}?order_required=1`, req.url));
    }
  }

  const itemId = item_id || "flower_white";
  db.prepare(
    "INSERT INTO tributes (id, memorial_id, item_id, message, sender_name, is_burning, user_id, review_status, review_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(uuid(), memorial_id, itemId, message, sender_name, is_burning, user?.id || "", senderCheck.status, senderCheck.reason || "");
  // 北极星事件：每周有祭奠动作的馆数按此聚合
  trackEvent(
    "tribute_completed",
    { memorial_id, item_id: itemId, has_message: message ? 1 : 0, burning: is_burning, visibility: memorial.visibility },
    user?.id || ""
  );

  return NextResponse.redirect(new URL(`/${lang}/memorial/${memorial_id}`, req.url));
}
