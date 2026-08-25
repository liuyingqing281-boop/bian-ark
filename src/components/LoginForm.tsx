"use client";

import { useState, useRef, useEffect } from "react";

interface LoginFormProps {
  lang: string;
  next: string;
  labels: Record<string, string>;
  wechatError?: string;
}

type Mode = "login" | "register";
type Channel = "sms" | "email";
type LoginMethod = "password" | "code"; // 2026-08-25 拍板：登录两式平级，默认密码（web/01 §9.5）

const PHONE_RE = /^1\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 密码规则与 lib/password.ts 同规：8–64 位、四类字符≥3 类、无空白
function validPassword(pw: string): boolean {
  if (pw.length < 8 || pw.length > 64 || /\s/.test(pw)) return false;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  return classes >= 3;
}

function detectChannel(v: string): Channel | null {
  if (PHONE_RE.test(v)) return "sms";
  if (EMAIL_RE.test(v)) return "email";
  return null;
}

// 👁 显隐切换（需求拍板）：密文=划斜线的眼睛，明文=眼睛
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.8A10.9 10.9 0 0 1 12 5.5c6.5 0 10 6.5 10 6.5a17.9 17.9 0 0 1-3.2 3.9M6.6 7.3A17.6 17.6 0 0 0 2 12s3.5 6.5 10 6.5c1.2 0 2.3-.2 3.3-.6" />
      <path d="M9.9 9.9a2.9 2.9 0 0 0 4.1 4.1" />
    </svg>
  );
}

