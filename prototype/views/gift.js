/* V6 礼物页（P1 实验 · 演示态：真实链路为 /api/items/prompt|generate|claim + 一口价支付） */
window.BianViews = window.BianViews || {};
window.BianViews.gift = {
  tab: null,
  init(root, ctx) {
    const A = window.BianApi;
    root.querySelectorAll("[data-act]").forEach((b) => {
      b.onclick = () => {
        const act = b.dataset.act;
        if (act === "claim") A.toast("演示环境：生成物审核通过后出现在供桌");
        else if (act === "share") A.toast("演示环境：生成分享卡片");
        else if (act === "again") A.toast("回到第 1 步重新填写心意");
      };
    });
  },
};
