/* V-HALL 长明灯阵（docs/13：场景层 + 抽屉层 + 馆级公共层）
 * - 灯位 = 关系表达；馆主可进「布阵模式」拖拽摆位（持久化 PATCH layout）
 * - 点灯聚焦 → 抽屉切人物详情（供奉/留言）；不聚焦 = 馆级默认抽屉（群像 + 合祭 + 留言墙）
 * - URL ?p=[人物id] 同步聚焦对象；reduced-motion 下降级为瞬时切换
 */
window.BianViews = window.BianViews || {};
window.BianViews.hall = {
  tab: "hall",
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    // hall_id 以 memorials 为准（合馆后多人物共享一馆）；园级星海进入时直接带 hallId
    let hallId = ctx.params?.hallId || "";
    if (!hallId) {
      const mm = await A.getMemorial(ctx.id || A.memorialId());
      hallId = (mm.ok && mm.data?.hallId) || "hall_" + (ctx.id || A.memorialId());
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const r = await A.get(`/api/halls/${hallId}`);
    if (!r.ok || !r.data) {
      $("#hall-drawer").innerHTML = `<p class="t3 text-[13px] text-center pt-10">这座馆还没有灯阵</p>`;
      return;
    }
    const { hall, members, isOwner } = r.data;
    $("#hall-name").textContent = hall.name || "纪念馆";
    $("#hall-motto").textContent = hall.motto || "";

    let focused = new URLSearchParams(location.search).get("p") || (members.length === 1 ? members[0].id : null);
    let arranging = false;

    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    /* ---------- 场景层：灯位 ---------- */
    // 无持久化坐标时按入馆顺序环形散布（docs/13 §3.1 兜底）
    function defaultPos(i, n) {
      if (n === 1) return { x: 50, y: 46 };
      if (n === 2) return { x: 38 + i * 24, y: 50 }; // 合祀双灯相邻居中
      const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
      return { x: 50 + 30 * Math.cos(angle), y: 50 + 26 * Math.sin(angle) };
    }
    const scene = $("#hall-scene");

    function paintScene() {
      scene.querySelectorAll(".hall-lamp").forEach((el) => el.remove());
      members.forEach((m, i) => {
        const pos = m.lampX != null && m.lampY != null ? { x: m.lampX, y: m.lampY } : defaultPos(i, members.length);
        m._x = pos.x; m._y = pos.y;
        const el = document.createElement("button");
        el.className = "hall-lamp absolute flex flex-col items-center gap-1";
        el.style.cssText = `left:${pos.x}%;top:${pos.y}%;transform:translate(-50%,-50%);transition:${reduced ? "none" : "left .5s ease,top .5s ease"};z-index:${focused === m.id ? 12 : 10}`;
        el.dataset.mid = m.id;
        el.innerHTML = `
          <span class="flame" style="width:${focused === m.id ? 16 : 12}px;height:${focused === m.id ? 24 : 18}px;
            ${m.candleLit ? "" : "opacity:.45;filter:grayscale(.4)"}"></span>
          <span class="text-[11px] ${focused === m.id ? "" : "t3"}" style="${focused === m.id ? "color:var(--ember-soft)" : ""}">${esc(m.name)}</span>`;
        scene.appendChild(el);
      });
    }
    paintScene();

    /* ---------- 聚焦 / 抽屉 ---------- */
    function syncUrl() {
      const url = new URL(location.href);
      if (focused) url.searchParams.set("p", focused);
      else url.searchParams.delete("p");
      history.replaceState(null, "", url);
    }

    function personDrawer(m) {
      return `
        <div class="pad pt-2 pb-1 flex gap-2 overflow-x-auto" style="scrollbar-width:none">
          ${members.map((x) => `<button class="chip text-[11px] hall-switch ${x.id === m.id ? "active" : ""}" data-mid="${x.id}">${esc(x.name)}</button>`).join("")}
        </div>
        <div class="scroll pad pt-2 pb-6 flex-1">
          <div class="card p-5 flex items-center gap-4">
            ${m.avatarUrl ? `<img src="${esc(m.avatarUrl)}" class="w-14 h-14 rounded-full object-cover" alt=""/>`
              : `<span class="w-14 h-14 rounded-full flex items-center justify-center display text-xl" style="background:linear-gradient(135deg,rgba(255,122,47,.35),rgba(255,122,47,.12));color:var(--ember-soft)">${esc(m.name.slice(0, 1))}</span>`}
            <div class="flex-1 min-w-0">
              <p class="display text-lg tracking-wider">${esc(m.name)}${m.appellation ? `（${esc(m.appellation)}）` : ""}</p>
              <p class="t3 text-[12px] mt-0.5">${esc([m.birthDate, m.deathDate].filter(Boolean).join(" — "))}</p>
              ${m.epitaph ? `<p class="t2 text-[12px] mt-1">“${esc(m.epitaph)}”</p>` : ""}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 mt-4">
            <button class="btn-primary" style="height:52px" id="hall-offer"><i class="fa-solid fa-fire"></i>供奉</button>
            <button class="btn-ghost" id="hall-open">查看完整生平</button>
          </div>
          <button class="t3 text-[12px] mt-4 w-full text-center" id="hall-unfocus">返回全馆</button>
        </div>`;
    }

    async function hallDrawer() {
      const list = await A.get(`/api/halls/${hallId}/messages`);
      const msgs = list.ok && Array.isArray(list.data?.items) ? list.data.items : [];
      return `
        <div class="scroll pad pt-3 pb-6 flex-1">
          <h2 class="t3 text-[11px] tracking-[0.2em] mb-2">群像</h2>
          <div class="card divide-y divide-white/5">
            ${members.map((m) => `<button class="w-full flex items-center gap-3 px-4 py-3 hall-focus-btn" data-mid="${m.id}">
              <span class="flame" style="width:8px;height:12px;${m.candleLit ? "" : "opacity:.45"}"></span>
              <span class="flex-1 text-left text-[14px]">${esc(m.name)}</span>
              <span class="t3 text-[11px]">${esc([m.birthDate, m.deathDate].filter(Boolean).join(" — "))}</span>
            </button>`).join("")}
          </div>
          <button class="btn-primary mt-4" id="hall-offer-all"><i class="fa-solid fa-fire"></i>为全家点灯</button>
          ${isOwner && !hall.inGarden ? `<button class="btn-ghost mt-3 w-full" id="hall-place"><i class="fa-solid fa-star"></i>择位入园（在星海中为家选个位置）</button>` : ""}
          <h2 class="t3 text-[11px] tracking-[0.2em] mt-6 mb-2">全馆留言墙</h2>
          <div class="card divide-y divide-white/5">
            ${msgs.length ? msgs.map((g) => `<p class="px-4 py-3 text-[13px]"><span class="t3">致 ${esc(g.memorialName)}：</span>${esc(g.content)}</p>`).join("")
              : `<p class="px-4 py-4 t3 text-[13px]">还没有留言</p>`}
          </div>
        </div>`;
    }

    async function paintDrawer() {
      const m = members.find((x) => x.id === focused);
      const box = $("#hall-drawer");
      box.innerHTML = m ? personDrawer(m) : await hallDrawer();
      paintScene();
      syncUrl();

      if (m) {
        box.querySelectorAll(".hall-switch").forEach((b) => (b.onclick = () => { focused = b.dataset.mid; paintDrawer(); }));
        box.querySelector("#hall-unfocus").onclick = () => { focused = null; paintDrawer(); };
        box.querySelector("#hall-offer").onclick = async () => {
          const rr = await A.post("/api/tribute", { memorialId: m.id, itemId: "candle" });
          if (rr.ok) { A.toast(`已为 ${m.name} 点灯`); m.candleLit = true; paintScene(); }
          else if (rr.status === 401) A.toast("登录后才能供奉，请先到「我的」登录");
          else A.toast("没有供奉成功，请再试一次");
        };
        box.querySelector("#hall-open").onclick = () => { ctx.setId(m.id); ctx.go("home"); };
      } else {
        box.querySelectorAll(".hall-focus-btn").forEach((b) => (b.onclick = () => { focused = b.dataset.mid; paintDrawer(); }));
        box.querySelector("#hall-place")?.addEventListener("click", () => ctx.go("starsea", { placing: hallId }));
        box.querySelector("#hall-offer-all").onclick = async () => {
          const rr = await A.post(`/api/halls/${hallId}/offer-all`, {});
          if (rr.ok) {
            A.toast(`已为全家 ${rr.data?.count ?? members.length} 位点亮了灯`);
            members.forEach((x) => (x.candleLit = true));
            paintScene();
          } else if (rr.status === 401) A.toast("登录后才能合祭，请先到「我的」登录");
          else A.toast("没有点上，请再试一次");
        };
      }
    }
    await paintDrawer();

    /* ---------- 场景交互：点灯聚焦 / 布阵拖拽 ---------- */
    scene.addEventListener("click", (e) => {
      const lamp = e.target.closest(".hall-lamp");
      if (!lamp || arranging) return;
      focused = focused === lamp.dataset.mid ? null : lamp.dataset.mid;
      paintDrawer();
    });

    if (isOwner) {
      const btn = $("#hall-arrange");
      btn.style.display = "block";
      btn.onclick = () => {
        arranging = !arranging;
        $("#hall-arrange-hint").style.display = arranging ? "block" : "none";
        btn.style.color = arranging ? "var(--ember-soft)" : "";
        A.toast(arranging ? "布阵模式：拖动灯位" : "已退出布阵模式");
      };
      // 拖拽（pointer 事件，移动端兼容）；松手保存
      let dragEl = null, dragM = null;
      scene.addEventListener("pointerdown", (e) => {
        if (!arranging) return;
        const lamp = e.target.closest(".hall-lamp");
        if (!lamp) return;
        dragEl = lamp;
        dragM = members.find((x) => x.id === lamp.dataset.mid);
        lamp.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      scene.addEventListener("pointermove", (e) => {
        if (!dragEl || !dragM) return;
        const rect = scene.getBoundingClientRect();
        dragM._x = Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100));
        dragM._y = Math.min(88, Math.max(8, ((e.clientY - rect.top) / rect.height) * 100));
        dragEl.style.left = dragM._x + "%";
        dragEl.style.top = dragM._y + "%";
      });
      scene.addEventListener("pointerup", async () => {
        if (!dragEl || !dragM) return;
        dragEl = null;
        const rr = await A.patch(`/api/halls/${hallId}/layout`, {
          positions: [{ memorialId: dragM.id, x: Math.round(dragM._x * 10) / 10, y: Math.round(dragM._y * 10) / 10 }],
        });
        if (rr.ok) { dragM.lampX = dragM._x; dragM.lampY = dragM._y; A.toast("灯位已保存"); }
        else A.toast("保存失败，请再试一次");
        dragM = null;
      });
    }
  },
};