export default function LoginForm({ lang, next, labels, wechatError }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>(
    wechatError === "wechat_not_registered" ? "register" : "login"
  );
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [channel, setChannel] = useState<Channel>("sms");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [switchHint, setSwitchHint] = useState<"register" | "login" | null>(null);
  const [pwNotSet, setPwNotSet] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // 注册：密码/确认密码两行（👁 显隐）；登录·密码方式：单密码行
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);

  // 忘记密码三步浮层（卡内切换，URL 不变）：1 账号发码 → 2 验码+新密码 → 3 完成回登录
  const [resetStep, setResetStep] = useState(0);
  const [resetAccount, setResetAccount] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetDevCode, setResetDevCode] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [resetNew, setResetNew] = useState("");
  const [showResetNew, setShowResetNew] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetShake, setResetShake] = useState(0);

  useEffect(() => {
    if (sent && codeRef.current) codeRef.current.focus();
  }, [sent]);
  useEffect(() => {
    if (wechatError === "wechat_not_registered") setError(labels.wechatNotRegistered || "");
    else if (wechatError === "wechat_already_registered") setError(labels.wechatAlreadyRegistered || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setTimeout(() => setResetCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resetCooldown]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setSwitchHint(null);
    setError("");
    setPwNotSet(false);
    setAgreed(false);
    setSent(false);
    setDevCode("");
    setPassword("");
    setConfirm("");
    setLoginPassword("");
    setRegisterDone(false);
  }

  function switchMethod(method: LoginMethod) {
    setLoginMethod(method);
    setError("");
    setPwNotSet(false);
    setSwitchHint(null);
    setTarget("");
    setCode("");
    setSent(false);
    setDevCode("");
    setLoginPassword("");
  }

  async function requestCode() {
    setBusy(true);
    setError("");
    setSwitchHint(null);
    const res = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, target }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setSent(true);
      if (data.devCode) setDevCode(data.devCode);
    } else {
      setError(data.error === "too_frequent" ? labels.tooManyAttempts : data.error || labels.failed);
      setShakeKey(k => k + 1);
    }
  }

  function applyError(err: string) {
    setPwNotSet(false);
    if (err === "account_not_found") {
      setError(labels.notRegistered);
      setSwitchHint("register");
    } else if (err === "already_registered") {
      setError(labels.alreadyRegistered);
      setSwitchHint("login");
    } else if (err === "agreement_required") {
      setError(labels.agreementRequired);
    } else if (err === "invalid_code") {
      setError(labels.invalidCode);
    } else if (err === "invalid_credentials") {
      setError(labels.invalidCredentials);
    } else if (err === "password_not_set") {
      setError(labels.passwordNotSet);
      setPwNotSet(true);
    } else if (err === "too_many_attempts") {
      setError(labels.tooManyAttempts);
    } else if (err === "weak_password") {
      setError(labels.passwordRule);
    } else if (err === "wechat_not_configured") {
      setError(labels.wechatNotReady);
    } else {
      setError(labels.failed);
    }
    setShakeKey(k => k + 1);
  }

  function redirectToApp() {
    window.location.href = next || `/${lang}/me`;
  }

  // 登录·密码方式：注册后的手机号/邮箱即账号，channel 前端自动判定
  async function loginByPassword() {
    const ch = detectChannel(target.trim());
    if (!ch) {
      // 手机号/邮箱格式都不符：提示重填（服务端同规则兜底 invalid_phone/invalid_email）
      setError(labels.accountPlaceholder);
      setShakeKey(k => k + 1);
      return;
    }
    setBusy(true);
    setError("");
    setSwitchHint(null);
    const res = await fetch("/api/auth/login-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: ch, target: target.trim(), password: loginPassword }),
    });
    setBusy(false);
    if (res.ok) {
      redirectToApp();
    } else {
      const data = await res.json().catch(() => ({}));
      applyError(data.error || "");
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    setSwitchHint(null);
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "register"
          ? { channel, target, code, intent: "register", password, name, agreed }
          : { channel, target, code, intent: "login" }
      ),
    });
    setBusy(false);
    if (res.ok) {
      if (mode === "register") {
        // 注册成功：toast「注册成功」+ 一次性弱提示「账号与密码请妥善保管」，随即自动登录进首页
        setRegisterDone(true);
        setTimeout(redirectToApp, 1000);
      } else {
        redirectToApp();
      }
    } else {
      const data = await res.json().catch(() => ({}));
      applyError(data.error || "");
    }
  }

  function submit() {
    if (mode === "login" && loginMethod === "password") loginByPassword();
    else verify();
  }

  async function wechat() {
    if (mode === "register" && !agreed) {
      setError(labels.agreementRequired);
      setShakeKey(k => k + 1);
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/wechat/qrcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: mode }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.url) {
      window.location.href = data.url;
    } else {
      applyError(data.error || "");
    }
  }

  /* ---------- 忘记密码三步流 ---------- */

  function startReset() {
    setResetStep(1);
    setResetAccount(target); // 回填登录 tab 已输入的账号
    setResetError("");
    setResetCode("");
    setResetNew("");
    setResetConfirm("");
    setResetSent(false);
    setResetDevCode("");
  }

  async function resetSend() {
    const v = resetAccount.trim();
    const ch = detectChannel(v);
    if (!ch) {
      setResetError(labels.accountPlaceholder);
      setResetShake(k => k + 1);
      return;
    }
    setResetBusy(true);
    setResetError("");
    const res = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: ch, target: v }),
    });
    const data = await res.json().catch(() => ({}));
    setResetBusy(false);
    if (res.ok) {
      setResetSent(true);
      setResetCooldown(60);
      if (data.devCode) {
        setResetDevCode(data.devCode);
        setResetCode(data.devCode);
      }
      setResetStep(2);
    } else if (res.status === 429) {
      setResetError(labels.tooManyAttempts);
      setResetShake(k => k + 1);
    } else {
      setResetError(labels.failed);
      setResetShake(k => k + 1);
    }
  }

  async function resetSubmit() {
    const v = resetAccount.trim();
    const ch = detectChannel(v);
    if (!ch) {
      setResetError(labels.accountPlaceholder);
      setResetShake(k => k + 1);
      return;
    }
    if (!validPassword(resetNew) || resetNew !== resetConfirm) {
      setResetError(resetNew !== resetConfirm ? labels.passwordMismatch : labels.passwordRule);
      setResetShake(k => k + 1);
      return;
    }
    setResetBusy(true);
    setResetError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: ch, target: v, code: resetCode, password: resetNew }),
    });
    const data = await res.json().catch(() => ({}));
    setResetBusy(false);
    if (res.ok) {
      setResetStep(3);
    } else if (data.error === "account_not_found") {
      setResetError(labels.notRegistered);
      setResetShake(k => k + 1);
    } else {
      applyResetApiError(data.error || "");
    }
  }

  function applyResetApiError(err: string) {
    if (err === "invalid_code") setResetError(labels.invalidCode);
    else if (err === "weak_password") setResetError(labels.passwordRule);
    else if (err === "too_many_attempts") setResetError(labels.tooManyAttempts);
    else setResetError(labels.failed);
    setResetShake(k => k + 1);
  }

  function resetFinish() {
    // 完成态【去登录】：切回登录 tab·密码方式并回填账号
    setResetStep(0);
    setMode("login");
    setLoginMethod("password");
    setTarget(resetAccount.trim());
    setLoginPassword("");
    setError("");
  }

  const pwValid = validPassword(password);
  const confirmMismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    !busy && !registerDone
      ? mode === "register"
        ? Boolean(target) && code.length === 6 && agreed && pwValid && password === confirm
        : loginMethod === "password"
        ? Boolean(target.trim()) && loginPassword.length > 0
        : Boolean(target) && code.length === 6
      : false;

  /* ---------- 忘记密码浮层（resetStep 1–3 时替换主表单） ---------- */
  if (resetStep > 0) {
    return (
      <div className="space-y-4">
        <p className="text-center text-[15px] tracking-[0.2em] text-[#d8a95c]">{labels.resetTitle}</p>
        <button
          type="button"
          onClick={() => setResetStep(0)}
          className="text-xs text-stone-400 underline hover:text-stone-200"
        >
          {labels.backToLogin}
        </button>

        {resetStep === 1 && (
          <>
            <p className="text-xs text-stone-400">{labels.resetStep1Hint}</p>
            <input
              value={resetAccount}
              onChange={(e) => setResetAccount(e.target.value)}
              placeholder={labels.accountPlaceholder}
              onKeyDown={(e) => e.key === "Enter" && resetAccount.trim() && resetSend()}
              className="ui-control w-full px-4 py-2 text-sm placeholder-stone-600"
            />
            {resetError && (
              <p key={resetShake} className="ui-status-error animate-shake">{resetError}</p>
            )}
            <button
              type="button"
              onClick={resetSend}
              disabled={resetBusy || !resetAccount.trim()}
              className="ui-button ui-button-primary w-full px-4 py-2"
            >
              {labels.resetSendCode}
            </button>
          </>
        )}

        {resetStep === 2 && (
          <>
            <input
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={labels.codePlaceholder}
              maxLength={6}
              inputMode="numeric"
              className="ui-control w-full px-4 py-2 text-sm placeholder-stone-600"
            />
            {resetSent && resetDevCode && (
              <p className="text-xs text-amber-500">{labels.devCode.replace("{code}", resetDevCode)}</p>
            )}
            <div className="relative">
              <input
                type={showResetNew ? "text" : "password"}
                value={resetNew}
                onChange={(e) => setResetNew(e.target.value)}
                placeholder={labels.passwordPlaceholder}
                maxLength={64}
                autoComplete="new-password"
                className="ui-control w-full px-4 py-2 pr-10 text-sm placeholder-stone-600"
              />
              <button
                type="button"
                onClick={() => setShowResetNew(s => !s)}
                aria-label="toggle"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-200"
              >
                {showResetNew ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            <div className="relative">
              <input
                type={showResetConfirm ? "text" : "password"}
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder={labels.confirmPlaceholder}
                maxLength={64}
                autoComplete="new-password"
                className="ui-control w-full px-4 py-2 pr-10 text-sm placeholder-stone-600"
              />
              <button
                type="button"
                onClick={() => setShowResetConfirm(s => !s)}
                aria-label="toggle"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-200"
              >
                {showResetConfirm ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            <p className="text-xs text-stone-500">{labels.passwordRule}</p>
            {resetError && (
              <p key={resetShake} className="ui-status-error animate-shake">{resetError}</p>
            )}
            <button
              type="button"
              onClick={resetSubmit}
              disabled={resetBusy || resetCode.length !== 6 || !resetNew}
              className="ui-button ui-button-primary w-full px-4 py-2"
            >
              {labels.resetCta}
            </button>
          </>
        )}

        {resetStep === 3 && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-sm text-emerald-400">{labels.resetSuccess}</p>
            <p className="text-xs text-stone-400">{labels.resetDone}</p>
            <button
              type="button"
              onClick={resetFinish}
              className="ui-button ui-button-primary w-full px-4 py-2"
            >
              {labels.resetDoneCta}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ---------- 主表单：登录（密码/验证码两式）+ 注册 ---------- */
  return (
    <div className="space-y-4">
      <p className="text-center text-[15px] tracking-[0.2em] text-[#d8a95c]">
        {mode === "login" ? labels.title : labels.registerTitle}
      </p>

      {/* 登录/注册双 tab（2026-08-24 拍板：默认登录，注册专门点击） */}
      <div className="flex gap-8 border-b border-stone-700/60">
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`px-1 pb-2 text-sm transition ${
              mode === m
                ? "border-b-2 border-amber-500 text-amber-200"
                : "border-b-2 border-transparent text-stone-400 hover:text-stone-200"
            }`}
          >
            {m === "login" ? labels.loginTab : labels.registerTab}
          </button>
        ))}
      </div>

      {/* 登录·方式切换（2026-08-25 拍板：密码默认，验证码方式保留，两式平级） */}
      {mode === "login" && (
        <div className="flex gap-6">
          {(["password", "code"] as LoginMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMethod(m)}
              className={`px-0 pb-1 text-sm transition ${
                loginMethod === m
                  ? "border-b-2 border-amber-500 text-amber-200"
                  : "border-b-2 border-transparent text-stone-400 hover:text-stone-200"
              }`}
            >
              {m === "password" ? labels.passwordTab : labels.codeTab}
            </button>
          ))}
        </div>
      )}

      {/* 通道切换：注册 tab 与 登录·验证码方式（登录·密码方式单账号框自动识别，不展示） */}
      {(mode === "register" || loginMethod === "code") && (
        <div className="flex gap-6">
          {(["sms", "email"] as Channel[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setChannel(c); setTarget(""); setCode(""); setSent(false); setDevCode(""); }}
              className={`px-0 pb-1 text-sm transition ${
                channel === c
                  ? "border-b-2 border-amber-500 text-amber-200"
                  : "border-b-2 border-transparent text-stone-400 hover:text-stone-200"
              }`}
            >
              {c === "sms" ? labels.phoneTab : labels.emailTab}
            </button>
          ))}
        </div>
      )}

      {/* 账号输入：密码方式=手机号/邮箱自动识别；验证码/注册=按通道 */}
      <div className={(mode === "login" && loginMethod === "code") ? "flex flex-col gap-2 sm:flex-row" : ""}>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={
            mode === "login" && loginMethod === "password"
              ? labels.accountPlaceholder
              : channel === "email"
              ? labels.emailPlaceholder
              : labels.phonePlaceholder
          }
          inputMode={
            mode === "login" && loginMethod === "password"
              ? "text"
              : channel === "email"
              ? "email"
              : "tel"
          }
          className="ui-control min-w-0 flex-1 px-4 py-2 text-sm placeholder-stone-600"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (mode === "login" && loginMethod === "password" && target.trim() && loginPassword) submit();
            else if (target) requestCode();
          }}
        />
        {(mode === "register" || loginMethod === "code") && (
          <button
            type="button"
            onClick={requestCode}
            disabled={busy || !target}
            className="ui-button w-full whitespace-nowrap bg-stone-700 px-4 py-2 text-stone-200 hover:bg-stone-600 sm:w-auto"
          >
            {labels.sendCode}
          </button>
        )}
      </div>

      {/* 验证码行（验证码方式 + 注册） */}
      {mode === "register" || loginMethod === "code" ? (
        <>
          {sent && (
            <p className="text-xs text-emerald-500">
              {labels.codeSent}
              {devCode && (
                <span className="ml-2 text-amber-500">{labels.devCode.replace("{code}", devCode)}</span>
              )}
            </p>
          )}
          <input
            ref={codeRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={labels.codePlaceholder}
            maxLength={6}
            inputMode="numeric"
            onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
            className="ui-control w-full px-4 py-2 text-sm placeholder-stone-600"
          />
        </>
      ) : (
        <>
          <div className="relative">
            <input
              type={showLoginPassword ? "text" : "password"}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder={labels.passwordPlaceholder}
              maxLength={64}
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && target.trim() && loginPassword && submit()}
              className="ui-control w-full px-4 py-2 pr-10 text-sm placeholder-stone-600"
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword(s => !s)}
              aria-label="toggle"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-200"
            >
              {showLoginPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
          <p className="text-right">
            <button
              type="button"
              onClick={startReset}
              className="text-xs text-stone-400 underline hover:text-stone-200"
            >
              {labels.forgotPassword}
            </button>
          </p>
        </>
      )}

      {/* 注册 tab 专属：密码/确认密码两行 + 昵称 + 协议勾选 */}
      {mode === "register" && (
        <>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={labels.passwordPlaceholder}
              maxLength={64}
              autoComplete="new-password"
              className="ui-control w-full px-4 py-2 pr-10 text-sm placeholder-stone-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              aria-label="toggle"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-200"
            >
              {showPassword ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={labels.confirmPlaceholder}
              maxLength={64}
              autoComplete="new-password"
              className="ui-control w-full px-4 py-2 pr-10 text-sm placeholder-stone-600"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(s => !s)}
              aria-label="toggle"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-200"
            >
              {showConfirm ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          </div>
          <p className={`text-xs ${password && !pwValid ? "text-red-400" : confirmMismatch ? "text-red-400" : "text-stone-500"}`}>
            {confirmMismatch ? labels.passwordMismatch : labels.passwordRule}
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.namePlaceholder}
            maxLength={20}
            className="ui-control w-full px-4 py-2 text-sm placeholder-stone-600"
          />
          <label className="flex items-start gap-2 text-xs leading-relaxed text-stone-400">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-amber-600"
            />
            <span>
              {labels.agreement}
              <a href={`/${lang}/legal/terms`} className="underline hover:text-stone-200">{labels.terms}</a>
              <a href={`/${lang}/legal/privacy`} className="underline hover:text-stone-200">{labels.privacy}</a>
            </span>
          </label>
        </>
      )}

      {registerDone && (
        <p className="text-sm text-emerald-400">
          {labels.registerSuccess}
          <span className="ml-2 text-xs text-stone-500">{labels.keepCredentials}</span>
        </p>
      )}

      {error && (
        <p key={shakeKey} className="ui-status-error animate-shake flex flex-wrap items-center gap-2">
          {error}
          {switchHint && (
            <button
              type="button"
              onClick={() => switchMode(switchHint)}
              className="underline text-amber-400 hover:text-amber-300"
            >
              {switchHint === "register" ? labels.goRegister : labels.goLogin}
            </button>
          )}
          {pwNotSet && (
            <>
              <button
                type="button"
                onClick={() => switchMethod("code")}
                className="underline text-amber-400 hover:text-amber-300"
              >
                {labels.codeLoginLink}
              </button>
              <button
                type="button"
                onClick={startReset}
                className="underline text-amber-400 hover:text-amber-300"
              >
                {labels.forgotPassword}
              </button>
            </>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="ui-button ui-button-primary w-full px-4 py-2"
      >
        {mode === "login" ? labels.loginCta : labels.registerCta}
      </button>

      <button
        type="button"
        onClick={wechat}
        disabled={busy || (mode === "register" && !agreed)}
        className="ui-button w-full px-4 py-2 bg-stone-800 text-stone-300 hover:bg-stone-700"
      >
        {mode === "login" ? labels.wechatLogin : labels.wechatRegister}
      </button>

      <p className="text-center">
        <a href={`/${lang}`} className="text-xs text-stone-500 underline hover:text-stone-300">
          {labels.guest}
        </a>
      </p>
    </div>
  );
}
