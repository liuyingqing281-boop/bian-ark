import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import { toOrderView } from "../../../../lib/view-models";

// 我的订单流水（F6 OrderView）：一口价订单，倒序，含 refunded 显性展示
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = getDb()
    .prepare(
      `SELECT id, kind, amount_cents, currency, status, created_at
       FROM orders WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all(user.id) as Array<{
    id: string;
    kind: string;
    amount_cents: number;
    currency: string;
    status: string;
    created_at: string;
  }>;

  return NextResponse.json({ items: rows.map(toOrderView) });
}
