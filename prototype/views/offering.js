/* V5 祭奠页 */
window.BianViews = window.BianViews || {};
window.BianViews.offering = {
  tab: "hall",
  async init(root, ctx) {
    const A = window.BianApi, id = ctx.id || A.memorialId();
    const $ = (s) => root.querySelector(s);
    $("#gift-entry").onclick = () => ctx.go("gift");

    const r = await A.getItems(id);
    const items = Array.isArray(r.data?.items) ? r.data.items : [];
    const price = (x) => x.priceCents ?? x.price_cents ?? 0;
    const free = items.filter((x) => !price(x)).slice(0, 3);
    const paid = items.filter((x) => price(x) > 0).slice(0, 3);

    // 免费三项：真实供奉
    root.querySelectorAll("#free-grid > button").forEach((btn) => {
      btn.onclick = async () => {
        const item = free[Number(btn.dataset.i)];
        if (!item) return A.toast("祭品目录加载中，请稍后再试");
        const res = await A.tribute(item.id);
        if (res.ok) A.toast(`已为 TA ${item.name}`);
        else if (res.status === 401) A.toast("登录后才能供奉，请先到「我的」登录");
        else A.toast("没有供奉成功，请再试一次");
      };
    });

    // 付费三项：价格点击前可见 → F2 一口价确认浮层（白名单元素）
    root.querySelectorAll("#paid-grid > button").forEach((btn) => {
      btn.onclick = () => {
        const item = paid[Number(btn.dataset.i)];
        ctx.openOverlay("pay", { item: item || null });
      };
    });
  },
};
