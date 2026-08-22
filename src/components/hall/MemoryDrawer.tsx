"use client";

import { useState, useEffect, useRef } from "react";

// ============================================================
// 添加记忆抽屉（记忆档案页 + HallChat 共用）
// 流程：选分区 → 录入 → 保存 → POST /api/memories → toast
// ============================================================

export type Section = "personality" | "relation" | "likes" | "speech" | "profile";

export interface MemorySection {
  key: Section;
  icon: string;
  label: string;
  sublabel: string;
}

export const SECTIONS: MemorySection[] = [
  { key: "personality", icon: "👤", label: "TA 是怎样的人", sublabel: "温和、幽默、喜欢喝茶……" },
  { key: "relation",   icon: "❤️", label: "我和 TA",       sublabel: "我们一起去过青岛看海……" },
  { key: "likes",      icon: "🎵", label: "TA 喜欢什么",    sublabel: "京剧、茶、钓鱼……" },
  { key: "speech",     icon: "💬", label: "TA 怎么说话",    sublabel: "慢慢来，不着急……" },
  { key: "profile",    icon: "📄", label: "基础资料",        sublabel: "姓名、年代、职业……" },
];

const MAX_LEN = 500;

interface Props {
  memorialId: string;
  open: boolean;
  onClose: () => void;
  initialSection?: Section;
  onSaved?: (section: Section) => void; // 成功后回调，可刷新列表
  isChat?: boolean; // true = 对话页触发，标题不同
}

export default function MemoryDrawer({ memorialId, open, onClose, initialSection, onSaved, isChat }: Props) {
  const [section, setSection] = useState<Section>(initialSection ?? "personality");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [maskOpen, setMaskOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 打开时重置
  useEffect(() => {
    if (open) {
      setSection(initialSection ?? "personality");
      setDraft("");
      setMaskOpen(true);
    } else {
      // 动画关闭
      setMaskOpen(false);
    }
  }, [open, initialSection]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const save = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memorial_id: memorialId, section, content: text }),
      });
      if (res.ok) {
        showToast(isChat ? "已添加进 TA 的记忆" : "已添加记忆");
        onSaved?.(section);
        setDraft("");
        setTimeout(() => onClose(), 600);
      } else {
        showToast("保存失败，请重试");
      }
    } catch {
      showToast("网络异常，请重试");
    }
    setBusy(false);
  };

  const empty = !draft.trim();
  const overLimit = draft.length > MAX_LEN;

  if (!maskOpen && !open) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,.55)",
          backdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* 抽屉 */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 transition-transform duration-300"
        style={{
          background: "#150806",
          border: "1px solid rgba(255,255,255,.09)",
          borderBottom: "none",
          borderRadius: "26px 26px 0 0",
          padding: "22px 22px 34px",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transitionTimingFunction: "cubic-bezier(.32,1.5,.48,1)",
        }}
      >
        {/* 抓柄 */}
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "rgba(255,255,255,.18)" }} />

        <h3
          className="text-center tracking-wider mb-5"
          style={{ fontFamily: "'Noto Serif SC','Songti SC',serif", fontSize: "18px", color: "#fff6ec" }}
        >
          {isChat ? "添加一段关于 TA 的记忆" : "添加记忆"}
        </h3>

        {/* 分区选择 */}
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className="rounded-full px-3.5 py-1.5 text-[13px] transition-all"
              style={{
                background: section === s.key ? "rgba(255,122,47,.12)" : "rgba(255,255,255,.05)",
                border: `1px solid ${section === s.key ? "rgba(255,179,92,.55)" : "rgba(255,255,255,.09)"}`,
                color: section === s.key ? "#ffb35c" : "rgba(255,246,236,.6)",
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* 文本区 */}
        <div
          className="mt-4 rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
        >
          <textarea
            ref={textareaRef}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`写下${SECTIONS.find((s) => s.key === section)?.label ?? "这段记忆"}……`}
            className="w-full bg-transparent outline-none resize-none text-[15px] placeholder:text-[rgba(255,246,236,.35)]"
            style={{
              color: "#fff6ec",
              ...(overLimit ? { color: "#ff9090" } : {}),
            }}
          />
        </div>

        {/* 字数 */}
        <div className="flex items-center justify-between mt-2">
          <span
            className="text-[11px]"
            style={{ color: overLimit ? "#e0604f" : "rgba(255,246,236,.38)" }}
          >
            {overLimit ? `超过 ${draft.length - MAX_LEN} 字` : ""}
          </span>
          <span className="text-[11px]" style={{ color: "rgba(255,246,236,.38)" }}>
            {draft.length}/{MAX_LEN}
          </span>
        </div>

        {/* 保存 */}
        <button
          onClick={save}
          disabled={empty || overLimit || busy}
          className="mt-4 w-full h-14 rounded-full text-[16px] font-semibold tracking-widest text-white transition-all active:opacity-85 disabled:opacity-35"
          style={{
            background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
            boxShadow: "0 8px 28px rgba(244,93,18,.45)",
          }}
        >
          {busy ? "保存中…" : "保 存"}
        </button>

        <p className="text-center text-[11px] mt-3" style={{ color: "rgba(255,246,236,.38)" }}>
          保存后将出现在「{SECTIONS.find((s) => s.key === section)?.icon} {SECTIONS.find((s) => s.key === section)?.label}」分区
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-32 z-[60] px-5 py-2 rounded-full text-[13px] text-white animate-pulse"
          style={{ background: "rgba(43,43,43,.92)", letterSpacing: "0.05em" }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
