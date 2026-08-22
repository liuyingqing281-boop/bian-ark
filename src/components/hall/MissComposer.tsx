"use client";

import { useState, useRef } from "react";

// ============================================================
// 想念页留言组件
// 类型：留言(public) / 悄悄话(private) / 悼文(eulogy)
// POST /api/messages → toast「已留下」
// ============================================================

type MsgType = "public" | "private" | "eulogy";

const TYPE_OPTIONS: { key: MsgType; icon: string; label: string; hint: string }[] = [
  { key: "public",  icon: "💬", label: "留言", hint: "公开可见" },
  { key: "private", icon: "🔒", label: "悄悄话", hint: "仅自己可见" },
  { key: "eulogy",  icon: "🕯️", label: "悼文", hint: "馆内置顶" },
];

const MAX_LEN = 500;

interface Props {
  memorialId: string;
  onPosted?: () => void; // 成功后刷新列表
}

export default function MissComposer({ memorialId, onPosted }: Props) {
  const [msgType, setMsgType] = useState<MsgType>("public");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memorial_id: memorialId, msg_type: msgType, content: text }),
      });
      if (res.ok) {
        setDraft("");
        showToast("已留下");
        onPosted?.();
      } else {
        const body = await res.json().catch(() => ({}));
        showToast((body as { error?: string }).error || "提交失败，请重试");
      }
    } catch {
      showToast("网络异常，请重试");
    }
    setBusy(false);
  };

  const empty = !draft.trim();
  const overLimit = draft.length > MAX_LEN;

  return (
    <div className="relative">
      {/* 类型选择 */}
      <div className="flex gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setMsgType(opt.key)}
            className="rounded-full px-3.5 py-1.5 text-[13px] transition-all flex items-center gap-1.5"
            style={{
              background: msgType === opt.key ? "rgba(255,122,47,.12)" : "rgba(255,255,255,.05)",
              border: `1px solid ${msgType === opt.key ? "rgba(255,179,92,.55)" : "rgba(255,255,255,.09)"}`,
              color: msgType === opt.key ? "#ffb35c" : "rgba(255,246,236,.6)",
            }}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {/* 说明 */}
      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "rgba(255,246,236,.38)" }}>
        {TYPE_OPTIONS.find((o) => o.key === msgType)?.hint}
        {msgType === "eulogy" && " · 将出现在纪念馆显眼位置"}
      </p>

      {/* 文本区 */}
      <div
        className="mt-3 rounded-2xl p-4"
        style={{
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.09)",
          ...(empty && draft.length === 0 ? { opacity: 0.6 } : {}),
        }}
      >
        <textarea
          ref={textareaRef}
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="写下想对 TA 说的话……"
          className="w-full bg-transparent outline-none resize-none text-[15px] placeholder:text-[rgba(255,246,236,.35)]"
          style={{
            color: "#fff6ec",
            ...(overLimit ? { color: "#ff9090" } : {}),
          }}
        />
      </div>

      {/* 字数 */}
      <div className="flex items-center justify-between mt-1">
        <span
          className="text-[11px]"
          style={{ color: overLimit ? "#e0604f" : "rgba(255,246,236,.38)" }}
        >
          {overLimit ? `超过 ${draft.length - MAX_LEN} 字` : ""}
        </span>
        <span
          className="text-[11px]"
          style={{ color: overLimit ? "#e0604f" : "rgba(255,246,236,.38)" }}
        >
          {draft.length}/{MAX_LEN}
        </span>
      </div>

      {/* 提交 */}
      <button
        onClick={submit}
        disabled={empty || overLimit || busy}
        className="mt-4 w-full h-14 rounded-full text-[16px] font-semibold tracking-widest text-white transition-all active:opacity-85 disabled:opacity-35"
        style={{
          background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
          boxShadow: "0 8px 28px rgba(244,93,18,.45)",
        }}
      >
        {busy ? "提交中…" : "提 交"}
      </button>

      {/* Toast */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-32 z-[60] px-5 py-2 rounded-full text-[13px] text-white"
          style={{ background: "rgba(43,43,43,.92)", letterSpacing: "0.05em" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
