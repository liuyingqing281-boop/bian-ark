/* V-EMPTY 空态引导页（R1：登录但还没有馆的用户的首页） */
window.BianViews = window.BianViews || {};
window.BianViews.empty = {
  tab: "hall", // 底部导航可见，「纪念馆」激活
  async init(root, ctx) {
    const A = window.BianApi;
    root.querySelector("#empty-create").onclick = () => ctx.go("wizard");
    root.querySelector("#empty-garden").onclick = () => ctx.go("garden");
  },
};
