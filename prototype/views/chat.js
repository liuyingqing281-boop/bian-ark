/* V3 对话页（keep-alive：离开不销毁，返回保留滚动） */
window.BianViews = window.BianViews || {};
window.BianViews.chat = {
  tab: null,
  keepAlive: true,
  async init(root, ctx) {
    if (root.dataset.ready) return; // keep-alive：只初始化一次
    root.dataset.ready = "1";

    const A = window.BianApi, id = ctx.id || A.memorialId();
    const $ = (s) => root.querySelector(s);
    const msgs = $("#chat-msgs"), typing = $("#chat-typing"), chips = $("#chat-chips");
    const input = $("#chat-input"), sendBtn = $("#chat-send"), scrollBox = $("#chat-scroll");

    // 顶栏标题：和 + 称谓 + 说说话
    const m = await A.getMemorial(id);
    const appellation = (m.ok && m.data?.appellation) || "TA";
    $("#chat-title").textContent = `和${appellation}说说话`;
    const isGuest = !m.ok || (m.data?.viewerRole || "guest") === "guest";

    /* ---- W3 双模式切换（每馆记住；新馆默认第三方；模仿仅登录用户）---- */
    const MODE_KEY = "bian_chat_mode_" + id;
    const RP_OK_KEY = "bian_roleplay_ok_" + id;
    let mode = localStorage.getItem(MODE_KEY) === "roleplay" && !isGuest ? "roleplay" : "companion";

    function paintMode() {
      root.querySelectorAll("#chat-mode-bar button").forEach((b) => {
        const on = b.dataset.mode === mode;
        b.style.background = on ? "rgba(255,122,47,.18)" : "transparent";
        b.style.color = on ? "var(--ember-soft)" : "rgba(255,246,236,.55)";
      });
      $("#chat-mode-note").style.display = mode === "roleplay" ? "block" : "none";
    }
    function applyMode(next) {
      mode = next;
      localStorage.setItem(MODE_KEY, next);
      paintMode();
      if (next === "roleplay") A.toast("已切换到模仿模式：" + `现在起 AI 会以${appellation}的语气回应`);
    }
    $("#mode-companion").onclick = () => mode !== "companion" && applyMode("companion");
    $("#mode-roleplay").onclick = () => {
      if (mode === "roleplay") return;
      if (isGuest) return A.toast("登录后才能用模仿模式，请先到「我的」登录");
      if (localStorage.getItem(RP_OK_KEY)) return applyMode("roleplay");
      // 首次：边界确认浮层
      const onOk = () => {
        document.removeEventListener("bian:roleplay-confirmed", onOk);
        localStorage.setItem(RP_OK_KEY, "1");
        applyMode("roleplay");
      };
      document.addEventListener("bian:roleplay-confirmed", onOk);
      ctx.openOverlay("roleplay", {});
    };
    paintMode();

    // ⋯ 菜单：清空对话（二次确认）
    $("#chat-more").onclick = async () => {
      if (!confirm("清空这段对话记录？")) return;
      const r = await A.clearChatHistory();
      if (r.ok) { msgs.innerHTML = ""; chips.style.display = "flex"; A.toast("已清空"); }
      else if (r.status === 401) A.toast("登录后才能清空对话");
      else A.toast("没有清空成功，请再试一次");
    };

    const scrollEnd = () => { scrollBox.scrollTop = scrollBox.scrollHeight; };
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    function addMe(text) {
      msgs.insertAdjacentHTML("beforeend", `<div class="bubble-me mb-4">${esc(text)}</div>`);
      scrollEnd();
    }
    function addTa(text, evidence, inferred, askMemory, followup, msgMode) {
      const ev = evidence
        ? `<button class="text-[12px] mt-1.5 underline underline-offset-4 ev-link" style="color:var(--ember-soft)"
             data-quote="${esc(evidence.quote)}" data-date="${esc(A.fmtDate(evidence.createdAt || evidence.created_at))}">查看这句话的依据</button>` : "";
      const tag = msgMode === "roleplay"
        ? `<p class="tag-inferred mt-1">AI 模仿 · 非本人</p>`
        : inferred ? `<p class="tag-inferred mt-1">基于 TA 的资料推测</p>` : "";
      const ask = askMemory
        ? `${followup ? `<p class="text-[13px] t2 mt-2">${esc(followup)}</p>` : ""}
           <button class="chip mt-2 ask-memory">添加一段关于 TA 的记忆</button>` : "";
      msgs.insertAdjacentHTML("beforeend", `
        <div class="flex gap-2 mb-4">
          <img src="assets/portrait.png" class="w-7 h-7 rounded-full object-cover shrink-0 mt-1" alt="TA"/>
          <div><div class="bubble-ta">${esc(text)}</div>${ev}${tag}${ask}</div>
        </div>`);
      scrollEnd();
    }

    // 依据链接 → F4 浮层；补充记忆 → F3 浮层（source=chat）
    msgs.addEventListener("click", (e) => {
      const ev = e.target.closest(".ev-link");
      if (ev) return ctx.openOverlay("evidence", { quote: ev.dataset.quote, date: ev.dataset.date });
      if (e.target.closest(".ask-memory")) ctx.openOverlay("memadd", { source: "chat" });
    });

    // 历史恢复（登录用户）
    const h = await A.getChatHistory();
    if (h.ok && Array.isArray(h.data?.items) && h.data.items.length) {
      chips.style.display = "none";
      for (const it of h.data.items) {
        if (it.role === "user") addMe(it.content);
        else addTa(it.content, null, true, false, null);
      }
    }

    let busy = false;
    async function send(text) {
      const content = String(text || "").trim().slice(0, 500);
      if (!content || busy) return;
      busy = true;
      chips.style.display = "none";
      addMe(content);
      input.value = "";
      typing.style.display = "block";
      scrollEnd();
      const r = await A.chat(content, mode);
      typing.style.display = "none";
      if (r.ok && r.data) {
        addTa(r.data.text, r.data.evidence || null, r.data.inferred !== false, r.data.askMemory, r.data.followupQuestion, r.data.mode || mode);
      } else if (r.status === 401 && r.data?.error === "roleplay_requires_login") {
        applyMode("companion");
        A.toast("登录后才能用模仿模式，已切回 AI 助手");
      } else if (r.status === 422) {
        addTa("这个话题我们轻轻带过。", null, false, false, null);
      } else {
        addTa("刚才没说上话，再试一次。", null, false, false, null);
      }
      busy = false;
    }
    sendBtn.onclick = () => send(input.value);
    input.onkeydown = (e) => { if (e.key === "Enter") send(input.value); };
    chips.addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (c) send(c.textContent.replace(/[“”]/g, ""));
    });
    $("#chat-voice").onclick = () => A.toast("语音功能正在准备中");
  },
};
