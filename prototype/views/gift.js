/* V6 礼物页（R6：AI 生成祭品三步真实链路）
 * 1 心意：心愿输入 + 「帮我写」POST /api/items/prompt（火山方舟 LLM 扩写，每日 10 次）
 * 2 礼物：POST /api/items/generate（火山 seedream 生图 ×4，幂等键防重复扣额度，每月免费 3 次）
 * 3 完成：POST /api/items/claim 收藏（review_status=pending，审核通过后上供桌）
 */
window.BianViews = window.BianViews || {};
window.BianViews.gift = {
  tab: null,
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    let selected = null;
    let idemKey = "";

    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const newKey = () => "gift-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

    function gotoStep(n) {
      [1, 2, 3].forEach((i) => ($("#gift-step" + i).style.display = i === n ? "block" : "none"));
      root.querySelectorAll("#gift-steps .chip").forEach((c) => {
        const on = Number(c.dataset.step) <= n;
        c.classList.toggle("active", on);
        c.style.color = on ? "" : "rgba(255,246,236,.45)";
      });
    }

    $("#gift-idea").addEventListener("input", () => {
      $("#gift-idea-count").textContent = $("#gift-idea").value.length;
    });

    /* 帮我写：AI 扩写心意 → 生图描述 */
    $("#gift-polish").onclick = async () => {
      const idea = $("#gift-idea").value.trim();
      if (idea.length < 2) return A.toast("先写一句心愿，哪怕两个字");
      const btn = $("#gift-polish");
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>正在扩写……';
      const r = await A.post("/api/items/prompt", { idea });
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1" style="color:var(--ember-soft)"></i>帮我写';
      if (r.ok && r.data?.prompt) {
        $("#gift-prompt-card").style.display = "block";
        $("#gift-prompt").value = r.data.prompt;
      } else if (r.status === 401) A.toast("登录后才能用「帮我写」，请先到「我的」登录");
      else if (r.status === 429) A.toast("今天的「帮我写」用完了，明天再来");
      else if (r.status === 400 && r.data?.error === "content_blocked") A.toast("内容未通过审核，换种说法试试");
      else A.toast("扩写失败了，也可以直接自己描述");
    };

    /* 生成：幂等键在每次主动点击时刷新 */
    async function generate() {
      const prompt = ($("#gift-prompt").value.trim() || $("#gift-idea").value.trim()).slice(0, 100);
      if (prompt.length < 2) return A.toast("先描述一下想要的礼物");
      $("#gift-prompt").value = prompt;
      idemKey = newKey();
      gotoStep(2);
      $("#gift-status").textContent = "正在为你准备，大约需要十几秒……";
      $("#gift-candidates").innerHTML = "";
      $("#gift-regen").style.display = "none";
      const r = await A.post("/api/items/generate", { prompt, idempotency_key: idemKey });
      $("#gift-regen").style.display = "block";
      if (!r.ok) {
        gotoStep(1);
        if (r.status === 401) A.toast("登录后才能生成礼物，请先到「我的」登录");
        else if (r.status === 429) A.toast("本月免费生成次数用完了");
        else if (r.status === 400 && r.data?.error === "content_blocked") A.toast("内容未通过审核，换种说法试试");
        else A.toast("生成失败了，请再试一次");
        return;
      }
      const urls = Array.isArray(r.data?.candidates) ? r.data.candidates : [];
      if (!urls.length) {
        gotoStep(1);
        return A.toast("没有生成成功，请再试一次");
      }
      $("#gift-status").textContent = "挑一张最像的";
      $("#gift-candidates").innerHTML = urls.map((u, i) =>
        `<button class="card p-1 relative gift-cand" data-url="${esc(u)}">
          <img src="${esc(u)}" class="w-full h-36 object-cover rounded-xl" alt="候选礼物 ${i + 1}"/>
          <span class="absolute inset-1 rounded-xl" style="border:2px solid transparent"></span>
        </button>`
      ).join("");
    }
    $("#gift-generate").onclick = generate;
    $("#gift-regen").onclick = generate;

    /* 选图 → 第 3 步 */
    $("#gift-candidates").addEventListener("click", (e) => {
      const btn = e.target.closest(".gift-cand");
      if (!btn) return;
      selected = btn.dataset.url;
      $("#gift-final-img").src = selected;
      $("#gift-name").value = $("#gift-idea").value.trim().slice(0, 30);
      gotoStep(3);
    });

    /* 收藏到纪念馆 */
    $("#gift-claim").onclick = async () => {
      if (!selected) return;
      const name = $("#gift-name").value.trim();
      if (!name) return A.toast("给这份礼物起个名字");
      const btn = $("#gift-claim");
      btn.disabled = true;
      const r = await A.post("/api/items/claim", { url: selected, prompt: $("#gift-prompt").value.trim(), name });
      btn.disabled = false;
      if (r.ok) {
        A.toast("已收藏，审核通过后会出现在供桌");
        ctx.back();
      } else if (r.status === 401) A.toast("请先登录");
      else A.toast("收藏失败，请再试一次");
    };

    /* 再准备一件 */
    $("#gift-again").onclick = () => {
      selected = null;
      $("#gift-idea").value = "";
      $("#gift-prompt").value = "";
      $("#gift-idea-count").textContent = "0";
      $("#gift-prompt-card").style.display = "none";
      gotoStep(1);
    };

    gotoStep(1);
  },
};
