/* V2 想念页 */
window.BianViews = window.BianViews || {};
window.BianViews.miss = {
  tab: "hall",
  async init(root, ctx) {
    const A = window.BianApi, id = ctx.id || A.memorialId();
    const $ = (s) => root.querySelector(s);
    let msgType = "public";
    const ta = $("#miss-text"), count = $("#miss-count"), submit = $("#miss-submit");

    $("#v2-cta").onclick = () => {
      if (localStorage.getItem("bian_seen_intro")) ctx.go("chat");
      else ctx.openOverlay("intro");
    };

    root.querySelectorAll("#miss-types .chip").forEach((c) => {
      c.onclick = () => {
        root.querySelectorAll("#miss-types .chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        msgType = c.dataset.type;
      };
    });

    ta.oninput = () => {
      if (ta.value.length > 500) ta.value = ta.value.slice(0, 500);
      count.textContent = `${ta.value.length}/500`;
      const empty = !ta.value.trim();
      submit.disabled = empty;
      submit.style.opacity = empty ? ".5" : "1";
    };

    const TYPE_META = { public: ["fa-comment", "留言"], private: ["fa-lock", "悄悄话 · 仅自己可见"], eulogy: ["fa-book-open", "悼文 · 馆内置顶"] };
    async function renderList() {
      const r = await A.getMessages(id);
      const box = $("#miss-list");
      if (!r.ok || !Array.isArray(r.data?.items) || !r.data.items.length) {
        box.innerHTML = `<p class="t3 text-[13px] mt-3">还没有留下的话，说点什么吧。</p>`;
        return;
      }
      box.innerHTML = r.data.items
        .map((m) => {
          const [icon, label] = TYPE_META[m.msgType || m.msg_type] || TYPE_META.public;
          return `<div class="card mt-3 p-4">
            <div class="flex items-center gap-2 text-[11px] t3"><i class="fa-solid ${icon}"></i>${label} · ${A.relTime(m.createdAt || m.created_at)}</div>
            <p class="text-[14px] mt-2 leading-relaxed">“${m.content}”</p>
          </div>`;
        })
        .join("");
    }
    await renderList();

    submit.onclick = async () => {
      const content = ta.value.trim();
      if (!content) return;
      const r = await A.postMessage(msgType, content);
      if (r.ok) {
        ta.value = ""; ta.dispatchEvent(new Event("input"));
        A.toast("已留下");
        renderList();
      } else if (r.status === 401) A.toast("登录后才能留下你的话");
      else if (r.status === 422) A.toast("这个话题我们轻轻带过");
      else A.toast("没有提交成功，请再试一次");
    };
  },
};
