// 视图模型装配层：物理行（snake_case）→ 前端契约（camelCase、已打码）
// 契约见《docs/09-数据库设计》上篇 F1–F6；契约只增不减，迁移期路由可同时携带旧字段。

/** 打码：仅保留首字符，空则「访客」。任何对外列表禁止返回完整真实姓名。 */
export function maskName(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "访客";
  return n.slice(0, 1) + "**";
}

/** F3 FeedItem */
export interface FeedItemView {
  kind: "tribute" | "message";
  icon: string;
  label: string;
  senderMasked: string;
  message: string;
  isMine: boolean;
  isBurning: boolean;
  createdAt: string;
}

/** F5 对话历史条目 */
export interface ChatHistoryItemView {
  role: "user" | "ta";
  content: string;
  evidenceMemoryId: string | null;
  createdAt: string;
}

export function toChatHistoryItem(row: {
  role: string;
  content: string;
  evidence_memory_id: string | null;
  created_at: string;
}): ChatHistoryItemView {
  return {
    role: row.role === "ta" ? "ta" : "user",
    content: row.content,
    evidenceMemoryId: row.evidence_memory_id ?? null,
    createdAt: row.created_at,
  };
}

/** F6 OrderView（orders 无商品关联字段，itemName 由 kind 映射，后续接入 item 快照再细化） */
export interface OrderView {
  id: string;
  kind: string;
  itemName: string;
  amountCents: number;
  currency: string;
  status: "pending" | "paid" | "refunded" | "failed";
  createdAt: string;
}

const ORDER_KIND_LABEL: Record<string, string> = {
  item: "一口价祭品",
  gift: "AI 生成纪念物",
  membership: "会员",
};

export function toOrderView(row: {
  id: string;
  kind: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
}): OrderView {
  const status = (["pending", "paid", "refunded", "failed"] as const).includes(
    row.status as OrderView["status"]
  )
    ? (row.status as OrderView["status"])
    : "pending";
  return {
    id: row.id,
    kind: row.kind,
    itemName: ORDER_KIND_LABEL[row.kind] ?? "一口价订单",
    amountCents: row.amount_cents,
    currency: row.currency || "cny",
    status,
    createdAt: row.created_at,
  };
}

/** 兼容读取请求参数/请求体：camelCase 优先，回落 snake_case */
export function pickId(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    const t = (v || "").trim();
    if (t) return t;
  }
  return "";
}
