"use client";

// PC 端「和 TA 说说话」入口：唤起右侧可收起对话侧板（M3）
// 移动端隐藏（侧板只在 ≥768px 启用，见 globals.css .pc-chat-strip）
import { requestPcChat } from "../../lib/useChatPanel";

export default function PcChatButton() {
  return (
    <button
      type="button"
      onClick={() => requestPcChat()}
      className="hidden md:flex flex-1 h-11 rounded-full items-center justify-center gap-2 text-[14px] transition active:opacity-85"
      style={{
        background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
        boxShadow: "0 4px 16px rgba(244,93,18,.35)",
        color: "#fff",
      }}
    >
      🕯️ 和 TA 说说话
    </button>
  );
}
