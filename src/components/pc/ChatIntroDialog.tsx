"use client";

/**
 * PC 身份说明弹层（首次必经，不可折叠/跳过）。
 * 声明文案逐字沿用移动端规范 §2.3，不可删改；
 * 遮罩不可点关闭、无 ×、无 Esc 出口，唯一出口为底部按钮（= 确认边界）。
 */
export default function ChatIntroDialog({
  lang,
  portraitUrl,
  onConfirm,
}: {
  lang: string;
  portraitUrl?: string | null;
  onConfirm: () => void;
}) {
  const zh = lang === "zh";
  return (
    <div className="pc-intro-mask" role="dialog" aria-modal="true" aria-label={zh ? "和 TA 说说话" : "Talk to them"}>
      <div className="pc-intro-dialog text-center">
        {portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitUrl}
            alt="TA"
            className="w-20 h-20 rounded-full object-cover mx-auto"
            style={{ boxShadow: "0 0 32px rgba(217,119,6,.4)" }}
          />
        ) : (
          <span
            className="w-20 h-20 rounded-full inline-flex items-center justify-center text-2xl text-amber-50"
            style={{ background: "linear-gradient(135deg,#f59e0b,#b45309)", boxShadow: "0 0 32px rgba(217,119,6,.4)" }}
          >
            彼
          </span>
        )}
        <h2 className="text-xl tracking-widest mt-4 text-stone-100" style={{ fontFamily: "var(--font-serif)" }}>
          {zh ? "和 TA 说说话" : "Talk to Them"}
        </h2>
        <p className="text-sm mt-4 leading-7 text-stone-300">
          {zh
            ? <>根据 TA 的文字、故事、照片等资料构建纪念性 AI。<br />它不是 TA 本人，也不能真正代表 TA。</>
            : <>A memorial AI built from their words, stories and photos.<br />It is not them, and cannot truly speak for them.</>}
        </p>
        <ul className="text-sm mt-4 space-y-1.5 text-left w-fit mx-auto text-stone-300">
          <li>{zh ? "· 帮你回忆 TA" : "· Helps you remember them"}</li>
          <li>{zh ? "· 听你说说话" : "· Listens to you"}</li>
          <li>{zh ? "· 根据已有记忆尝试回应" : "· Responds from recorded memories"}</li>
        </ul>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-6 w-full h-12 rounded-full text-amber-50 font-semibold tracking-widest transition hover:opacity-85"
          style={{ background: "linear-gradient(135deg,#f59e0b,#d97706 55%,#b45309)", boxShadow: "0 8px 28px rgba(217,119,6,.35)" }}
        >
          {zh ? "开始和 TA 说说话" : "Begin"}
        </button>
      </div>
    </div>
  );
}
