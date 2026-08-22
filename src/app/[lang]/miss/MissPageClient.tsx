"use client";

import { useState, useEffect } from "react";
import MissComposer from "../../../components/hall/MissComposer";

const CARD = {
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.09)",
} as const;

interface MyMessage {
  id: string;
  msg_type: string;
  content: string;
  created_at: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return iso.slice(0, 10);
}

const TYPE_ICONS: Record<string, string> = {
  public: "💬",
  private: "🔒",
  eulogy: "🕯️",
};
const TYPE_LABELS: Record<string, string> = {
  public: "留言",
  private: "悄悄话",
  eulogy: "悼文",
};

const MOCK_MESSAGES: MyMessage[] = [
  { id: "1", msg_type: "public", content: "爷爷，我今天工作特别累。要是以前，你大概会先问我有没有好好吃饭。", created_at: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  { id: "2", msg_type: "private", content: "最近总梦到你还在厨房忙活。", created_at: new Date(Date.now() - 10 * 86_400_000).toISOString() },
];

export default function MissPage({
  memorialId: initialId,
  memorialName: initialName,
  avatarUrl: initialAvatar,
}: {
  memorialId: string;
  memorialName: string;
  avatarUrl: string;
}) {
  const [myMessages, setMyMessages] = useState<MyMessage[]>(MOCK_MESSAGES);
  const [msgLoading, setMsgLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!initialId) {
      setMsgLoading(false);
      return;
    }
    const useMock = !!process.env.NEXT_PUBLIC_MOCK_API;
    if (useMock) {
      setMyMessages(MOCK_MESSAGES);
      setMsgLoading(false);
      return;
    }
    setMsgLoading(true);
    fetch(`/api/messages?memorial_id=${initialId}`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setMyMessages(d.items ?? []))
      .catch(() => {})
      .finally(() => setMsgLoading(false));
  }, [initialId]);

  const handlePosted = () => {
    const useMock = !!process.env.NEXT_PUBLIC_MOCK_API;
    if (useMock) {
      setMyMessages((prev) => [
        { id: String(Date.now()), msg_type: "public", content: "（刚刚发表的留言）", created_at: new Date().toISOString() },
        ...prev,
      ]);
      return;
    }
    setMsgLoading(true);
    fetch(`/api/messages?memorial_id=${initialId}`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setMyMessages(d.items ?? []))
      .catch(() => {})
      .finally(() => setMsgLoading(false));
  };

  return (
    <>
      {/* 顶部导航 */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <a
          href={initialId ? `/zh/hall/${initialId}` : "/zh"}
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={CARD}
        >
          <span className="text-lg" style={{ color: "#fff6ec" }}>‹</span>
        </a>
        <h1 className="text-[17px] tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>想念</h1>
        <div className="w-10" />
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center text-center pt-6 px-5">
        <h2 className="text-2xl tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
          今天想和 TA 说些什么？
        </h2>
        {initialAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={initialAvatar}
            alt={initialName}
            className="w-20 h-20 rounded-full object-cover mt-5"
            style={{ boxShadow: "0 0 30px rgba(255,122,47,.45)" }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mt-5"
            style={{
              background: "linear-gradient(135deg,#ff8a3d,#b43a0e)",
              boxShadow: "0 0 30px rgba(255,122,47,.45)",
              fontFamily: "'Noto Serif SC','Songti SC',serif",
            }}
          >
            {initialName.slice(0, 1)}
          </div>
        )}
        <p className="text-[13px] mt-3" style={{ color: "rgba(255,246,236,.38)" }}>
          “想说的话，可以告诉我。”
        </p>
        {initialId && (
          <a
            href={`/zh/hall/${initialId}`}
            className="mt-5 h-12 rounded-full px-8 text-[15px] flex items-center gap-2 text-white font-medium transition active:opacity-85"
            style={{
              background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
              boxShadow: "0 8px 28px rgba(244,93,18,.45)",
            }}
          >
            💬 和 TA 说说话
          </a>
        )}
      </div>

      {/* 留言区 */}
      <div className="mt-8 px-5 pb-6">
        <h3 className="text-lg tracking-wider mb-3" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
          留下你的话
        </h3>
        {initialId ? (
          <MissComposer memorialId={initialId} onPosted={handlePosted} />
        ) : (
          <div className="rounded-2xl p-5 text-center" style={CARD}>
            <p className="text-[14px]" style={{ color: "rgba(255,246,236,.4)" }}>
              请从纪念馆进入想念页
            </p>
          </div>
        )}
      </div>

      {/* 我留下的 */}
      <div className="px-5 pb-8">
        <h3 className="text-lg tracking-wider mb-3" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
          你留下的
        </h3>
        {msgLoading ? (
          <p className="text-[13px] text-center py-6" style={{ color: "rgba(255,246,236,.4)" }}>加载中…</p>
        ) : myMessages.length === 0 ? (
          <div className="rounded-2xl p-5 text-center" style={CARD}>
            <p className="text-[14px]" style={{ color: "rgba(255,246,236,.4)" }}>还没有留下过话</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myMessages.map((m) => (
              <div key={m.id} className="rounded-2xl p-4" style={CARD}>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,246,236,.38)" }}>
                  <span>{TYPE_ICONS[m.msg_type] ?? "💬"}</span>
                  <span>{TYPE_LABELS[m.msg_type] ?? "留言"}</span>
                  <span>·</span>
                  <span>{formatTime(m.created_at)}</span>
                  {m.msg_type === "private" && (
                    <>
                      <span>·</span>
                      <span style={{ color: "#ffb35c" }}>仅自己可见</span>
                    </>
                  )}
                </div>
                <p className="text-[14px] mt-2 leading-relaxed" style={{ color: "#fff6ec" }}>
                  “{m.content}”
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
