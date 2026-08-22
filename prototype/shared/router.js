/* 彼岸原型 · 微型视图路由（无依赖）
 * 视图栈 + 移动端转场（右进左出 250ms ease-out）+ 浮层管理 + keep-alive（对话页）。
 * 视图注册：BianViews.<name> = { tab: 'hall'|'me'|null, keepAlive?: bool, init(root, ctx) }
 * ctx: { id, setId(id), params, go, back, openOverlay, closeOverlay, toast }
 */
(function () {
  const V = (window.BianViews = window.BianViews || {});
  const cache = new Map(); // keepAlive 视图的 DOM
  const stack = []; // { name, node, params }
  let viewRoot, overlayRoot, tabbar;
  let busy = false;

  const ctx = {
    id: new URLSearchParams(location.search).get("id") || null,
    params: {},
    setId(id) {
      ctx.id = id;
      cache.clear(); // 换馆后 keep-alive 失效
    },
    go: (n, p) => go(n, p),
    back: () => back(),
    openOverlay: (n, d) => openOverlay(n, d),
    closeOverlay: () => closeOverlay(),
    toast: (m) => window.BianApi.toast(m),
  };

  function current() {
    return stack[stack.length - 1] || null;
  }

  async function render(name, params, direction) {
    const def = V[name];
    if (!def) return console.warn("unknown view", name);

    let node;
    if (def.keepAlive && cache.has(name)) {
      node = cache.get(name);
    } else {
      const html = await (await fetch(`views/${name}.html`)).text();
      node = document.createElement("div");
      node.className = "view";
      node.dataset.view = name;
      node.innerHTML = html;
      if (def.keepAlive) cache.set(name, node);
    }

    node.classList.remove("view-out-left", "view-in-right", "view-in-left");
    if (direction === "push") node.classList.add("view-in-right");
    if (direction === "pop") node.classList.add("view-in-left");
    viewRoot.appendChild(node);

    const top = stack[stack.length - 1];
    if (top && top.name === name) top.node = node; // 栈条目挂上 DOM，go/back 才能摘出

    ctx.params = params || {};
    await def.init(node, ctx);
    updateTabbar(def);
    return node;
  }

  async function go(name, params) {
    if (busy) return;
    busy = true;
    try {
      const cur = current();
      if (cur) {
        const def = V[cur.name];
        if (def.keepAlive) cur.node.remove();
        else {
          cur.node.classList.add("view-out-left");
          const n = cur.node;
          setTimeout(() => n.remove(), 260);
        }
      }
      stack.push({ name, params });
      await render(name, params, "push");
    } finally {
      busy = false;
    }
  }

  async function back() {
    if (busy || stack.length <= 1) return;
    busy = true;
    try {
      const cur = stack.pop();
      const def = V[cur.name];
      if (!def.keepAlive) cur.node.remove();
      else cur.node.remove(); // 保留在 cache，DOM 摘出即可
      const prev = current();
      await render(prev.name, prev.params, "pop");
    } finally {
      busy = false;
    }
  }

  function openOverlay(name, data) {
    overlayRoot.querySelectorAll(".ov").forEach((o) => (o.style.display = "none"));
    const el = overlayRoot.querySelector(`#ov-${name}`);
    if (!el) return;
    el.style.display = "block";
    overlayRoot.style.display = "block";
    const inner = el.querySelector(".sheet, .ov-card");
    if (inner) {
      inner.classList.remove("ov-up");
      void inner.offsetWidth;
      inner.classList.add("ov-up");
    }
    overlayRoot.dataset.active = name;
    el.dispatchEvent(new CustomEvent("ov:open", { detail: data || {} }));
  }

  function closeOverlay() {
    overlayRoot.style.display = "none";
    overlayRoot.dataset.active = "";
    overlayRoot.querySelectorAll(".ov").forEach((o) => (o.style.display = "none"));
  }

  function updateTabbar(def) {
    if (!tabbar) return;
    const show = def.tab != null;
    tabbar.style.display = show ? "grid" : "none";
    tabbar.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", show && t.dataset.tab === def.tab);
    });
  }

  window.BianRouter = {
    ctx,
    go,
    back,
    openOverlay,
    closeOverlay,
    current: () => current()?.name || null,
    /* 壳初始化：挂载点 + 底部 Tab + 返回 */
    mount({ viewRoot: vr, overlayRoot: or, tabbar: tb }) {
      viewRoot = vr;
      overlayRoot = or;
      tabbar = tb;
      tabbar.addEventListener("click", (e) => {
        const t = e.target.closest(".tab");
        if (!t) return;
        const tab = t.dataset.tab;
        if (tab === "garden") return ctx.toast("「发现」为后续阶段");
        if (tab === "hall") {
          if (current()?.name !== "home") {
            stack.length = 0;
            go("home");
          }
        }
        if (tab === "me" && current()?.name !== "profile") go("profile");
      });
      // 视图内通用返回：.nav-back 按钮
      viewRoot.addEventListener("click", (e) => {
        if (e.target.closest(".nav-back")) back();
      });
      // 遮罩点击 = 取消
      or.addEventListener("click", (e) => {
        if (e.target.classList.contains("sheet-mask")) closeOverlay();
      });
    },
  };
})();
