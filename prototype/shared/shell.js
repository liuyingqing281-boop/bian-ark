/* 壳逻辑：浮层行为 + 启动 */
(async function () {
  const R = window.BianRouter, A = window.BianApi;
  R.mount({
    viewRoot: document.getElementById("view-root"),
    overlayRoot: document.getElementById("overlay-root"),
    tabbar: document.getElementById("tabbar"),
  });

  /* F1 身份说明：点击 = 确认边界 → 进对话页 */
  document.getElementById("ov-intro-go").addEventListener("click", () => {
    localStorage.setItem("bian_seen_intro", "1");
    R.closeOverlay();
    R.go("chat");
  });

  /* F2 一口价确认：打开时填充；供奉 = 演示态提示（真实收银台不在原型态接通） */
  let payItem = null;
  document.getElementById("ov-pay").addEventListener("ov:open", (e) => {
    payItem = e.detail?.item || null;
    if (payItem) {
      document.getElementById("ov-pay-name").textContent = payItem.name;
      document.getElementById("ov-pay-price").textContent = `一口价 ${A.yuan(payItem.priceCents ?? payItem.price_cents)}`;
    }
  });
  document.getElementById("ov-pay-cancel").addEventListener("click", () => R.closeOverlay());
  document.getElementById("ov-pay-ok").addEventListener("click", () => {
    A.toast("演示环境：线上将跳转支付收银台，支付成功后出现在供桌上");
    setTimeout(() => R.closeOverlay(), 1000);
  });

  /* F3 添加记忆抽屉 */
  let memSection = "likes";
  let memSource;
  const MEM_NAMES = { personality: "👤 TA 是怎样的人", relation: "❤️ 我和 TA", likes: "🎵 TA 喜欢什么", speech: "💬 TA 怎么说话", profile: "📄 基础资料" };
  document.getElementById("ov-memadd").addEventListener("ov:open", (e) => {
    memSource = e.detail?.source;
    document.getElementById("ov-memadd-text").value = "";
  });
  document.getElementById("ov-memadd-sections").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    document.querySelectorAll("#ov-memadd-sections .chip").forEach((x) => x.classList.remove("active"));
    c.classList.add("active");
    memSection = c.dataset.section;
    document.getElementById("ov-memadd-hint").textContent = `保存后将出现在「${MEM_NAMES[memSection]}」分区`;
  });
  document.getElementById("ov-memadd-save").addEventListener("click", async () => {
    const content = document.getElementById("ov-memadd-text").value.trim();
    if (!content) return A.toast("先写点什么再保存");
    const r = await A.postMemory(memSection, content, memSource);
    if (r.ok) {
      R.closeOverlay();
      A.toast("已保存到 TA 的记忆档案");
      document.dispatchEvent(new CustomEvent("bian:memory-saved")); // 记忆档案视图监听刷新
    } else if (r.status === 403) A.toast("只有馆主和协作人可以添加记忆");
    else if (r.status === 422) A.toast("这个话题我们轻轻带过");
    else A.toast("没有保存成功，请再试一次");
  });

  /* F4 依据弹层 */
  document.getElementById("ov-evidence").addEventListener("ov:open", (e) => {
    document.getElementById("ov-ev-quote").textContent = `“${e.detail?.quote || ""}”`;
    document.getElementById("ov-ev-date").textContent = `📅 添加于 ${e.detail?.date || ""}`;
  });
  document.getElementById("ov-ev-close").addEventListener("click", () => R.closeOverlay());

  /* 启动：未登录 → 屏01 登录注册屏（第一屏）；已登录 → 直达纪念馆首页 */
  const me = await A.getMe();
  R.go(me.ok ? "home" : "auth");
})();
