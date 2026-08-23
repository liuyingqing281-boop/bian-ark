/* V-ORDERS 订单记录（R5）：GET /api/me/orders 流水列表，退款显性 */
window.BianViews = window.BianViews || {};
window.BianViews.orders = {
  tab: null,
  async init(root) {
    const A = window.BianApi;
    const box = root.querySelector("#orders-list");
    const STATUS = {
      paid: ["已支付", "color:var(--ember-soft)"],
      refunded: ["已退款", "color:#e86a6a"],
      pending: ["待支付", "color:#e8c06a"],
      failed: ["未完成", "color:#9a9a9a"],
    };
    const KIND = { tribute: "供奉", membership: "年卡", item: "祭品", digital_human: "数字人" };
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    const r = await A.getMeOrders();
    if (!r.ok) {
      box.innerHTML = `<p class="px-5 py-4 t3 text-[13px]">登录后可见订单记录。</p>`;
      return;
    }
    const items = Array.isArray(r.data?.items) ? r.data.items : [];
    if (!items.length) {
      box.innerHTML = `<p class="px-5 py-4 t3 text-[13px]">暂无订单。</p>`;
      return;
    }
    box.innerHTML = items.map((o) => {
      const [label, style] = STATUS[o.status] || [o.status, "color:#9a9a9a"];
      const name = o.itemName || KIND[o.kind] || o.kind || "订单";
      return `<div class="flex items-center gap-3 px-5 py-4">
        <div class="flex-1 min-w-0">
          <p class="text-[14px] truncate">${esc(name)}</p>
          <p class="t3 text-[11px] mt-0.5">${esc(A.fmtDate(o.createdAt || o.created_at))}</p>
        </div>
        <span class="text-[14px]">${esc(A.yuan(o.amountCents ?? o.amount_cents))}</span>
        <span class="text-[11px] shrink-0" style="${style}">${label}</span>
      </div>`;
    }).join("");
  },
};
