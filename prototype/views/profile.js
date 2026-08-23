/* V7 我的页 */
window.BianViews = window.BianViews || {};
window.BianViews.profile = {
  tab: "me",
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    const REL_META = { created: ["馆主", "background:rgba(255,122,47,.14);color:var(--ember-soft)"], owner: ["馆主", "background:rgba(255,122,47,.14);color:var(--ember-soft)"], collaborating: ["协作", "background:rgba(255,255,255,.06);color:var(--text-2)"], collaborator: ["协作", "background:rgba(255,255,255,.06);color:var(--text-2)"], tributed: ["纪念过", "background:rgba(255,255,255,.06);color:var(--text-2)"], visited: ["纪念过", "background:rgba(255,255,255,.06);color:var(--text-2)"] };

    $("#v7-gear").onclick = () => ctx.go("settings");
    $("#me-groups").onclick = () => ctx.go("groups");
    $("#me-notif").onclick = () => ctx.go("notifications");
    $("#me-privacy").onclick = () => ctx.go("privacy");
    $("#me-feedback").onclick = () => ctx.go("feedback");

    const me = await A.getMe();
    if (!me.ok) {
      $("#me-name").textContent = "未登录";
      $("#me-sub").textContent = "点击前往登录";
      $("#me-card").style.cursor = "pointer";
      $("#me-card").onclick = () => ctx.go("auth");
      $("#me-memorials").innerHTML = `<p class="px-5 py-4 t3 text-[13px]">登录后展示你创建、协作和纪念过的纪念馆。</p>`;
      $("#me-orders-sub").textContent = "登录后可见";
      return;
    }
    const u = me.data?.user || {};
    const name = (u.name || u.email || "我").trim();
    $("#me-name").textContent = name;
    $("#me-initial").textContent = name.slice(0, 1);

    // 我的纪念聚合（点击条目 → 切换到该馆并回首页）
    const mm = await A.getMeMemorials();
    const list = Array.isArray(mm.data?.items) ? mm.data.items : [];
    const box = $("#me-memorials");
    box.innerHTML = list.length
      ? list.map((m) => {
          const [badge, style] = REL_META[m.relation] || REL_META.visited;
          const avatar = m.avatar_url || m.avatarUrl;
          const mid = m.memorial_id || m.memorialId || m.id;
          return `<button class="w-full flex items-center gap-4 px-5 py-4" data-mid="${mid}">
            ${avatar ? `<img src="${avatar}" class="w-11 h-11 rounded-full object-cover" alt=""/>` : `<div class="w-11 h-11 rounded-full card flex items-center justify-center t3"><i class="fa-solid fa-user"></i></div>`}
            <div class="flex-1 text-left"><p class="text-[15px]">${m.name}的纪念馆</p></div>
            <span class="text-[10px] px-2 py-1 rounded-full" style="${style}">${badge}</span>
          </button>`;
        }).join("")
      : `<p class="px-5 py-4 t3 text-[13px]">还没有守护的纪念馆。</p>`;
    box.onclick = (e) => {
      const b = e.target.closest("[data-mid]");
      if (!b) return;
      ctx.setId(b.dataset.mid);
      ctx.go("home");
    };

    // 守护统计：守护数 = 馆主+协作去重；天数自最早建馆起
    const guarded = list.filter((m) => ["created", "owner", "collaborating", "collaborator"].includes(m.relation));
    if (guarded.length) {
      const earliest = guarded.map((m) => new Date(String(m.last_at || m.lastActiveAt || "").replace(" ", "T") + "Z").getTime()).filter((t) => !isNaN(t)).sort()[0];
      const days = earliest ? Math.max(1, Math.floor((Date.now() - earliest) / 86400000)) : null;
      $("#me-sub").textContent = `已守护 ${guarded.length} 座纪念馆${days ? ` · ${days} 天` : ""}`;
    }

    // 订单流水
    const od = await A.getMeOrders();
    const orders = Array.isArray(od.data?.items) ? od.data.items : [];
    $("#me-orders-sub").textContent = orders.length ? `共 ${orders.length} 笔` : "暂无订单";
    $("#me-orders").onclick = () => ctx.go("orders");

    // 通知未读红点
    const nt = await A.getNotifications();
    if (nt.ok && nt.data?.unread > 0) $("#me-notif-dot").style.display = "block";
  },
};
