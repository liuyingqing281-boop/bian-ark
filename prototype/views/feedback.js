/* V-FEEDBACK 帮助与反馈（R5）：POST /api/feedback（≤500 字 + 联系方式选填） */
window.BianViews = window.BianViews || {};
window.BianViews.feedback = {
  tab: null,
  async init(root) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    const content = $("#fb-content");

    content.addEventListener("input", () => {
      $("#fb-count").textContent = content.value.length;
    });

    $("#fb-submit").onclick = async () => {
      const text = content.value.trim();
      if (!text) return A.toast("先写点内容再提交");
      const btn = $("#fb-submit");
      btn.disabled = true;
      const r = await A.postFeedback(text, $("#fb-contact").value.trim());
      btn.disabled = false;
      if (r.ok) {
        content.value = "";
        $("#fb-count").textContent = "0";
        A.toast("已收到，谢谢你");
      } else if (r.status === 401) A.toast("请先登录");
      else if (r.status === 429) A.toast("提交太频繁了，歇一会儿再试");
      else if (r.status === 400 && r.data?.error === "content_blocked") A.toast("内容未通过审核，请调整后再提交");
      else A.toast("提交失败，请再试一次");
    };
  },
};
