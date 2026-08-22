"use client";

import { useRef, useState } from "react";
import MemoryDrawer, { Section } from "./MemoryDrawer";

// 「和 TA 说说话」聊天面板：支持 evidence 引用 + askMemory 补充记忆闭环
// 诚实原则：所有回答固定带「基于 TA 的资料推测」角标；首次展开前显示身份说明

interface ChatMsg {
  from: "me" | "ta";
  text: string;
  error?: boolean;
  // evidence
  evidence?: {
    memory_id: string;
    quote: string;
    created_at: string;
  } | null;
  // askMemory
  askMemory?: boolean;
  followupQuestion?: string | null;
}

const EMBER = "#ff7a2f";
const EMBER_SOFT = "#ffb35c";

const CARD = {
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.09)",
} as const;

// Mock chat for dev (NEXT_PUBLIC_MOCK_API=1)
const MOCK_RESPONSES: ChatMsg[] = [
  {
    from: "ta",
    text: "如果是以前，爷爷大概会先问你有没有好好吃饭。",
    evidence: { memory_id: "m1", quote: "他每次见到我们，第一句话就是'吃饭了没'。", created_at: "2024-03-15" },
    followupQuestion: "还记得他喜欢做什么菜吗？",
  },
  {
    from: "ta",
    text: "爷爷大概会笑一笑，说：'钓鱼啊，急不得，慢慢来。'",
    evidence: { memory_id: "m2", quote: "年轻时经常带我去河边钓鱼，一坐就是一下午。", created_at: "2024-02-20" },
    followupQuestion: null,
  },
  {
    from: "ta",
    text: "这个问题我还不太了解TA……",
    askMemory: true,
    followupQuestion: "TA 以前有没有什么特别难忘的旅行？",
  },
];

