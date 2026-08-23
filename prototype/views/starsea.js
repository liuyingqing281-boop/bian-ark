/* V-STARSEA 纪念园·星海（墓园规格 §8 / 08 §3.13）
 * - GET /api/garden/starsea 分片拉取；星=馆（单人馆孤星，多人馆小星群）
 * - 点星 → 底部聚焦卡 → 进馆（灯阵视图）；馆主可从灯阵来「择位」（placing 模式点空位）
 * - 红线：无访问量/热度/排行；明灭仅表达「24h 内有人来看过」
 */
window.BianViews = window.BianViews || {};
window.BianViews.starsea = {
  tab: "garden",
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    const scene = $("#sea-scene");
    const placingHallId = ctx.params?.placing || null;
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    if (placingHallId) $("#sea-hint").textContent = "为你的馆选一个位置：点一处空旷的夜空";

    const r = await A.get("/api/garden/starsea");
    const halls = r.ok && Array.isArray(r.data?.halls) ? r.data.halls : [];

    if (!halls.length && !placingHallId) {
      $("#sea-hint").textContent = "星海还很安静——成为第一颗亮起的星";
    }

    halls.forEach((h) => {
      const star = document.createElement("button");
      star.className = "sea-star absolute";
      const size = h.lampCount > 1 ? 18 : 12;
      star.style.cssText = `left:${h.x * 100}%;top:${h.y * 100}%;transform:translate(-50%,-50%);
        width:${size * 2}px;height:${size * 2}px;z-index:10`;
      const glow = h.candleLit ? "rgba(255,179,92,.95)" : "rgba(255,214,170,.45)";
      star.innerHTML = `
        <span class="block rounded-full mx-auto" style="width:${size}px;height:${size}px;
          background:radial-gradient(circle, #fff6ec 0%, ${glow} 45%, transparent 75%);
          box-shadow:0 0 ${h.candleLit ? 22 : 10}px ${glow}"></span>
        <span class="block text-[10px] mt-1 whitespace-nowrap" style="color:rgba(255,246,236,.6)">${esc(h.nameMasked)}</span>`;
      star.onclick = () => {
        if (placingHallId) return; // 择位模式下点星无效
        const box = $("#sea-focus");
        box.style.display = "block";
        box.innerHTML = `
          <div class="card p-4 flex items-center gap-3" style="backdrop-filter:blur(12px)">
            <span class="w-3 h-3 rounded-full shrink-0" style="background:${glow};box-shadow:0 0 12px ${glow}"></span>
            <div class="flex-1 min-w-0">
              <p class="text-[14px]">${esc(h.nameMasked)}${h.lampCount > 1 ? ` <span class="t3 text-[11px]">· ${h.lampCount} 位家人</span>` : ""}</p>
              <p class="t3 text-[11px] mt-0.5">${esc([h.birthDate, h.deathDate].filter(Boolean).join(" — "))}${h.epitaph ? ` · “${esc(h.epitaph).slice(0, 20)}”` : ""}</p>
            </div>
            <button class="btn-primary" style="height:38px;width:auto;padding:0 16px;font-size:13px" id="sea-enter">进馆</button>
          </div>`;
        box.querySelector("#sea-enter").onclick = () => ctx.go("hall", { hallId: h.hallId });
      };
      scene.appendChild(star);
    });

    // 择位模式：点空位 → PATCH garden-pos；409 冲突 → 吸附建议位
    if (placingHallId) {
      scene.addEventListener("click", async (e) => {
        if (e.target.closest(".sea-star") || e.target.closest("#sea-focus")) return;
        const rect = scene.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 1000;
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 1000;
        const rr = await A.patch(`/api/halls/${placingHallId}/garden-pos`, { x, y });
        if (rr.ok) {
          A.toast("择位成功，你的馆已在星海中亮起");
          ctx.go("hall", { hallId: placingHallId });
        } else if (rr.status === 409 && rr.data?.suggested) {
          A.toast("这里太靠近别的馆了，已为你选了旁边的位置");
          const s = rr.data.suggested;
          const again = await A.patch(`/api/halls/${placingHallId}/garden-pos`, { x: s.x, y: s.y });
          if (again.ok) ctx.go("hall", { hallId: placingHallId });
        } else if (rr.status === 403) A.toast("纪念馆需设为公开才能入园");
        else A.toast("择位失败，请再试一次");
      });
    }
  },
};
