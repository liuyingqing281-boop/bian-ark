/* 彼岸原型 · 真实 API 适配层（同源 /proto 托管下使用）
 * 所有页面通过 window.BianApi 访问；memorialId 由 ?id= 指定，默认公开示例馆。 */
(function () {
  // 默认馆按环境分流：本地开发库=王老先生；线上库=小曼（蝉，public）。URL ?id= 优先于此默认值
  const DEFAULT_MEMORIAL_ID = ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "4fc5e476-cae8-4ff7-9b3a-4a2b8693a265"
    : "a952c23f-28f4-4962-8007-95c4dbbc2709";

  function memorialId() {
    return new URLSearchParams(location.search).get("id") || DEFAULT_MEMORIAL_ID;
  }

  async function req(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    if (res.status === 204) return { ok: true, status: 204 };
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }

  const get = (url) => req("GET", url);
  const post = (url, body) => req("POST", url, body);
  const del = (url) => req("DELETE", url);
  const patchReq = (url, body) => req("PATCH", url, body);

  /* UTC 串 → 相对时间（「2 小时前 / 昨天 / 3 天前」） */
  function relTime(iso) {
    if (!iso) return "";
    const t = new Date(String(iso).replace(" ", "T") + (String(iso).endsWith("Z") ? "" : "Z"));
    const diff = Date.now() - t.getTime();
    if (isNaN(diff) || diff < 0) return "刚刚";
    const m = Math.floor(diff / 60000);
    if (m < 1) return "刚刚";
    if (m < 60) return `${m} 分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} 小时前`;
    const d = Math.floor(h / 24);
    if (d === 1) return "昨天";
    if (d < 30) return `${d} 天前`;
    return `${Math.floor(d / 30)} 个月前`;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const t = new Date(String(iso).replace(" ", "T") + (String(iso).endsWith("Z") ? "" : "Z"));
    if (isNaN(t.getTime())) return iso;
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}.${p(t.getMonth() + 1)}.${p(t.getDate())}`;
  }

  function yuan(cents) {
    return "¥" + (Number(cents || 0) / 100).toFixed(Number(cents || 0) % 100 ? 2 : 0);
  }

  /* 轻提示：深色半透明底白字，停留 2s（对齐设计规范 Toast） */
  function toast(msg) {
    let el = document.getElementById("bian-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "bian-toast";
      el.style.cssText =
        "position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(16px);" +
        "background:rgba(43,43,43,0.88);color:#fff;font-size:14px;padding:8px 18px;border-radius:999px;" +
        "z-index:9999;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;max-width:80%;text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) translateY(0)";
    });
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(16px)";
    }, 2000);
  }

  window.BianApi = {
    memorialId,
    relTime,
    fmtDate,
    yuan,
    toast,
    get,
    post,
    del,
    patch: patchReq,
    /* 领域封装 */
    getMemorial: (id) => get(`/api/memorials/${id || memorialId()}`),
    getTimeline: (id) => get(`/api/timeline?memorialId=${id || memorialId()}`),
    getFeed: (id) => get(`/api/hall/feed?memorialId=${id || memorialId()}`),
    getItems: (id) => get(`/api/items?memorialId=${id || memorialId()}`),
    tribute: (itemId, extra) =>
      post(`/api/tribute`, { memorialId: memorialId(), itemId, ...(extra || {}) }),
    getMessages: (id) => get(`/api/messages?memorialId=${id || memorialId()}`),
    postMessage: (msgType, content) =>
      post(`/api/messages`, { memorialId: memorialId(), msgType, content }),
    getMemories: (id) => get(`/api/memories?memorialId=${id || memorialId()}`),
    postMemory: (section, content, source) =>
      post(`/api/memories`, { memorialId: memorialId(), section, content, source }),
    deleteMemory: (id) => del(`/api/memories/${id}`),
    chat: (message, mode) => post(`/api/hall/chat`, { memorialId: memorialId(), message, mode }),
    getChatHistory: () => get(`/api/hall/chat/history?memorialId=${memorialId()}`),
    clearChatHistory: () => del(`/api/hall/chat/history?memorialId=${memorialId()}`),
    getMe: () => get(`/api/me`),
    getMeMemorials: () => get(`/api/me/memorials`),
    getMeOrders: () => get(`/api/me/orders`),
    /* 「我的」板块（R5）：通知 / 反馈 / 设置 / 协作组 / 隐私 */
    getNotifications: () => get(`/api/me/notifications`),
    markNotificationsRead: (ids) => post(`/api/me/notifications/read`, { ids: ids || [] }),
    postFeedback: (content, contact) => post(`/api/feedback`, { content, contact }),
    getSettings: () => get(`/api/me/settings`),
    patchSettings: (patch) => patchReq(`/api/me/settings`, patch),
    createGroup: (name) => post(`/api/groups`, { name }),
    joinGroup: (inviteCode) => post(`/api/groups/join`, { invite_code: inviteCode }),
    leaveGroup: (id) => post(`/api/groups/${id}/leave`, {}),
    requestData: (kind) => post(`/api/me/data`, { kind }),
    deleteMemorial: (id) => del(`/api/memorials/${id}`),
    /* 认证（屏01 登录注册屏，2026-08-24 登录/注册分离）：verify/微信扫码均带 intent */
    requestCode: (channel, target) => post(`/api/auth/request-code`, { channel, target }),
    verifyCode: (channel, target, code, extra) =>
      post(`/api/auth/verify`, { channel, target, code, ...(extra || {}) }),
    wechatQrcode: (intent) => post(`/api/auth/wechat/qrcode`, { intent }),
    logout: () => post(`/api/auth/logout`, {}),
  };
})();