export default function HallChat({
  memorialId,
  memorialName,
  avatarUrl,
}: {
  memorialId: string;
  memorialName: string;
  avatarUrl: string;
}) {
  const [accepted, setAccepted] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [mockIdx, setMockIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // 证据弹层状态
  const [evidenceModal, setEvidenceModal] = useState<ChatMsg["evidence"]>(null);

  // askMemory 抽屉状态
  const [askDrawerOpen, setAskDrawerOpen] = useState(false);
  const [askDrawerSection, setAskDrawerSection] = useState<Section>("personality");
  const [askSaved, setAskSaved] = useState(false);

  const scrollDown = () =>
    setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 30);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { from: "me", text }]);
    setDraft("");
    setBusy(true);
    scrollDown();

    try {
      const useMock = !!process.env.NEXT_PUBLIC_MOCK_API;
      if (useMock) {
        // Mock 循环响应
        await new Promise((r) => setTimeout(r, 1200));
        const reply = MOCK_RESPONSES[mockIdx % MOCK_RESPONSES.length];
        setMockIdx((i) => i + 1);
        setMsgs((m) => [...m, reply]);
      } else {
        const res = await fetch("/api/hall/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memorial_id: memorialId, message: text }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.text) {
          setMsgs((m) => [
            ...m,
            {
              from: "ta",
              text: data.text,
              evidence: data.evidence ?? null,
              askMemory: data.askMemory ?? false,
              followupQuestion: data.followupQuestion ?? null,
            },
          ]);
        } else if (res.status === 422) {
          setMsgs((m) => [
            ...m,
            { from: "ta", text: "这个话题我们轻轻带过。", evidence: null },
          ]);
        } else {
          setMsgs((m) => [
            ...m,
            { from: "ta", text: "刚才没说上话，再试一次。", error: true, evidence: null },
          ]);
        }
      }
    } catch {
      setMsgs((m) => [
        ...m,
        { from: "ta", text: "刚才没说上话，再试一次。", error: true, evidence: null },
      ]);
    }
    setBusy(false);
    scrollDown();
  };

  const handleAskMemorySaved = () => {
    setAskSaved(true);
    setAskDrawerOpen(false);
    // 发送一条补充记忆的系统提示回对话
    setMsgs((m) => [
      ...m,
      {
        from: "ta",
        text: "谢谢你补充了这段记忆，我会记得的。",
        evidence: null,
      },
    ]);
    scrollDown();
  };

  // 首次：身份说明（不可跳过）
  if (!accepted) {
    return (
      <section className="rounded-3xl p-6 flex flex-col items-center text-center" style={CARD}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={memorialName}
            className="w-16 h-16 rounded-full object-cover"
            style={{ boxShadow: "0 0 30px rgba(255,122,47,.5)" }}
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
            style={{
              background: "linear-gradient(135deg,#ff8a3d,#b43a0e)",
              boxShadow: "0 0 30px rgba(255,122,47,.5)",
              fontFamily: "'Noto Serif SC','Songti SC',serif",
            }}
          >
            {memorialName.slice(0, 1)}
          </div>
        )}
        <h2
          className="mt-4 text-lg tracking-wider"
          style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}
        >
          和 TA 说说话
        </h2>
        <p className="mt-3 text-[13px] leading-6" style={{ color: "rgba(255,246,236,.6)" }}>
          根据 TA 的文字、故事、照片等资料构建纪念性 AI。
          <br />
          <span style={{ color: "#fff6ec" }}>它不是 TA 本人，也不能真正代表 TA。</span>
        </p>
        <ul className="mt-4 space-y-1.5 text-[13px]" style={{ color: "rgba(255,246,236,.6)" }}>
          <li>· 帮你回忆 TA</li>
          <li>· 听你说说话</li>
          <li>· 根据已有记忆尝试回应</li>
        </ul>
        <button
          onClick={() => setAccepted(true)}
          className="mt-6 w-full h-12 rounded-full text-[15px] font-medium text-white transition active:opacity-85"
          style={{
            background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
            boxShadow: "0 8px 28px rgba(244,93,18,.45)",
          }}
        >
          开始和 TA 说说话
        </button>
      </section>
    );
  }

  return (
    <>
      <section
        className="rounded-3xl flex flex-col h-full min-h-[480px]"
        style={CARD}
      >
        {/* 头部 */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
              style={{
                background: "linear-gradient(135deg,#ff8a3d,#b43a0e)",
                fontFamily: "'Noto Serif SC','Songti SC',serif",
              }}
            >
              {memorialName.slice(0, 1)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-[15px] tracking-wide"
              style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}
            >
              和{memorialName}说说话
            </p>
            <p className="text-[10px]" style={{ color: "rgba(255,246,236,.38)" }}>
              纪念性 AI · 不是 TA 本人
            </p>
          </div>
        </div>

        {/* 消息列表 */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div
            className="flex items-center gap-3 text-[11px]"
            style={{ color: "rgba(255,246,236,.38)" }}
          >
            <span className="flex-1 h-px" style={{ background: "rgba(255,255,255,.08)" }} />
            今天
            <span className="flex-1 h-px" style={{ background: "rgba(255,255,255,.08)" }} />
          </div>

          {msgs.length === 0 && !busy && (
            <p className="text-center text-[13px] py-8" style={{ color: "rgba(255,246,236,.5)" }}>
              想 TA 的时候，可以来和 TA 说说话。
            </p>
          )}

          {msgs.map((m, i) =>
            m.from === "me" ? (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[78%] px-3.5 py-2.5 text-[14px] text-white"
                  style={{
                    background: "linear-gradient(135deg,#ff8a3d,#e2520e)",
                    borderRadius: "18px 18px 6px 18px",
                    boxShadow: "0 4px 18px rgba(244,93,18,.3)",
                  }}
                >
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="max-w-[82%]">
                {/* TA 气泡 */}
                <div className="px-3.5 py-2.5 text-[14px]" style={{ ...CARD, borderRadius: "18px 18px 18px 6px" }}>
                  {m.text}
                </div>

                {/* evidence 依据链接 */}
                {m.evidence && (
                  <button
                    onClick={() => setEvidenceModal(m.evidence ?? null)}
                    className="text-[12px] mt-1.5 underline underline-offset-4 transition"
                    style={{ color: EMBER_SOFT }}
                  >
                    查看这句话的依据
                  </button>
                )}

                {/* askMemory 补充记忆入口 */}
                {m.askMemory && (
                  <button
                    onClick={() => setAskDrawerOpen(true)}
                    className="mt-2 w-full h-10 rounded-full text-[13px] flex items-center justify-center gap-2 transition active:opacity-85"
                    style={{
                      background: "rgba(255,122,47,.1)",
                      border: "1px solid rgba(255,179,92,.35)",
                      color: EMBER_SOFT,
                    }}
                  >
                    <span>💡</span>
                    添加一段关于 TA 的记忆
                  </button>
                )}

                {/* 推测角标 */}
                <p className="text-[10px] mt-1" style={{ color: "rgba(255,246,236,.38)" }}>
                  {m.error ? (
                    <button onClick={send} className="underline underline-offset-4" style={{ color: EMBER_SOFT }}>
                      重试
                    </button>
                  ) : (
                    "基于 TA 的资料推测"
                  )}
                </p>
              </div>
            )
          )}

          {/* 正在输入 */}
          {busy && (
            <div
              className="flex items-center gap-1.5 px-3.5 py-2.5 w-fit"
              style={{ ...CARD, borderRadius: "18px 18px 18px 6px" }}
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: EMBER_SOFT, animationDelay: `${d * 0.18}s` }}
                />
              ))}
              <span className="ml-1 text-[11px]" style={{ color: "rgba(255,246,236,.38)" }}>
                正在想你问的话…
              </span>
            </div>
          )}
        </div>

        {/* 输入栏 */}
        <div className="p-4 pt-2">
          <div
            className="flex items-center gap-2 rounded-full pl-4 pr-1.5 py-1.5"
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="想对 TA 说……"
              className="flex-1 min-w-0 bg-transparent outline-none text-[14px]"
              style={{ color: "#fff6ec" }}
            />
            <button
              onClick={send}
              disabled={!draft.trim() || busy}
              className="w-10 h-10 rounded-full text-white transition disabled:opacity-30"
              style={{ background: "linear-gradient(135deg,#ff8a3d,#e2520e)" }}
              aria-label="发送"
            >
              ↑
            </button>
          </div>
        </div>
      </section>

      {/* ============ evidence 弹层 ============ */}
      {evidenceModal && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(2px)" }}
            onClick={() => setEvidenceModal(null)}
          />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm rounded-3xl p-6"
            style={{ background: "#150806", border: "1px solid rgba(255,255,255,.12)" }}
          >
            <p className="text-[11px] mb-3" style={{ color: "rgba(255,246,236,.38)" }}>
              这句话的依据
            </p>
            <blockquote
              className="text-[15px] leading-7 italic"
              style={{
                fontFamily: "'Noto Serif SC','Songti SC',serif",
                color: "rgba(255,246,236,.9)",
                borderLeft: "3px solid #ff7a2f",
                paddingLeft: "14px",
              }}
            >
              “{evidenceModal.quote}”
            </blockquote>
            <p className="text-[11px] mt-3" style={{ color: "rgba(255,246,236,.38)" }}>
              添加于 {evidenceModal.created_at}
            </p>
            <button
              onClick={() => setEvidenceModal(null)}
              className="mt-5 w-full h-11 rounded-full text-[14px] font-medium transition active:opacity-85"
              style={{
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "#fff6ec",
              }}
            >
              关闭
            </button>
          </div>
        </>
      )}

      {/* ============ askMemory 抽屉 ============ */}
      <MemoryDrawer
        memorialId={memorialId}
        open={askDrawerOpen}
        onClose={() => setAskDrawerOpen(false)}
        initialSection={askDrawerSection}
        onSaved={handleAskMemorySaved}
        isChat
      />
    </>
  );
}
