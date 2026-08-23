/* V-GROUPS 亲友共同纪念（R5）：我的协作组列表 + 邀请码 + 加入/创建 */
window.BianViews = window.BianViews || {};
window.BianViews.groups = {
  tab: null,
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    async function render() {
      const r = await A.getMe();
      const box = $("#groups-list");
      if (!r.ok) {
        box.innerHTML = `<p class="px-5 py-4 t3 text-[13px]">登录后可见协作组。</p>`;
        return;
      }
      const groups = Array.isArray(r.data?.groups) ? r.data.groups : [];
      box.innerHTML = groups.length
        ? groups.map((g) => `<div class="flex items-center gap-3 px-5 py-4">
            <i class="fa-solid fa-user-group" style="color:var(--ember-soft)"></i>
            <div class="flex-1 min-w-0">
              <p class="text-[14px] truncate">${esc(g.name)}</p>
              <p class="t3 text-[11px] mt-0.5">${g.member_count} 位成员${g.role === "owner" ? " · 我是组长" : ""}</p>
            </div>
            ${g.role === "owner" ? `<button class="t3 text-[11px] chip group-invite" data-code="${esc(g.invite_code)}">邀请码 ${esc(g.invite_code)}</button>` : `<button class="t3 text-[11px] chip group-leave" data-id="${esc(g.id)}">退出</button>`}
          </div>`).join("")
        : `<p class="px-5 py-4 t3 text-[13px]">还没有协作组。创建一个，或输入亲友的邀请码加入。</p>`;
    }
    await render();

    $("#groups-list").addEventListener("click", async (e) => {
      const inv = e.target.closest(".group-invite");
      if (inv) {
        try {
          await navigator.clipboard.writeText(inv.dataset.code);
          A.toast("邀请码已复制，发给亲友吧");
        } catch {
          A.toast("邀请码：" + inv.dataset.code);
        }
        return;
      }
      const lv = e.target.closest(".group-leave");
      if (lv && confirm("退出这个协作组？")) {
        const r = await A.leaveGroup(lv.dataset.id);
        if (r.ok) { A.toast("已退出"); render(); }
        else A.toast("退出失败，请再试一次");
      }
    });

    $("#groups-join-btn").onclick = async () => {
      const code = $("#groups-join-code").value.trim();
      if (!code) return A.toast("请先输入邀请码");
      const r = await A.joinGroup(code);
      if (r.ok) { A.toast(`已加入「${r.data?.name || "协作组"}」`); $("#groups-join-code").value = ""; render(); }
      else if (r.status === 404) A.toast("邀请码不对，再核对一下");
      else if (r.status === 401) ctx.go("auth");
      else A.toast("加入失败，请再试一次");
    };

    $("#groups-create-btn").onclick = async () => {
      const name = $("#groups-create-name").value.trim();
      if (!name) return A.toast("先给协作组起个名字");
      const r = await A.createGroup(name);
      if (r.ok) { A.toast(`已创建，邀请码 ${r.data?.invite_code}`); $("#groups-create-name").value = ""; render(); }
      else if (r.status === 401) ctx.go("auth");
      else A.toast("创建失败，请再试一次");
    };
  },
};
