/* V-GARDEN 发现 · 公共墓园（R3：搜索 + 双列卡片流 + 访客态进馆） */
window.BianViews = window.BianViews || {};
window.BianViews.garden = {
  tab: "garden",
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    const grid = $("#garden-grid");
    const hint = $("#garden-hint");
    const qInput = $("#garden-q");

    const esc = (s) =>
      String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    const TYPE_ICON = { person: "fa-user", pet: "fa-paw", event: "fa-star" };

    function card(m) {
      const years = [m.birth_date, m.death_date].filter(Boolean).join(" — ");
      const avatar = m.avatar_url
        ? `<img src="${esc(m.avatar_url)}" alt="" class="w-12 h-12 rounded-full object-cover"/>`
        : `<span class="w-12 h-12 rounded-full flex items-center justify-center text-[18px] display"
             style="background:linear-gradient(135deg,rgba(255,122,47,.35),rgba(255,122,47,.12));color:var(--ember-soft)">${esc((m.name || "?").slice(0, 1))}</span>`;
      return `<button class="card p-4 flex flex-col items-center gap-2 text-center garden-card" data-id="${esc(m.id)}">
        ${avatar}
        <span class="text-[14px] font-medium leading-tight">${esc(m.name)}</span>
        ${years ? `<span class="t3 text-[11px]">${esc(years)}</span>` : ""}
        ${m.epitaph ? `<span class="t3 text-[11px] leading-snug" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(m.epitaph)}</span>` : ""}
      </button>`;
    }

    async function load() {
      const q = qInput.value.trim();
      const r = await A.get("/api/garden" + (q ? "?q=" + encodeURIComponent(q) : ""));
      if (!r.ok || !r.data) {
        grid.innerHTML = "";
        hint.style.display = "block";
        hint.textContent = "网络有点慢，稍后再试试";
        return;
      }
      const list = r.data.memorials || [];
      if (!list.length) {
        grid.innerHTML = "";
        hint.style.display = "block";
        hint.textContent = q ? "没有找到，换个名字试试" : "墓园还很安静";
        return;
      }
      hint.style.display = "none";
      grid.innerHTML = list.map(card).join("");
    }

    // 搜索防抖 300ms
    let timer = null;
    qInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    });

    // 点卡片 → 访客态进馆
    grid.addEventListener("click", (e) => {
      const c = e.target.closest(".garden-card");
      if (!c) return;
      ctx.setId(c.dataset.id);
      ctx.go("home");
    });

    await load();
  },
};
