/* V0 登录注册屏（屏01 · 登录/注册分离 2026-08-24 + 账号密码登录/忘记密码 2026-08-25）
 * 契约：docs/08 §3.0——request-code（60s 限频/devCode 回填）→ verify（intent=login|register 分流，注册带 password）
 * → login-password（账号密码登录，注册后手机号/邮箱即账号）→ reset-password（忘记密码：验码+重置，不写会话）
 * → Cookie 会话 → 进纪念馆首页；微信扫码 qrcode 带 intent，回跳错误经 ?error=wechat_* 落地 */
window.BianViews = window.BianViews || {};
window.BianViews.auth = {
  tab: null, // 无底部导航
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    let channel = "sms";
    let mode = "login"; // 默认登录；注册需专门点击
    let method = "password"; // 登录方式：密码（默认）/ 验证码，两式平级（2026-08-25）

    /* 光绸背景（§2.0 视觉规范）：默认「烛夜」，右下角「换个意境」逐帧插值切换 */
    const silk = window.BianSilk ? window.BianSilk.mount($("#auth-silk")) : null;
    const paletteBtn = $("#auth-palette");
    if (silk) paletteBtn.onclick = () => silk.switchPalette();
    else paletteBtn.style.display = "none";

    const PH_RE = /^1\d{10}$/;
    const EM_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const detectChannel = (v) => (PH_RE.test(v) ? "sms" : EM_RE.test(v) ? "email" : null);
    /* 密码规则与服务端同规：8–64 位、四类字符≥3 类、无空白 */
    const validPassword = (pw) => {
      if (!pw || pw.length < 8 || pw.length > 64 || /\s/.test(pw)) return false;
      let n = 0;
      if (/[a-z]/.test(pw)) n += 1;
      if (/[A-Z]/.test(pw)) n += 1;
      if (/\d/.test(pw)) n += 1;
      if (/[^A-Za-z0-9]/.test(pw)) n += 1;
      return n >= 3;
    };

    const target = $("#auth-target"), code = $("#auth-code"), send = $("#auth-send"), submit = $("#auth-submit");
    const nameRow = $("#auth-name-row"), nameInput = $("#auth-name");
    const agreeRow = $("#auth-agree-row"), agreeBox = $("#auth-agree");
    const wechatBtn = $("#auth-wechat"), wechatText = $("#auth-wechat-text");
    const methodsRow = $("#auth-methods"), channelsRow = $("#auth-channels"), codeRow = $("#auth-code-row");
    const loginPassRow = $("#auth-login-pass-row"), loginPass = $("#auth-loginpass"), forgotRow = $("#auth-forgot-row");
    const regPassRow = $("#auth-reg-pass-row"), regPass2Row = $("#auth-reg-pass2-row");
    const pass = $("#auth-pass"), pass2 = $("#auth-pass2"), ruleRow = $("#auth-rule-row");
    const resetBox = $("#auth-reset"), mainBox = $("#auth-main");

    /* tab 态：登录/注册（下划线态，同方式/通道切换样式） */
    const paintTabs = () => root.querySelectorAll(".auth-tab").forEach((x) => {
      const on = x.dataset.mode === mode;
      x.classList.toggle("active", on);
      x.style.color = on ? "var(--ember-soft)" : "rgba(255,246,236,.45)";
      x.style.borderBottom = on ? "2px solid var(--ember-soft)" : "2px solid transparent";
    });

    const paintMethods = () => root.querySelectorAll(".auth-m").forEach((x) => {
      const on = x.dataset.m === method;
      x.classList.toggle("active", on);
      x.style.color = on ? "var(--ember-soft)" : "rgba(255,246,236,.45)";
      x.style.borderBottom = on ? "2px solid var(--ember-soft)" : "2px solid transparent";
    });

    /* 表单可见性编排：方式切换行仅登录；通道/验证码行=注册或登录·验证码；密码行按方式/tab */
    const paintRows = () => {
      const reg = mode === "register";
      const codeWay = reg || method === "code";
      methodsRow.style.display = reg ? "none" : "flex";
      channelsRow.style.display = codeWay ? "flex" : "none";
      codeRow.style.display = codeWay ? "flex" : "none";
      loginPassRow.style.display = !reg && method === "password" ? "block" : "none";
      forgotRow.style.display = !reg && method === "password" ? "block" : "none";
      regPassRow.style.display = reg ? "block" : "none";
      regPass2Row.style.display = reg ? "block" : "none";
      ruleRow.style.display = reg ? "block" : "none";
      nameRow.style.display = reg ? "block" : "none";
      agreeRow.style.display = reg ? "flex" : "none";
      target.placeholder = reg || method === "code"
        ? (channel === "sms" ? "手机号" : "邮箱")
        : "手机号 / 邮箱";
      target.inputMode = reg || method === "code" ? (channel === "sms" ? "tel" : "email") : "text";
    };

    const setMethod = (m, keepInput) => {
      method = m;
      paintMethods();
      if (!keepInput) { target.value = ""; code.value = ""; loginPass.value = ""; }
      paintRows();
    };
    root.querySelectorAll(".auth-m").forEach((b) => { b.onclick = () => setMethod(b.dataset.m); });

    const setMode = (m, keepInput) => {
      mode = m;
      paintTabs();
      submit.textContent = m === "register" ? "注册并进入" : "进入彼岸";
      wechatText.textContent = m === "register" ? "微信注册" : "微信扫码登录";
      if (!keepInput) { nameInput.value = ""; agreeBox.checked = false; pass.value = ""; pass2.value = ""; }
      paintRows();
    };
    root.querySelectorAll(".auth-tab").forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });

    /* 通道切换（注册 tab 与登录·验证码方式）：下划线态 + 清空输入 */
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
        paintRows();
      };
    });
    paint();
    paintMethods();
    setMode("login", true);
    setMethod("password", true);

    /* 👁 显隐切换：密文=fa-eye-slash（划斜线眼睛），明文=fa-eye（眼睛），纯前端态 */
    root.querySelectorAll(".auth-eye[data-eye]").forEach((btn) => {
      btn.onclick = () => {
        const input = document.getElementById(btn.dataset.eye);
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        btn.innerHTML = visible ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
      };
    });

    /* 微信回跳错误落地：?error=wechat_not_registered → 引导切注册；wechat_already_registered → 留登录 */
    const qError = new URLSearchParams(window.location.search).get("error") || "";
    if (qError === "wechat_not_registered") { setMode("register", true); A.toast("该微信还未注册，请先注册"); }
    else if (qError === "wechat_already_registered") { A.toast("该微信已注册，可直接登录"); }

    /* 获取验证码：格式校验 → 请求 → 60s 倒计时；devCode 自动回填（仅开发环境） */
    let cooling = 0, timer = null;
    const startCooldown = () => {
      cooling = 60;
      send.disabled = true;
      send.textContent = `${cooling}s 后重发`;
      timer = setInterval(() => {
        cooling -= 1;
        if (cooling <= 0) { clearInterval(timer); send.textContent = "获取验证码"; send.disabled = false; }
        else send.textContent = `${cooling}s 后重发`;
      }, 1000);
    };
    send.onclick = async () => {
      if (cooling > 0) return;
      const v = target.value.trim();
      if (mode === "login" && method === "code" && detectChannel(v)) {
        channel = detectChannel(v); // 验证码方式按账号格式自动归一通道
        paint(); paintRows();
      }
      if (channel === "sms" && !PH_RE.test(v)) return A.toast("手机号格式不对，再看看");
      if (channel === "email" && !EM_RE.test(v)) return A.toast("邮箱格式不对，再看看");
      send.disabled = true;
      const r = await A.requestCode(channel, v);
      if (r.ok) {
        A.toast("验证码已发出，10 分钟内有效");
        if (r.data?.devCode) { code.value = r.data.devCode; A.toast("开发环境：验证码已自动填入"); }
        startCooldown();
      } else {
        send.disabled = false;
        if (r.status === 429) A.toast("太频繁了，歇一会儿再试");
        else if (r.status === 503 && r.data?.error === "email_not_configured") A.toast("邮件服务未配置，请先用手机号");
        else A.toast("没有发送成功，请再试一次");
      }
    };

    /* 进入彼岸 / 注册并进入 */
    submit.onclick = async () => {
      const v = target.value.trim();
      if (!v) return A.toast(mode === "login" && method === "password" ? "先填手机号或邮箱" : "先填" + (channel === "sms" ? "手机号" : "邮箱"));
      if (mode === "login" && method === "password") return loginByPassword(v);

      const c = code.value.trim();
      if (!/^\d{6}$/.test(c)) return A.toast("验证码是 6 位数字");
      if (mode === "register") {
        if (!agreeBox.checked) return A.toast("请先勾选同意《用户协议》与《隐私政策》");
        if (!validPassword(pass.value)) return A.toast("密码需 8–64 位，含大写/小写/数字/符号中的至少 3 种");
        if (pass.value !== pass2.value) return A.toast("两次输入的密码不一致");
      }
      submit.disabled = true;
      submit.textContent = "验证中…";
      const extra = mode === "register"
        ? { intent: "register", password: pass.value, name: nameInput.value.trim(), agreed: true }
        : { intent: "login" };
      const r = await A.verifyCode(channel, v, c, extra);
      submit.disabled = false;
      submit.textContent = mode === "register" ? "注册并进入" : "进入彼岸";
      if (r.ok) {
        if (mode === "register") A.toast("注册成功，账号与密码请妥善保管");
        else A.toast("欢迎回来");
        (window.BianEnterApp ? window.BianEnterApp() : ctx.go("home"));
      } else if (r.status === 404 && r.data?.error === "account_not_found") {
        A.toast("该手机号/邮箱还未注册，已为你切到注册");
        setMode("register", true); // 保留输入：同一验证码可直接复用
      } else if (r.status === 409 && r.data?.error === "already_registered") {
        A.toast("该手机号/邮箱已注册，可直接登录");
        setMode("login", true);
      } else if (r.status === 400 && r.data?.error === "agreement_required") A.toast("请先勾选同意《用户协议》与《隐私政策》");
      else if (r.status === 400 && r.data?.error === "weak_password") A.toast("密码需 8–64 位，含大写/小写/数字/符号中的至少 3 种");
      else if (r.status === 400) A.toast("验证码错误");
      else if (r.status === 429) A.toast("错太多次了，15 分钟后再试");
      else A.toast("没有成功，请再试一次");
    };

    /* 账号密码登录：注册后的手机号/邮箱即账号，channel 前端自动判定 */
    async function loginByPassword(v) {
      const ch = detectChannel(v);
      if (!ch) return A.toast("账号格式不对：请填手机号或邮箱");
      if (!loginPass.value) return A.toast("先填密码");
      submit.disabled = true;
      submit.textContent = "验证中…";
      const r = await A.loginPassword(ch, v, loginPass.value);
      submit.disabled = false;
      submit.textContent = "进入彼岸";
      if (r.ok) { A.toast("欢迎回来"); (window.BianEnterApp ? window.BianEnterApp() : ctx.go("home")); }
      else if (r.status === 404 && r.data?.error === "account_not_found") {
        A.toast("该手机号/邮箱还未注册，已为你切到注册");
        setMode("register", true);
      } else if (r.status === 401 && r.data?.error === "password_not_set") {
        A.toast("该账号未设置密码，可切「验证码」登录或点「忘记密码」设置");
      } else if (r.status === 401) A.toast("账号或密码不对，再看看");
      else if (r.status === 429) A.toast("错得太频繁，15 分钟后再试");
      else A.toast("没有成功，请再试一次");
    }
    loginPass.addEventListener("keydown", (e) => { if (e.key === "Enter") submit.onclick(); });
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

    /* ============ 忘记密码三步浮层（卡内切换，URL 不变） ============ */
    const resetSteps = { 1: $("#auth-reset-1"), 2: $("#auth-reset-2"), 3: $("#auth-reset-3") };
    const resetAccount = $("#auth-reset-account"), resetCode = $("#auth-reset-code");
    const resetNew = $("#auth-reset-new"), resetNew2 = $("#auth-reset-new2");
    const resetErr = $("#auth-reset-err"), resetErr2 = $("#auth-reset-err2");
    const resetSendBtn = $("#auth-reset-send");

    const setResetStep = (n) => {
      resetBox.style.display = n > 0 ? "block" : "none";
      mainBox.style.display = n > 0 ? "none" : "block";
      submit.style.display = n > 0 ? "none" : "block";
      wechatBtn.style.display = n > 0 ? "none" : "block";
      $("#auth-guest").parentElement.style.display = n > 0 ? "none" : "block";
      Object.entries(resetSteps).forEach(([k, el]) => { el.style.display = Number(k) === n ? "block" : "none"; });
      resetErr.style.display = "none";
      resetErr2.style.display = "none";
    };
    const showResetErr = (msg, which) => {
      const el = which === 2 ? resetErr2 : resetErr;
      el.textContent = msg;
      el.style.display = "block";
    };

    $("#auth-forgot").onclick = () => {
      resetAccount.value = target.value.trim(); // 回填登录 tab 已输入的账号
      setResetStep(1);
    };
    $("#auth-reset-back").onclick = () => setResetStep(0);

    let resetCooling = 0, resetTimer = null;
    resetSendBtn.onclick = async () => {
      if (resetCooling > 0) return;
      const v = resetAccount.value.trim();
      const ch = detectChannel(v);
      if (!ch) return showResetErr("账号格式不对：请填手机号或邮箱", 1);
      resetSendBtn.disabled = true;
      const r = await A.requestCode(ch, v);
      resetSendBtn.disabled = false;
      if (!r.ok) {
        if (r.status === 429) return showResetErr("太频繁了，歇一会儿再试", 1);
        return showResetErr("没有发送成功，请再试一次", 1);
      }
      A.toast("验证码已发出，10 分钟内有效");
      if (r.data?.devCode) { resetCode.value = r.data.devCode; A.toast("开发环境：验证码已自动填入"); }
      setResetStep(2);
      resetCooling = 60;
      resetSendBtn.textContent = `${resetCooling}s 后重发`;
      resetTimer = setInterval(() => {
        resetCooling -= 1;
        if (resetCooling <= 0) { clearInterval(resetTimer); resetSendBtn.textContent = "发送验证码"; }
        else resetSendBtn.textContent = `${resetCooling}s 后重发`;
      }, 1000);
    };

    $("#auth-reset-submit").onclick = async () => {
      const v = resetAccount.value.trim();
      const ch = detectChannel(v);
      if (!ch) return showResetErr("账号格式不对：请填手机号或邮箱", 2);
      if (!/^\d{6}$/.test(resetCode.value.trim())) return showResetErr("验证码错误", 2);
      if (!validPassword(resetNew.value)) return showResetErr("密码需 8–64 位，含大写/小写/数字/符号中的至少 3 种", 2);
      if (resetNew.value !== resetNew2.value) return showResetErr("两次输入的密码不一致", 2);
      const btn = $("#auth-reset-submit");
      btn.disabled = true;
      const r = await A.resetPassword(ch, v, resetCode.value.trim(), resetNew.value);
      btn.disabled = false;
      if (r.ok) { setResetStep(3); return; }
      if (r.status === 404 && r.data?.error === "account_not_found") return showResetErr("该手机号/邮箱还未注册", 2);
      if (r.status === 400 && r.data?.error === "invalid_code") return showResetErr("验证码错误", 2);
      if (r.status === 400 && r.data?.error === "weak_password") return showResetErr("密码需 8–64 位，含大写/小写/数字/符号中的至少 3 种", 2);
      if (r.status === 429) return showResetErr("错太多次了，15 分钟后再试", 2);
      showResetErr("没有成功，请再试一次", 2);
    };

    /* 完成态【去登录】：切回登录 tab·密码方式并回填账号 */
    $("#auth-reset-done").onclick = () => {
      setResetStep(0);
      setMode("login", true);
      setMethod("password", true);
      target.value = resetAccount.value.trim();
      loginPass.value = "";
    };
  },
};
