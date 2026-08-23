/* V-SETTINGS 设置（R5）：通知/隐私开关 + 退出登录 + 删除纪念馆（软二次确认） */
window.BianViews = window.BianViews || {};
window.BianViews.settings = {
  tab: null,
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);

    // 开关初始值
    const s = await A.getSettings();
    if (s.ok && s.data) {
      $("#set-notify-review").checked = s.data.notifyReview !== false;
      $("#set-notify-collab").checked = s.data.notifyCollab !== false;
      $("#set-private-default").checked = s.data.privateDefault === true;
      $("#set-chat-memory").checked = s.data.chatMemory !== false;
    }
    const bind = (sel, key) => {
      $(sel).addEventListener("change", async (e) => {
        const r = await A.patchSettings({ [key]: e.target.checked });
        A.toast(r.ok ? "已保存" : "保存失败，请再试一次");
      });
    };
    bind("#set-notify-review", "notifyReview");
    bind("#set-notify-collab", "notifyCollab");
    bind("#set-private-default", "privateDefault");
    bind("#set-chat-memory", "chatMemory");

    // 当前馆信息 + 删除（仅馆主可见可点）
    const id = ctx.id || A.memorialId();
    const m = await A.getMemorial(id);
    const nameEl = $("#set-memorial-name");
    const delBtn = $("#set-del-memorial");
    if (m.ok && m.data) {
      nameEl.textContent = `${m.data.name}的纪念馆`;
      if (m.data.viewerRole !== "owner") {
        delBtn.disabled = true;
        delBtn.style.opacity = ".45";
        nameEl.textContent += "（仅馆主可删除）";
      }
    } else {
      nameEl.textContent = "未选择纪念馆";
      delBtn.disabled = true;
      delBtn.style.opacity = ".45";
    }
    delBtn.onclick = async () => {
      if (!confirm("删除后纪念馆将不再对外展示，确定删除？")) return;
      if (!confirm("再次确认：这座纪念馆的内容将无法在馆内访问。")) return;
      const r = await A.deleteMemorial(id);
      if (r.ok) {
        A.toast("已删除");
        ctx.setId("");
        ctx.go("empty");
      } else if (r.status === 403) A.toast("只有馆主可以删除");
      else A.toast("删除失败，请再试一次");
    };

    // 退出登录
    $("#set-logout").onclick = async () => {
      const r = await A.logout();
      if (r.ok || r.status === 204) {
        A.toast("已退出登录");
        ctx.go("auth");
      } else A.toast("退出失败，请再试一次");
    };
  },
};
