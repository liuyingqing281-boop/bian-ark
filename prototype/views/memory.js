/* V4 记忆页（W2：角色信息可编辑 + 记忆分区作为 AI 说话参考） */
window.BianViews = window.BianViews || {};
window.BianViews.memory = {
  tab: null,
  async init(root, ctx) {
    const A = window.BianApi, id = ctx.id || A.memorialId();
    const $ = (s) => root.querySelector(s);
    $("#mem-add").onclick = () => ctx.openOverlay("memadd", {});

    /* ---- 角色信息卡（W2）---- */
    let role = null;
    const esc0 = (s) => String(s == null ? "" : s);
    function paintRole() {
      if (!role) return;
      $("#mem-role-name").textContent = role.name + (role.appellation ? `（${role.appellation}）` : "");
      $("#mem-role-years").textContent = [role.birthDate, role.deathDate].filter(Boolean).join(" — ");
      $("#mem-role-epitaph").textContent = role.epitaph ? `“${role.epitaph}”` : "";
      $("#mem-role-bio").textContent = role.biography || "还没有写生平简介";
      if (role.avatarUrl) $("#mem-avatar").src = role.avatarUrl;
    }
    const mr = await A.getMemorial(id);
    if (mr.ok && mr.data) {
      role = mr.data;
      paintRole();
      if (role.viewerRole === "owner" || role.viewerRole === "collaborator") {
        $("#mem-edit").style.display = "block";
      }
    }
    $("#mem-edit").onclick = () => {
      if (!role) return;
      $("#me-f-name").value = esc0(role.name);
      $("#me-f-appellation").value = esc0(role.appellation);
      $("#me-f-birth").value = esc0(role.birthDate);
      $("#me-f-death").value = esc0(role.deathDate);
      $("#me-f-epitaph").value = esc0(role.epitaph);
      $("#me-f-bio").value = esc0(role.biography);
      $("#mem-role-view").style.display = "none";
      $("#mem-role-edit").style.display = "block";
    };
    $("#me-f-cancel").onclick = () => {
      $("#mem-role-edit").style.display = "none";
      $("#mem-role-view").style.display = "block";
    };
    $("#me-f-save").onclick = async () => {
      const btn = $("#me-f-save");
      btn.disabled = true;
      const r = await A.patch(`/api/memorials/${id}`, {
        name: $("#me-f-name").value.trim(),
        appellation: $("#me-f-appellation").value.trim(),
        birth_date: $("#me-f-birth").value.trim(),
        death_date: $("#me-f-death").value.trim(),
        epitaph: $("#me-f-epitaph").value.trim(),
        biography: $("#me-f-bio").value.trim(),
      });
      btn.disabled = false;
      if (r.ok) {
        A.toast("已保存");
        const fresh = await A.getMemorial(id);
        if (fresh.ok && fresh.data) { role = fresh.data; paintRole(); }
        $("#mem-role-edit").style.display = "none";
        $("#mem-role-view").style.display = "block";
      } else if (r.status === 403) A.toast("只有馆主和协作人可以编辑");
      else if (r.status === 400 && r.data?.error === "content_blocked") A.toast("内容未通过审核，请调整后再保存");
      else if (r.status === 400 && r.data?.error === "name_required") A.toast("姓名不能为空");
      else A.toast("保存失败，请再试一次");
    };

    /* ---- 记忆分区 ---- */
    const SECTIONS = [
      { key: "personality", icon: "fa-user", name: "TA 是怎样的人", hint: "还不知道怎么描述 TA？" },
      { key: "relation", icon: "fa-heart", name: "我和 TA", hint: "你们的故事值得被记住", star: true },
      { key: "likes", icon: "fa-mug-hot", name: "TA 喜欢什么", hint: "TA 平时喜欢做什么？" },
      { key: "speech", icon: "fa-quote-left", name: "TA 怎么说话", hint: "TA 常挂在嘴边的话是？" },
      { key: "chat", icon: "fa-comment-dots", name: "聊天中记起", hint: "聊天时提到的事会记在这里" },
      { key: "profile", icon: "fa-file-lines", name: "基础资料", hint: "引导填写 TA 的基础资料" },
    ];
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    async function render() {
      const r = await A.getMemories(id);
      if (!r.ok || !r.data) return;
      const d = r.data;
      $("#mem-total").textContent = d.total ?? 0;
      const entries = Array.isArray(d.entries)
        ? d.entries
        : Object.entries(d.sections || {}).flatMap(([section, arr]) => arr.map((content) => ({ id: "", section, content })));
      $("#mem-sections").innerHTML = SECTIONS.map((s) => {
        const list = entries.filter((e) => e.section === s.key);
        const body = list.length
          ? `<div class="card mt-2 divide-y divide-white/5">${list
              .map(
                (e) => `<p class="px-4 py-3.5 text-[14px] flex items-start gap-2">
                  <span class="flex-1">${esc(e.content)}</span>
                  ${e.id ? `<button class="t3 text-[11px] mem-del" data-id="${e.id}">删除</button>` : ""}
                </p>`
              )
              .join("")}</div>`
          : `<p class="t3 text-[13px] mt-2">${s.hint}</p>`;
        return `<section class="mt-6">
          <h2 class="text-[15px] flex items-center gap-2 ${s.star ? "display" : ""}" ${s.star ? 'style="color:var(--ember-soft)"' : ""}>
            <i class="fa-solid ${s.icon} text-[13px]" ${s.star ? "" : 'style="color:var(--ember-soft)"'}></i>${s.name}
            ${s.star ? '<span class="text-[10px] px-2 py-0.5 rounded-full" style="background:rgba(255,122,47,.14)">关系记忆</span>' : ""}
          </h2>${body}</section>`;
      }).join("");
    }
    await render();

    // 删除（二次确认；仅馆主/协作人可成功）
    $("#mem-sections").addEventListener("click", async (e) => {
      const btn = e.target.closest(".mem-del");
      if (!btn) return;
      if (!confirm("删除这条记忆？此操作不可恢复。")) return;
      const r = await A.deleteMemory(btn.dataset.id);
      if (r.ok) { A.toast("已删除"); render(); }
      else if (r.status === 403) A.toast("只有馆主和协作人可以删除记忆");
      else A.toast("没有删除成功，请再试一次");
    });

    // F3 抽屉保存成功后刷新（若本视图还在栈顶）
    this._onSaved = () => { if (ctx && window.BianRouter.current() === "memory") render(); };
    document.addEventListener("bian:memory-saved", this._onSaved);
  },
};
