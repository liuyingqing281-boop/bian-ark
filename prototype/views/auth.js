/* V0 登录注册屏（屏01 · 第一屏 · 登录即注册）
 * 契约：docs/08 §3.0——request-code（60s 限频/devCode 回填）→ verify（自动建号 + Cookie 会话）→ 进纪念馆首页 */
window.BianViews = window.BianViews || {};
window.BianViews.auth = {
  tab: null, // 无底部导航
  async init(root, ctx) {
    const A = window.BianApi;
    const $ = (s) => root.querySelector(s);
    let channel = "sms";

    const PH_RE = /^1\d{10}$/;
    const EM_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const target = $("#auth-target"), code = $("#auth-code"), send = $("#auth-send"), submit = $("#auth-submit");

    /* 通道切换：下划线态 + 清空输入 */
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
        else A.toast("没有发送成功，请再试一次");
      }
    };

    /* 进入彼岸：verify → 会话落 Cookie → 进首页 */
    submit.onclick = async () => {
      const v = target.value.trim(), c = code.value.trim();
      if (!v) return A.toast("先填" + (channel === "sms" ? "手机号" : "邮箱"));
      if (!/^\d{6}$/.test(c)) return A.toast("验证码是 6 位数字");
      submit.disabled = true;
      submit.textContent = "验证中…";
      const r = await A.verifyCode(channel, v, c);
      submit.disabled = false;
      submit.textContent = "进入彼岸";
      if (r.ok) { A.toast("欢迎回来"); ctx.go("home"); }
      else if (r.status === 400) A.toast("验证码不对，再看看");
      else if (r.status === 429) A.toast("错太多次了，15 分钟后再试");
      else A.toast("没有登录成功，请再试一次");
    };
    code.addEventListener("keydown", (e) => { if (e.key === "Enter") submit.onclick(); });

    /* 微信扫码（🟡 占位）/ 访客态 */
    $("#auth-wechat").onclick = () => A.toast("微信扫码登录即将开通，请先用验证码");
    $("#auth-guest").onclick = () => ctx.go("home");
  },
};
