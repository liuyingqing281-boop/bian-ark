/* V1 纪念馆首页 */
window.BianViews = window.BianViews || {};
window.BianViews.home = {
  tab: "hall",
  async init(root, ctx) {
    const A = window.BianApi, id = ctx.id || A.memorialId();
    const $ = (s) => root.querySelector(s);

    // 主 CTA：首次 → F1 身份说明；再次 → 对话页
    $("#cta-chat").onclick = () => {
      if (localStorage.getItem("bian_seen_intro")) ctx.go("chat");
      else ctx.openOverlay("intro");
    };
    $("#tab-memory").onclick = () => $("#sec-memory").scrollIntoView({ behavior: "smooth" });
    $("#tab-miss").onclick = () => ctx.go("miss");
    $("#tab-offer").onclick = () => ctx.go("offering");
    $("#v1-goto-offer").onclick = () => ctx.go("offering");
    $("#v1-goto-memory").onclick = () => ctx.go("memory");
    $("#v1-more").onclick = () => A.toast("分享纪念馆 / 编辑资料 / 协作管理（馆主）· 举报（访客）");

    // F1 纪念馆资料
    const m = await A.getMemorial(id);
    if (m.ok && m.data) {
      const d = m.data;
      if (d.name) $("#m-name").textContent = d.name;
      const years = [d.birthDate || d.birth_date, d.deathDate || d.death_date].filter(Boolean).join(" — ");
      if (years) $("#m-years").textContent = years;
      if (d.epitaph) $("#m-epitaph").textContent = `“${d.epitaph}”`;
      if (d.appellation) $("#cta-chat").innerHTML = `<i class="fa-solid fa-comment-dots"></i>和 ${d.appellation} 说说话`;
      if (d.candleLit || d.candle_lit) {
        $("#candle-line").style.display = "flex";
        if (d.candleLitHours) $("#candle-text").textContent = `你点的灯还亮着 · 已持续 ${d.candleLitHours} 小时`;
      }
      const avatar = d.avatarUrl || d.avatar_url;
      if (avatar) $("#v1-avatar").src = avatar;
    }

    // F2 生平时间线
    const tl = await A.getTimeline(id);
    if (tl.ok && Array.isArray(tl.data?.items) && tl.data.items.length) {
      $("#timeline-list").innerHTML = tl.data.items
        .map((t) => `<div class="flex items-baseline gap-4"><span class="display w-12 text-[15px]" style="color:var(--ember-soft)">${t.year}</span><span class="text-[15px]">${t.title}</span></div>`)
        .join("");
    }

    // F3 混合纪念流
    async function renderFeed() {
      const f = await A.getFeed(id);
      if (!f.ok || !Array.isArray(f.data?.items)) return;
      const list = f.data.items.slice(0, 5);
      $("#feed-list").innerHTML = list.length
        ? list.map((it) => `
          <div class="flex items-center gap-3 px-4 py-3.5">
            <span class="w-9 h-9 rounded-full flex items-center justify-center text-sm" style="background:rgba(255,122,47,.14)">${it.icon}</span>
            <span class="flex-1 text-[14px]">${it.label} · ${it.isMine ? "我" : it.senderMasked}</span>
            <span class="t3 text-xs">${A.relTime(it.createdAt)}</span>
          </div>`).join("")
        : `<p class="px-4 py-6 text-center t3 text-[13px]">成为第一个纪念 TA 的人</p>`;
    }
    await renderFeed();

    // F6 免费三项：真实供奉 → 刷新纪念流
    const itemsRes = await A.getItems(id);
    const items = Array.isArray(itemsRes.data?.items) ? itemsRes.data.items : [];
    const free = items.filter((x) => !(x.priceCents ?? x.price_cents)).slice(0, 3);
    const names = ["献花", "点灯", "清香"];
    root.querySelectorAll("#offer-grid > button").forEach((btn) => {
      btn.onclick = async () => {
        const i = Number(btn.dataset.i);
        const item = free[i];
        if (!item) return A.toast("祭品目录加载中，请稍后再试");
        const r = await A.tribute(item.id);
        if (r.ok) {
          A.toast(`已为 TA ${item.name || names[i]}`);
          if ((item.name || names[i]).includes("灯")) $("#candle-line").style.display = "flex";
          renderFeed();
        } else if (r.status === 401) A.toast("登录后才能供奉，请先到「我的」登录");
        else A.toast("没有供奉成功，请再试一次");
      };
    });
  },
};
