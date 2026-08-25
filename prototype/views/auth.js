/* V0 登录注册屏（屏01 · 第一屏 · 登录/注册分离，2026-08-24 拍板：默认登录 tab，注册专门点击）
 * 契约：docs/08 §3.0——request-code（60s 限频/devCode 回填）→ verify（intent=login|register 分流）
 * → Cookie 会话 → 进纪念馆首页；微信扫码 qrcode 带 intent，回跳错误经 ?error=wechat_* 落地 */
window.BianViews = window.BianViews || {};
window.BianViews.auth = {
  tab: null, // 无底部导航
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    let channel = "sms";
    let mode = "login"; // 默认登录；注册需专门点击

    /* 光绸背景（§2.0 视觉规范）：默认「烛夜」，右下角「换个意境」逐帧插值切换 */
    const silk = window.BianSilk ? window.BianSilk.mount($("#auth-silk")) : null;
    const paletteBtn = $("#auth-palette");
    if (silk) paletteBtn.onclick = () => silk.switchPalette();
    else paletteBtn.style.display = "none";

    const PH_RE = /^1\d{10}$/;
    const EM_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const target = $("#auth-target"), code = $("#auth-code"), send = $("#auth-send"), submit = $("#auth-submit");
    const nameRow = $("#auth-name-row"), nameInput = $("#auth-name");
    const agreeRow = $("#auth-agree-row"), agreeBox = $("#auth-agree");
    const wechatBtn = $("#auth-wechat"), wechatText = $("#auth-wechat-text");

    /* tab 态：登录/注册（下划线态，同通道切换样式） */
    const paintTabs = () => root.querySelectorAll(".auth-tab").forEach((x) => {
      const on = x.dataset.mode === mode;
      x.classList.toggle("active", on);
      x.style.color = on ? "var(--ember-soft)" : "rgba(255,246,236,.45)";
      x.style.borderBottom = on ? "2px solid var(--ember-soft)" : "2px solid transparent";
    });

    const setMode = (m, keepInput) => {
      mode = m;
      paintTabs();
      const reg = mode === "register";
      nameRow.style.display = reg ? "" : "none";
      agreeRow.style.display = reg ? "" : "none";
      submit.textContent = reg ? "注册并进入" : "进入彼岸";
      wechatText.textContent = reg ? "微信注册" : "微信扫码登录";
      if (!keepInput) { nameInput.value = ""; agreeBox.checked = false; }
    };
    root.querySelectorAll(".auth-tab").forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });

    /* 通道切换（两 tab 同构平级）：下划线态 + 清空输入 */
    const paint = () => root.querySelectorAll(".auth-ch").forEach((x) => {
      const on = x.dataset.ch === channel;
      x.classList.toggle("active", on);
      x.style.color = on ? "var(--ember-soft)" : "rgba(255,246,236,.45)";
      x.style.borderBottom = on ? "2px solid var(--ember-soft)" : "2px solid transparent";
    });
    root.querySelectorAll(".auth-ch").forEach((b) => {
      b.onclick = () => {
        channel = b.dataset.ch;
        paint();
        target.value = ""; code.value = "";
        target.placeholder = channel === "sms" ? "手机号" : "邮箱";
        target.inputmode = channel === "sms" ? "tel" : "email";
      };
    });
    paint();
    setMode("login", true);

    /* 微信回跳错误落地：?error=wechat_not_registered → 引导切注册；wechat_already_registered → 留登录 */
    const qError = new URLSearchParams(window.location.search).get("error") || "";
    if (qError === "wechat_not_registered") { setMode("register", true); A.toast("该微信还未注册，请先注册"); }
    else if (qError === "wechat_already_registered") { A.toast("该微信已注册，可直接登录"); }

    /* 获取验证码：格式校验 → 请求 → 60s 倒计时；devCode 自动回填（仅开发环境） */
    let cooling = 0, timer = null;
    send.onclick = async () => {
      if (cooling > 0) return;
      const v = target.value.trim();
      if (channel === "sms" && !PH_RE.test(v)) return A.toast("手机号格式不对，再看看");
      if (channel === "email" && !EM_RE.test(v)) return A.toast("邮箱格式不对，再看看");
      send.disabled = true;
      const r = await A.requestCode(channel, v);
      if (r.ok) {
        A.toast("验证码已发出，10 分钟内有效");
        if (r.data?.devCode) { code.value = r.data.devCode; A.toast("开发环境：验证码已自动填入"); }
        cooling = 60;
        send.textContent = `${cooling}s 后重发`;
        timer = setInterval(() => {
          cooling -= 1;
          if (cooling <= 0) { clearInterval(timer); send.textContent = "获取验证码"; send.disabled = false; }
          else send.textContent = `${cooling}s 后重发`;
        }, 1000);
      } else {
        send.disabled = false;
        if (r.status === 429) A.toast("太频繁了，歇一会儿再试");
        else if (r.status === 503 && r.data?.error === "email_not_configured") A.toast("邮件服务未配置，请先用手机号");
        else A.toast("没有发送成功，请再试一次");
      }
    };

    /* 进入彼岸 / 注册并进入：verify 带 intent → 会话落 Cookie → 进首页 */
    submit.onclick = async () => {
      const v = target.value.trim(), c = code.value.trim();
      if (!v) return A.toast("先填" + (channel === "sms" ? "手机号" : "邮箱"));
      if (!/^\d{6}$/.test(c)) return A.toast("验证码是 6 位数字");
      if (mode === "register" && !agreeBox.checked) return A.toast("请先勾选同意《用户协议》与《隐私政策》");
      submit.disabled = true;
      submit.textContent = "验证中…";
      const extra = mode === "register"
        ? { intent: "register", name: nameInput.value.trim(), agreed: true }
        : { intent: "login" };
      const r = await A.verifyCode(channel, v, c, extra);
      submit.disabled = false;
      setMode(mode, true);
      if (r.ok) { A.toast(mode === "register" ? "注册成功，欢迎" : "欢迎回来"); (window.BianEnterApp ? window.BianEnterApp() : ctx.go("home")); }
      else if (r.status === 404 && r.data?.error === "account_not_found") {
        A.toast("该手机号/邮箱还未注册，已为你切到注册");
        setMode("register", true); // 保留输入：同一验证码可直接复用
      } else if (r.status === 409 && r.data?.error === "already_registered") {
        A.toast("该手机号/邮箱已注册，可直接登录");
        setMode("login", true);
      } else if (r.status === 400 && r.data?.error === "agreement_required") A.toast("请先勾选同意《用户协议》与《隐私政策》");
      else if (r.status === 400) A.toast("验证码不对，再看看");
      else if (r.status === 429) A.toast("错太多次了，15 分钟后再试");
      else A.toast("没有成功，请再试一次");
    };
    code.addEventListener("keydown", (e) => { if (e.key === "Enter") submit.onclick(); });

    /* 微信登录/注册：qrcode 带 intent → 整页跳转授权（未配置时明确提示） */
    wechatBtn.onclick = async () => {
      if (mode === "register" && !agreeBox.checked) return A.toast("请先勾选同意《用户协议》与《隐私政策》");
      const r = await A.wechatQrcode(mode);
      if (r.ok && r.data?.url) window.location.href = r.data.url;
      else if (r.status === 503) A.toast("微信登录暂未开通，请先用验证码");
      else A.toast("没有发起成功，请再试一次");
    };
    $("#auth-guest").onclick = () => ctx.go("home");
  },
};
