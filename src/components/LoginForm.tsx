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

export default function LoginForm({ lang, next, labels, wechatError }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>(
    wechatError === "wechat_not_registered" ? "register" : "login"
  );
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
  const [shakeKey, setShakeKey] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sent && codeRef.current) codeRef.current.focus();
  }, [sent]);
  useEffect(() => {
    if (wechatError === "wechat_not_registered") setError(labels.wechatNotRegistered || "");
    else if (wechatError === "wechat_already_registered") setError(labels.wechatAlreadyRegistered || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setSwitchHint(null);
    setError("");
    setAgreed(false);
    setSent(false);
    setDevCode("");
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
      setError(data.error || labels.failed); setShakeKey(k => k + 1);
    }
  }

  function applyError(err: string) {
    if (err === "account_not_found") {
      setError(labels.notRegistered);
      setSwitchHint("register");
    } else if (err === "already_registered") {
      setError(labels.alreadyRegistered);
      setSwitchHint("login");
    } else if (err === "agreement_required") {
      setError(labels.agreementRequired);
    } else if (err === "wechat_not_configured") {
      setError(labels.wechatNotReady);
    } else {
      setError(labels.failed);
    }
    setShakeKey(k => k + 1);
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
          ? { channel, target, code, intent: "register", name, agreed }
          : { channel, target, code, intent: "login" }
      ),
    });
    setBusy(false);
    if (res.ok) {
      window.location.href = next || `/${lang}/me`;
    } else {
      const data = await res.json().catch(() => ({}));
      applyError(data.error || "");
    }
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

  const canSubmit = target && code.length === 6 && (mode === "login" || agreed) && !busy;

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

      {/* 手机/邮箱通道切换（两 tab 同构平级） */}
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={channel === "email" ? labels.emailPlaceholder : labels.phonePlaceholder}
          inputMode={channel === "email" ? "email" : "tel"}
          className="ui-control min-w-0 flex-1 px-4 py-2 text-sm placeholder-stone-600"
          onKeyDown={e => e.key === "Enter" && target && requestCode()}
        />
        <button
          type="button"
          onClick={requestCode}
          disabled={busy || !target}
          className="ui-button w-full whitespace-nowrap bg-stone-700 px-4 py-2 text-stone-200 hover:bg-stone-600 sm:w-auto"
        >
          {labels.sendCode}
        </button>
      </div>

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
        onKeyDown={(e) => e.key === "Enter" && canSubmit && verify()}
        className="ui-control w-full px-4 py-2 text-sm placeholder-stone-600"
      />

      {/* 注册 tab 专属：昵称 + 协议勾选 */}
      {mode === "register" && (
        <>
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
        </p>
      )}

      <button
        type="button"
        onClick={verify}
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
