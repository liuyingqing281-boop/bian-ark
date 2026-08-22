"use client";

import { useState } from "react";

// 为 TA 准备一份礼物：三步流（心愿 → 帮我写/帮我准备 → 收藏到纪念馆）
// 文案红线：不出现「AI 生图」字样；每日限量提示「明天再来」；失败明示「没有准备好，已退款」
const EMBER_SOFT = "#ffb35c";

type Step = 1 | 2 | 3;

export default function GiftFlow({
  memorialId,
  lang,
  memorialName,
}: {
  memorialId: string;
  lang: string;
  memorialName: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [like, setLike] = useState("");
  const [wish, setWish] = useState("");
  const [prompt, setPrompt] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [done, setDone] = useState(false);

  const fail = (msg: string) => {
    setHint(msg);
    setBusy(false);
  };

  // 第 1→2 步：帮我写（每日限量）
  const helpWrite = async () => {
    const idea = [like.trim(), wish.trim()].filter(Boolean).join("；");
    if (idea.length < 2) {
      setHint("先写一点想法，哪怕几个字也好");
      return;
    }
    setBusy(true);
    setHint("");
    try {
      const r = await fetch("/api/items/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.slice(0, 60) }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) return fail("请先登录后再准备礼物");
      if (r.status === 429) return fail("今天的名额用完了，明天再来");
      if (!r.ok || !d.prompt) return fail("没写好，再试一次");
      setPrompt(d.prompt);
      setStep(2);
    } catch {
      fail("网络不太稳定，再试一次");
    } finally {
      setBusy(false);
    }
  };

  // 第 2→3 步：帮我准备（幂等键防重复扣量）
  const [idemKey, setIdemKey] = useState(() => `gift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  const helpPrepare = async () => {
    if (prompt.trim().length < 2) {
      setHint("描述还太空，补充一点再准备");
      return;
    }
    setBusy(true);
    setHint("");
    try {
      const r = await fetch("/api/items/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idemKey },
        body: JSON.stringify({ prompt: prompt.trim().slice(0, 100) }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) return fail("请先登录后再准备礼物");
      if (r.status === 429) return fail("这个月的名额用完了，下个月再来");
      if (!r.ok || !Array.isArray(d.candidates) || !d.candidates.length) return fail("没有准备好，已退款。请再试一次");
      setCandidates(d.candidates);
      setSelected(d.candidates[0]);
      setStep(3);
    } catch {
      fail("没有准备好，已退款。请再试一次");
    } finally {
      setBusy(false);
    }
  };

  // 第 3 步：收藏到纪念馆
  const claim = async () => {
    if (!selected) return;
    setBusy(true);
    setHint("");
    try {
      const r = await fetch("/api/items/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: selected,
          prompt: prompt.trim().slice(0, 100),
          name: (wish.trim() || "一份特别的礼物").slice(0, 30),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) return fail("请先登录后再收藏");
      if (!r.ok || !d.ok) return fail("收藏没成功，再试一次");
      setDone(true);
    } catch {
      fail("收藏没成功，再试一次");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep(1);
    setLike("");
    setWish("");
    setPrompt("");
    setCandidates([]);
    setSelected("");
    setDone(false);
    setHint("");
    setIdemKey(`gift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  };

  const card = "rounded-3xl p-6";
  const cardStyle = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" } as const;
  const btnMain =
    "w-full h-[52px] rounded-full text-[15px] text-white transition active:opacity-85 disabled:opacity-40";
  const btnMainStyle = {
    background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
    boxShadow: "0 4px 16px rgba(244,93,18,.35)",
  } as const;
  const btnSub =
    "w-full h-11 rounded-full text-[14px] transition active:opacity-85 disabled:opacity-40";
  const btnSubStyle = { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" } as const;
  const inputStyle = {
    background: "rgba(0,0,0,.25)",
    border: "1px solid rgba(255,255,255,.1)",
    color: "#fff6ec",
  } as const;

  return (
    <div className="space-y-6">
      {/* 步骤指示 */}
      <div className="flex items-center justify-center gap-2 text-[12px]" style={{ color: "rgba(255,246,236,.4)" }}>
        {[1, 2, 3].map((s) => (
          <span key={s} className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={
                s === step
                  ? { background: "rgba(255,122,47,.2)", border: "1px solid rgba(255,179,92,.5)", color: EMBER_SOFT }
                  : { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }
              }
            >
              {s}
            </span>
            {s < 3 && <span className="w-6 h-px" style={{ background: "rgba(255,255,255,.15)" }} />}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className={card} style={cardStyle}>
          <label className="block text-[14px]" style={{ color: "rgba(255,246,236,.65)" }}>
            {memorialName} 生前最喜欢什么？
          </label>
          <textarea
            value={like}
            onChange={(e) => setLike(e.target.value.slice(0, 60))}
            placeholder="很喜欢喝茶"
            rows={2}
            className="mt-2 w-full rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[rgba(255,179,92,.5)]"
            style={inputStyle}
          />
          <label className="block mt-5 text-[14px]" style={{ color: "rgba(255,246,236,.65)" }}>
            你想送 TA 什么？
          </label>
          <textarea
            value={wish}
            onChange={(e) => setWish(e.target.value.slice(0, 60))}
            placeholder="一套特别的茶具"
            rows={2}
            className="mt-2 w-full rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[rgba(255,179,92,.5)]"
            style={inputStyle}
          />
          <button onClick={helpWrite} disabled={busy} className={`${btnMain} mt-6`} style={btnMainStyle}>
            {busy ? "正在写…" : "帮我写"}
          </button>
          <p className="mt-3 text-center text-[12px]" style={{ color: "rgba(255,246,236,.4)" }}>
            帮我写每日限量，用完请明天再来
          </p>
        </div>
      )}

      {step === 2 && (
        <div className={card} style={cardStyle}>
          <label className="block text-[14px]" style={{ color: "rgba(255,246,236,.65)" }}>
            礼物的样子（可修改）
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 100))}
            rows={4}
            className="mt-2 w-full rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[rgba(255,179,92,.5)]"
            style={inputStyle}
          />
          <button onClick={helpPrepare} disabled={busy} className={`${btnMain} mt-5`} style={btnMainStyle}>
            {busy ? "正在准备，可以先去做别的事…" : "帮我准备"}
          </button>
          <button onClick={() => setStep(1)} disabled={busy} className={`${btnSub} mt-3`} style={btnSubStyle}>
            返回上一步
          </button>
        </div>
      )}

      {step === 3 && !done && (
        <div className={card} style={cardStyle}>
          <p className="text-[14px] text-center" style={{ color: "rgba(255,246,236,.65)" }}>
            “这是我想送给你的。”
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {candidates.map((url) => (
              <button
                key={url}
                onClick={() => setSelected(url)}
                className="rounded-2xl overflow-hidden transition active:opacity-85"
                style={{
                  border: selected === url ? "2px solid rgba(255,179,92,.8)" : "2px solid rgba(255,255,255,.08)",
                  boxShadow: selected === url ? "0 0 20px rgba(255,122,47,.3)" : "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="准备好的礼物候选" className="w-full aspect-square object-cover" />
              </button>
            ))}
          </div>
          <button onClick={claim} disabled={busy || !selected} className={`${btnMain} mt-5`} style={btnMainStyle}>
            {busy ? "收藏中…" : "收藏到纪念馆"}
          </button>
          <button onClick={restart} disabled={busy} className={`${btnSub} mt-3`} style={btnSubStyle}>
            再准备一件
          </button>
        </div>
      )}

      {step === 3 && done && (
        <div className={`${card} text-center`} style={cardStyle}>
          <p className="text-4xl">🎁</p>
          <p className="mt-3 text-[15px]">已收藏到 TA 的纪念物</p>
          <p className="mt-1 text-[12px]" style={{ color: "rgba(255,246,236,.45)" }}>
            通过审核后会出现在纪念馆的供桌上
          </p>
          <a
            href={`/${lang}/hall/${memorialId}#memorial`}
            className={`${btnMain} mt-5 flex items-center justify-center`}
            style={btnMainStyle}
          >
            回到纪念馆看看
          </a>
          <button onClick={restart} className={`${btnSub} mt-3`} style={btnSubStyle}>
            再准备一件
          </button>
        </div>
      )}

      {hint && (
        <p className="text-center text-[13px]" style={{ color: "#e08070" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
