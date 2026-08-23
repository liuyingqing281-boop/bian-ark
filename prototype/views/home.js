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
    $("#v1-goto-memory").onclick = () => ctx.go("memory");
    // ⋯ 菜单：创建新纪念馆（R1）+ 其余占位项
    $("#v1-more").onclick = () => {
      root.querySelector("#v1-menu")?.remove();
      const menu = document.createElement("div");
      menu.id = "v1-menu";
      menu.style.cssText = "position:absolute;top:56px;right:14px;z-index:35;min-width:172px;border-radius:16px;overflow:hidden;" +
        "background:#1c0d08;border:1px solid var(--card-border);box-shadow:0 16px 40px rgba(0,0,0,.55)";
      menu.innerHTML = [
        ["create", "＋ 创建新纪念馆"],
        ["share", "分享纪念馆"],
        ["edit", "编辑资料（馆主）"],
        ["collab", "协作管理（馆主）"],
        ["report", "举报"],
      ].map(([k, t]) => `<button data-k="${k}" class="w-full text-left text-[14px] px-5 py-3.5" style="color:var(--text);border-bottom:1px solid rgba(255,246,236,.06)">${t}</button>`).join("");
      menu.onclick = (e) => {
        const k = e.target.closest("button")?.dataset.k;
        menu.remove();
        if (k === "create") return ctx.go("wizard");
        if (k) A.toast(`「${e.target.textContent.trim()}」即将上线`);
      };
      root.appendChild(menu);
      setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 0);
    };

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
  },
};
