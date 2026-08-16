"use client";

import { useState, useRef, useEffect } from "react";

interface LoginFormProps {
  lang: string;
  next: string;
  labels: Record<string, string>;
}

export default function LoginForm({ lang, next, labels }: LoginFormProps) {
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (sent && codeRef.current) codeRef.current.focus(); }, [sent]);
  async function requestCode() {
    setBusy(true);
    setError("");
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

  async function verify() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, target, code, name }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.href = next || `/${lang}/me`;
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || labels.failed);
    }
  }

  return (
    <div className="ui-panel space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setChannel("email")}
          className={`ui-button flex-1 px-4 py-2 text-sm transition ${
            channel === "email" ? "bg-amber-700 text-amber-100" : "bg-stone-800 text-stone-400 hover:text-stone-200"
          }`}
        >
          {labels.emailTab}
        </button>
        <button
          type="button"
          onClick={() => setChannel("sms")}
          className={`ui-button flex-1 px-4 py-2 text-sm transition ${
            channel === "sms" ? "bg-amber-700 text-amber-100" : "bg-stone-800 text-stone-400 hover:text-stone-200"
          }`}
        >
          {labels.phoneTab}
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={channel === "email" ? labels.emailPlaceholder : labels.phonePlaceholder}
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
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/D/g, "").slice(0, 6))}
        placeholder={labels.codePlaceholder}
        maxLength={6}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
        className="ui-control w-full px-4 py-2 text-sm placeholder-stone-600"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={labels.namePlaceholder}
        maxLength={32}
        className="ui-control w-full px-4 py-2 text-sm placeholder-stone-600"
      />

      {error && <p key={shakeKey} className="ui-status-error animate-shake">{error}</p>}

      <button
        type="button"
        onClick={verify}
        disabled={busy || code.length !== 6 || !target}
        className="ui-button ui-button-primary w-full px-4 py-2"
      >
        {labels.verify}
      </button>

      <button
        type="button"
        disabled
        className="w-full px-4 py-2 bg-stone-800 text-stone-600 rounded-lg text-sm cursor-not-allowed"
      >
        {labels.wechat}
      </button>
    </div>
  );
}
