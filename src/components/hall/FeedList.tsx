"use client";

import { useState, useEffect } from "react";

// ============================================================
// 混合纪念流（供奉 + 留言），GET /api/hall/feed
// 空状态：引导用户去供奉/想念
// ============================================================

export interface FeedItem {
  kind: "tribute" | "message";
  icon: string;
  label: string;
  senderMasked: string;
  message?: string;
  isBurning?: boolean;
  createdAt: string;
}

const CARD = {
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.09)",
} as const;

interface Props {
  memorialId: string;
  lang: string;
  showEmpty?: boolean;
  emptyAction?: {
    href: string;
    label: string;
  };
}

function maskName(name: string): string {
  if (!name) return "匿名";
  if (name.length <= 2) return name[0] + "*";
  return name.slice(0, 1) + "*".repeat(Math.min(name.length - 2, 2)) + name.slice(-1);
}

function formatTime(iso: string): string {
  if (!iso) return "刚刚";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return iso.slice(0, 10);
}

// Mock data for dev without API
const MOCK_FEED: FeedItem[] = [
  { kind: "tribute", icon: "🕯️", label: "点灯", senderMasked: "李**", createdAt: new Date(Date.now() - 3_600_000).toISOString() },
  { kind: "message", icon: "💬", label: "留言", senderMasked: "王*", message: "爷爷，桂花又开了。", createdAt: new Date(Date.now() - 86_400_000).toISOString() },
  { kind: "tribute", icon: "🌸", label: "献花", senderMasked: "张**", createdAt: new Date(Date.now() - 172_800_000).toISOString() },
];

export default function FeedList({ memorialId, lang, showEmpty = true, emptyAction }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      setLoading(true);
      setError(false);
      try {
        const useMock = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_MOCK_API;
        let data: { items?: FeedItem[] } = {};
        if (useMock) {
          data = { items: MOCK_FEED };
        } else {
          const res = await fetch(`/api/hall/feed?memorial_id=${memorialId}`);
          if (res.ok) data = await res.json();
          else setError(true);
        }
        setItems(data.items ?? []);
      } catch {
        setError(true);
      }
      setLoading(false);
    };
    fetch_();
  }, [memorialId]);

  if (loading) {
    return (
      <div className="rounded-3xl p-6" style={CARD}>
        <p className="text-center text-[13px]" style={{ color: "rgba(255,246,236,.4)" }}>加载中…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl p-6" style={CARD}>
        <p className="text-center text-[13px]" style={{ color: "rgba(255,246,236,.4)" }}>加载失败</p>
      </div>
    );
  }

  if (items.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="rounded-3xl p-6 text-center" style={CARD}>
        <p className="text-[14px]" style={{ color: "rgba(255,246,236,.4)" }}>
          成为第一个纪念 TA 的人
        </p>
        {emptyAction && (
          <a
            href={emptyAction.href}
            className="inline-block mt-4 text-[13px] rounded-full px-5 py-2"
            style={{
              background: "rgba(255,122,47,.12)",
              border: "1px solid rgba(255,179,92,.4)",
              color: "#ffb35c",
            }}
          >
            {emptyAction.label}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl overflow-hidden" style={CARD}>
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-5 py-3.5"
          style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,.06)" : "none" }}
        >
          <span className="text-lg shrink-0">{item.icon}</span>
          <span className="flex-1 text-[14px]">
            {item.label} · {item.senderMasked}
            {item.isBurning && (
              <span
                className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(255,122,47,.14)", color: "#ffb35c" }}
              >
                点燃
              </span>
            )}
          </span>
          {item.message && (
            <span
              className="text-[12px] truncate max-w-[35%]"
              style={{ color: "rgba(255,246,236,.45)" }}
            >
              {item.message}
            </span>
          )}
          <span className="text-[11px] shrink-0" style={{ color: "rgba(255,246,236,.38)" }}>
            {formatTime(item.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
