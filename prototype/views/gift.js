/* V6 礼物页（W5 自动润色确认 + W6 真实进度条）
 * 1 心意：输入心愿 →「下一步」自动润色（/api/items/prompt）→ 对比卡确认或改用原文
 * 2 礼物：POST /api/items/generate 创建异步任务 → 轮询 GET ?jobId= 渲染真实百分比 → 出图挑选
 * 3 完成：/api/items/claim 收藏（pending 审核后上供桌）
 */
window.BianViews = window.BianViews || {};
window.BianViews.gift = {
  tab: null,
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    let selected = null;
    let pollTimer = null;

    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const newKey = () => "gift-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

    function gotoStep(n) {
      [1, 2, 3].forEach((i) => ($("#gift-step" + i).style.display = i === n ? "block" : "none"));
      root.querySelectorAll("#gift-steps .chip").forEach((c) => {
        const on = Number(c.dataset.step) <= n;
        c.classList.toggle("active", on);
        c.style.color = on ? "" : "rgba(255,246,236,.45)";
      });
      if (n !== 2 && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    $("#gift-idea").addEventListener("input", () => {
      $("#gift-idea-count").textContent = $("#gift-idea").value.length;
    });

    /* ---- 第 1 步：下一步 → 自动润色 → 对比卡 ---- */
    $("#gift-next").onclick = async () => {
      const idea = $("#gift-idea").value.trim();
      if (idea.length < 2) return A.toast("先写一句心愿，哪怕两个字");
      const btn = $("#gift-next");
      btn.disabled = true;
      btn.textContent = "正在润色……";
      $("#gift-polish-card").style.display = "block";
      $("#gift-polish-status").textContent = "AI 正在润色你的描述……";
      $("#gift-polish-body").style.display = "none";
      $("#gift-gen-btns").style.display = "none";

      const r = await A.post("/api/items/prompt", { idea });
      btn.disabled = false;
      btn.textContent = "下一步";
      $("#gift-polish-origin").textContent = idea;
      $("#gift-gen-btns").style.display = "grid";

      if (r.ok && r.data?.prompt) {
        $("#gift-polish-status").textContent = "润色好了，确认一下";
        $("#gift-polish-body").style.display = "block";
        $("#gift-prompt").value = r.data.prompt;
        $("#gift-polish-remaining").textContent =
          typeof r.data.remaining === "number" ? `今日还可润色 ${r.data.remaining} 次` : "";
      } else {
        // 降级：润色不可用时不阻断，只能走原文
        $("#gift-polish-status").textContent =
          r.status === 429 ? "今日润色次数用完了，可以直接用原文生成"
          : r.status === 401 ? "登录后可用润色，也可以先用原文生成"
          : "润色暂时不可用，可以直接用原文生成";
        $("#gift-polish-body").style.display = "none";
        $("#gift-use-polished").style.display = "none";
      }
      if (r.ok) $("#gift-use-polished").style.display = "block";
    };

    /* ---- 第 2 步：异步生成 + 轮询真实进度 ---- */
    async function generate(prompt) {
      const p = (prompt || "").trim().slice(0, 100);
      if (p.length < 2) return A.toast("先描述一下想要的礼物");
      gotoStep(2);
      $("#gift-status").textContent = "正在为你准备……";
      $("#gift-candidates").innerHTML = "";
      $("#gift-regen").style.display = "none";
      $("#gift-progress-box").style.display = "block";
      setProgress(0);

      const r = await A.post("/api/items/generate", { prompt: p, idempotency_key: newKey() });
      if (r.status === 401) { gotoStep(1); return A.toast("登录后才能生成礼物，请先到「我的」登录"); }
      if (r.status === 429) { gotoStep(1); return A.toast("本月免费生成次数用完了"); }
      if (r.status === 400 && r.data?.error === "content_blocked") { gotoStep(1); return A.toast("内容未通过审核，换种说法试试"); }
      if (!r.data?.jobId) { gotoStep(1); return A.toast("生成失败了，请再试一次"); }

      const jobId = r.data.jobId;
      let slowNotified = false;
      const startedAt = Date.now();
      pollTimer = setInterval(async () => {
        const s = await A.get(`/api/items/generate?jobId=${encodeURIComponent(jobId)}`);
        if (!s.ok || !s.data) return;
        const d = s.data;
        setProgress(Math.round(((d.completed || 0) / (d.total || 4)) * 100));
        if (!slowNotified && Date.now() - startedAt > 30000) {
          slowNotified = true;
          A.toast("生成有点慢，仍在继续");
        }
        if (d.status === "done") {
          clearInterval(pollTimer); pollTimer = null;
          setProgress(100);
          const urls = Array.isArray(d.candidates) ? d.candidates : [];
          if (!urls.length) { gotoStep(1); return A.toast("没有生成成功，请再试一次"); }
          $("#gift-status").textContent = "挑一张最像的";
          $("#gift-progress-box").style.display = "none";
          $("#gift-candidates").innerHTML = urls.map((u, i) =>
            `<button class="card p-1 relative gift-cand" data-url="${esc(u)}">
              <img src="${esc(u)}" class="w-full h-36 object-cover rounded-xl" alt="候选礼物 ${i + 1}"/>
            </button>`
          ).join("");
          $("#gift-regen").style.display = "block";
        } else if (d.status === "failed") {
          clearInterval(pollTimer); pollTimer = null;
          $("#gift-status").textContent = "生成失败了";
          $("#gift-regen").style.display = "block";
          $("#gift-regen").textContent = "点击重试";
        }
      }, 1500);
    }
    function setProgress(pct) {
      $("#gift-progress-bar").style.width = pct + "%";
      $("#gift-progress-num").textContent = pct;
    }

    $("#gift-use-polished").onclick = () => generate($("#gift-prompt").value);
    $("#gift-use-origin").onclick = () => generate($("#gift-idea").value);
    $("#gift-regen").onclick = () => generate($("#gift-prompt").value.trim() || $("#gift-idea").value);

    /* ---- 选图 → 第 3 步 ---- */
    $("#gift-candidates").addEventListener("click", (e) => {
      const btn = e.target.closest(".gift-cand");
      if (!btn) return;
      selected = btn.dataset.url;
      $("#gift-final-img").src = selected;
      $("#gift-name").value = $("#gift-idea").value.trim().slice(0, 30);
      gotoStep(3);
    });

    /* ---- 收藏到纪念馆 ---- */
    $("#gift-claim").onclick = async () => {
      if (!selected) return;
      const name = $("#gift-name").value.trim();
      if (!name) return A.toast("给这份礼物起个名字");
      const btn = $("#gift-claim");
      btn.disabled = true;
      const r = await A.post("/api/items/claim", {
        url: selected,
        prompt: $("#gift-prompt").value.trim() || $("#gift-idea").value.trim(),
        name,
      });
      btn.disabled = false;
      if (r.ok) {
        A.toast("已收藏，审核通过后会出现在供桌");
        ctx.back();
      } else if (r.status === 401) A.toast("请先登录");
      else A.toast("收藏失败，请再试一次");
    };

    /* ---- 再准备一件 ---- */
    $("#gift-again").onclick = () => {
      selected = null;
      $("#gift-idea").value = "";
      $("#gift-prompt").value = "";
      $("#gift-idea-count").textContent = "0";
      $("#gift-polish-card").style.display = "none";
      $("#gift-gen-btns").style.display = "none";
      $("#gift-next").style.display = "block";
      gotoStep(1);
    };

    gotoStep(1);
  },
};
