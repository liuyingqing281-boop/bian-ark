"use client";

import { useChatPanel } from "../../lib/useChatPanel";
import { usePcChatContext } from "../../lib/pcChatContext";
import ChatIntroDialog from "./ChatIntroDialog";
import HallChat from "../hall/HallChat";

/**
 * PC 对话侧板（M2）：覆盖式 360px，收起为右缘 56px 竖条。
 * - 首次打开必经身份说明弹层（ChatIntroDialog，文案逐字，无 × / 遮罩不可关 / 无 Esc）
 * - 对话区复用 HallChat（POST /api/hall/chat，含 evidence 依据、askMemory 补充记忆闭环、推测角标）
 * - 对话对象由当前页面通过 RegisterPcChat 注册；无上下文时显示引导空态
 * - 状态记忆 localStorage（pc.chat.open / pc.chat.intro），Esc 收起
 */
export default function PcChatPanel({ lang }: { lang: string }) {
  const zh = lang === "zh";
  const { open, showIntro, requestOpen, confirmIntro, close } = useChatPanel();
  const ctx = usePcChatContext((s) => s.ctx);

  return (
    <>
      {/* 收起态：右缘 56px 竖条 */}
      {!open && (
        <button
          type="button"
          className="pc-chat-strip"
          onClick={requestOpen}
          title={zh ? "和 TA 说说话" : "Talk to them"}
          aria-label={zh ? "展开对话侧板" : "Open chat panel"}
        >
          <span aria-hidden>💬</span>
          <span className="vert" style={{ fontFamily: "var(--font-serif)" }}>
            {zh ? "和 TA 说说话" : "Chat"}
          </span>
        </button>
      )}

      {/* 展开态：360px 覆盖式侧板 */}
      <aside className={`pc-chat-panel${open ? "" : " collapsed"}`} aria-hidden={!open} aria-label={zh ? "和 TA 说说话" : "Chat"}>
        {/* 收起按钮悬浮于 HallChat 顶栏右侧 */}
        <button
          type="button"
          onClick={close}
          title={zh ? "收起（Esc）" : "Collapse (Esc)"}
          aria-label={zh ? "收起对话侧板" : "Collapse chat panel"}
          className="absolute right-3 top-3 z-10 w-9 h-9 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-200 border border-stone-700/60 bg-stone-900/70 backdrop-blur transition"
        >
          ›
        </button>

        {ctx ? (
          <div className="flex-1 min-h-0 p-3">
            <HallChat
              memorialId={ctx.memorialId}
              memorialName={ctx.memorialName}
              avatarUrl={ctx.avatarUrl}
              skipIntro
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="text-3xl" aria-hidden>🕯️</span>
            <p className="text-[14px] leading-7 text-stone-400">
              {zh ? "先进入一个纪念馆，再和 TA 说说话。" : "Enter a memorial hall first."}
            </p>
            <a
              href={`/${lang}/garden`}
              className="h-10 px-6 rounded-full inline-flex items-center text-[13px] text-amber-200 border border-amber-700/50 hover:bg-amber-900/20 transition no-underline"
            >
              {zh ? "去看看纪念馆" : "Browse halls"}
            </a>
          </div>
        )}
      </aside>

      {/* 首次必经身份说明弹层 */}
      {showIntro && (
        <ChatIntroDialog lang={lang} portraitUrl={ctx?.avatarUrl || null} onConfirm={confirmIntro} />
      )}
    </>
  );
}
