/* V-NOTIF 通知（R5）：列表 + 全部已读 */
window.BianViews = window.BianViews || {};
window.BianViews.notifications = {
  tab: null,
  async init(root) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const KIND = { review: "审核", collab: "协作", system: "系统" };

    async function render() {
      const r = await A.getNotifications();
      const box = $("#notif-list");
      if (!r.ok) {
        box.innerHTML = `<p class="px-5 py-4 t3 text-[13px]">登录后可见通知。</p>`;
        return;
      }
      const items = Array.isArray(r.data?.items) ? r.data.items : [];
      box.innerHTML = items.length
        ? items.map((n) => `<div class="flex items-start gap-3 px-5 py-4">
            <span class="w-2 h-2 rounded-full mt-2 shrink-0" style="background:${n.read ? "transparent" : "var(--ember-soft)"}"></span>
            <div class="flex-1 min-w-0">
              <p class="text-[14px] leading-snug ${n.read ? "t3" : ""}">${esc(n.title)}</p>
              ${n.body ? `<p class="t3 text-[12px] mt-1">${esc(n.body)}</p>` : ""}
              <p class="t3 text-[11px] mt-1">${KIND[n.kind] || "系统"} · ${esc(A.relTime(n.createdAt))}</p>
            </div>
          </div>`).join("")
        : `<p class="px-5 py-4 t3 text-[13px]">还没有通知。</p>`;
    }
    await render();

    $("#notif-read-all").onclick = async () => {
      const r = await A.markNotificationsRead([]);
      if (r.ok) { A.toast("全部已读"); render(); }
    };
  },
};
