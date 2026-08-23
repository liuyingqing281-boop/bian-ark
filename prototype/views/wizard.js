/* V-WIZARD 建馆向导（R1/R2：3 步——TA 是谁 → TA 的故事（5 分区选填）→ 确认生成）
 * 编排（docs/08 §3.12）：POST /api/memorials（含 appellation/avatarUrl）→ POST /api/memories × N（部分失败不阻断） */
window.BianViews = window.BianViews || {};
window.BianViews.wizard = {
  tab: null,
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    const $$ = (s) => Array.from(root.querySelectorAll(s));

    const state = {
      step: 1,
      avatarUrl: "",
      name: "", appellation: "", birth: "", death: "", type: "person",
      memories: [], // { section, content }
    };
    const SECTION_NAMES = { personality: "TA 是怎样的人", relation: "我和 TA", likes: "TA 喜欢什么", speech: "TA 怎么说话", profile: "基础资料" };

    /* ---------- 步骤切换 ---------- */
    function showStep(n) {
      state.step = n;
      ["#wz-step1", "#wz-step2", "#wz-step3"].forEach((s, i) => { $(s).style.display = i === n - 1 ? "" : "none"; });
      $$(".wz-dot").forEach((d, i) => { d.style.background = i < n ? "var(--ember-soft)" : "rgba(255,246,236,.15)"; });
    }

    /* ---------- 第 1 步 ---------- */
    $("#wz-avatar-btn").onclick = () => $("#wz-avatar-file").click();
    $("#wz-avatar-file").onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
      if (res.ok) {
        const d = await res.json();
        state.avatarUrl = d.thumbUrl || d.url || "";
        $("#wz-avatar-btn").innerHTML = `<img src="${state.avatarUrl}" alt="TA 的照片" class="w-full h-full object-cover rounded-full"/>`;
      } else A.toast("照片没有传上去，可稍后再补");
    };
    $$("#wz-types .chip").forEach((c) => {
      c.onclick = () => {
        $$("#wz-types .chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        state.type = c.dataset.type;
      };
    });
    $("#wz-next1").onclick = () => {
      state.name = $("#wz-name").value.trim();
      state.appellation = $("#wz-appellation").value.trim();
      state.birth = $("#wz-birth").value.trim();
      state.death = $("#wz-death").value.trim();
      if (!state.name) return A.toast("先告诉我 TA 的名字");
      showStep(2);
    };

    /* ---------- 第 2 步：分区快速录入 ---------- */
    $$(".wz-add").forEach((btn) => {
      btn.onclick = () => {
        const section = btn.dataset.section;
        const list = root.querySelector(`.card[data-section="${section}"] .wz-list`);
        const row = document.createElement("div");
        row.className = "flex items-start gap-2";
        row.innerHTML = `
          <textarea rows="2" maxlength="500" placeholder="写一条：${SECTION_NAMES[section]}…"
            class="flex-1 bg-transparent outline-none resize-none text-[14px] p-2"
            style="color:var(--text);border:1px solid var(--card-border);border-radius:10px"></textarea>
          <button class="t3 text-[12px] py-2" style="white-space:nowrap">移除</button>`;
        const ta = row.querySelector("textarea");
        row.querySelector("button").onclick = () => { row.remove(); sync(); };
        ta.addEventListener("input", sync);
        list.appendChild(row);
        ta.focus();
      };
    });
    function sync() {
      state.memories = $$(".card[data-section] .wz-list textarea")
        .map((ta) => ({ section: ta.closest(".card").dataset.section, content: ta.value.trim() }))
        .filter((m) => m.content);
    }
    $("#wz-back2").onclick = () => showStep(1);
    $("#wz-next2").onclick = () => { sync(); renderSummary(); showStep(3); };

    /* ---------- 第 3 步：确认 + 生成 ---------- */
    function renderSummary() {
      $("#wz-sum-name").textContent = (state.appellation ? state.appellation + " · " : "") + state.name;
      $("#wz-sum-years").textContent = [state.birth, state.death].filter(Boolean).join(" — ");
      $("#wz-sum-memories").textContent = state.memories.length ? `已写 ${state.memories.length} 段故事，会放进 TA 的记忆档案` : "还没有写故事，建馆后随时可以补充";
      if (state.avatarUrl) $("#wz-sum-avatar").src = state.avatarUrl;
    }
    $("#wz-back3").onclick = () => showStep(2);

    $("#wz-submit").onclick = async () => {
      const btn = $("#wz-submit");
      btn.disabled = true;
      btn.textContent = "生成中…";

      // 1) 建馆
      const r = await A.post(`/api/memorials`, {
        name: state.name,
        appellation: state.appellation,
        avatarUrl: state.avatarUrl,
        birthDate: state.birth,
        deathDate: state.death,
        type: state.type,
      });
      if (r.status === 401) {
        btn.disabled = false; btn.textContent = "生成纪念馆";
        A.toast("登录后才能建馆");
        return ctx.go("auth");
      }
      if (!r.ok || !r.data?.id) {
        btn.disabled = false; btn.textContent = "生成纪念馆";
        return A.toast("没有建成，请再试一次");
      }
      const id = r.data.id;

      // 2) 批量写记忆（部分失败不阻断）
      let saved = 0, failed = 0;
      for (const m of state.memories) {
        const mr = await A.post(`/api/memories`, { memorialId: id, section: m.section, content: m.content, source: "manual" });
        if (mr.ok) saved += 1; else failed += 1;
      }

      // 3) 进入新馆
      ctx.setId(id);
      A.toast(failed ? `纪念馆建好了 · ${saved} 条已保存，${failed} 条稍后可补` : "纪念馆建好了");
      ctx.go("home");
    };
  },
};
