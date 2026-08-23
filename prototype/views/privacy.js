/* V-PRIVACY 隐私（R5）：数据导出 + 注销/删除申请（落 data_requests 表） */
window.BianViews = window.BianViews || {};
window.BianViews.privacy = {
  tab: null,
  async init(root) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);

    $("#privacy-export-req").onclick = async () => {
      const r = await A.requestData("export");
      if (r.ok) A.toast(r.data?.duplicate ? "已有申请在处理中" : "已收到，处理完成后通知你");
      else if (r.status === 401) A.toast("请先登录");
      else A.toast("提交失败，请再试一次");
    };

    $("#privacy-delete-req").onclick = async () => {
      if (!confirm("确定申请注销账号？此操作提交后不可撤销。")) return;
      const r = await A.requestData("delete");
      if (r.ok) A.toast(r.data?.duplicate ? "已有注销申请在处理中" : "注销申请已提交");
      else if (r.status === 401) A.toast("请先登录");
      else A.toast("提交失败，请再试一次");
    };
  },
};
