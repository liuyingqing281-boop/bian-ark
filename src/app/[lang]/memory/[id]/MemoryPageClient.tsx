"use client";

import { useState, useEffect } from "react";
import MemoryDrawer, { SECTIONS, Section } from "../../../../components/hall/MemoryDrawer";

const CARD = {
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.09)",
} as const;

interface MemoriesResponse {
  total: number;
  sections: Record<Section, string[]>;
}

const MOCK_MEMORIES: MemoriesResponse = {
  total: 32,
  sections: {
    personality: ["温和、幽默、喜欢喝茶"],
    relation: ["我们第一次一起旅行，是去了青岛看海。"],
    likes: ["京剧、茶、钓鱼", "年轻时经常带我去河边钓鱼，一坐就是一下午。"],
    speech: ["\"慢慢来，不着急。\""],
    profile: ["姓名：林守拙 / 1940 年生 / 退休教师"],
  },
};

export default function MemoryPageClient({
  memorialId,
  memorialName,
}: {
  memorialId: string;
  memorialName: string;
}) {
  const [memories, setMemories] = useState<MemoriesResponse | null>(MOCK_MEMORIES);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<Section>("personality");

  useEffect(() => {
    if (!memorialId) { setLoading(false); return; }
    const useMock = !!process.env.NEXT_PUBLIC_MOCK_API;
    if (useMock) {
      setMemories(MOCK_MEMORIES);
      setLoading(false);
      return;
    }
    fetch(`/api/memories?memorial_id=${memorialId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setMemories(d as MemoriesResponse); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [memorialId]);

  const openDrawer = (section: Section) => {
    setDrawerSection(section);
    setDrawerOpen(true);
  };

  const handleSaved = () => {
    const useMock = !!process.env.NEXT_PUBLIC_MOCK_API;
    if (useMock) {
      setMemories((prev) => prev ? { ...prev, total: prev.total + 1 } : prev);
    } else {
      fetch(`/api/memories?memorial_id=${memorialId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setMemories(d as MemoriesResponse); })
        .catch(() => {});
    }
  };

  return (
    <>
      {/* 顶部导航 */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
        <a href={memorialId ? `/zh/hall/${memorialId}` : "/zh"} className="w-10 h-10 rounded-full flex items-center justify-center" style={CARD}>
          <span className="text-lg" style={{ color: "#fff6ec" }}>‹</span>
        </a>
        <h1 className="text-[17px] tracking-wider" style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}>TA 的记忆档案</h1>
        <div className="w-10" />
      </div>

      <div className="px-5 pt-4 pb-28 md:mx-auto md:w-full md:max-w-[760px]">
        {/* 统计 */}
        {loading ? (
          <p className="text-[13px]" style={{ color: "rgba(255,246,236,.5)" }}>加载中…</p>
        ) : memories ? (
          <p className="text-[13px]" style={{ color: "rgba(255,246,236,.5)" }}>
            已建立{" "}
            <span style={{ color: "#ffb35c", fontFamily: "'Noto Serif SC','Songti SC',serif" }}>
              {memories.total}
            </span>{" "}
            条记忆
          </p>
        ) : (
          <p className="text-[13px]" style={{ color: "rgba(255,246,236,.5)" }}>暂无记忆</p>
        )}

        {/* 五分区 */}
        <div className="mt-5 space-y-5">
          {SECTIONS.map((sec) => {
            const items = memories?.sections[sec.key] ?? [];
            return (
              <section key={sec.key}>
                <h2 className="text-[15px] flex items-center gap-2">
                  <span className="text-[13px]">{sec.icon}</span>
                  {sec.label}
                </h2>
                {items.length === 0 ? (
                  <button
                    onClick={() => openDrawer(sec.key)}
                    className="mt-2 w-full rounded-2xl px-4 py-3.5 text-[14px] text-left transition active:opacity-80"
                    style={{
                      background: "rgba(255,255,255,.03)",
                      border: "1px dashed rgba(255,255,255,.12)",
                      color: "rgba(255,246,236,.3)",
                    }}
                  >
                    添加第一条{sec.label}…
                  </button>
                ) : (
                  <div className="mt-2 rounded-2xl overflow-hidden" style={CARD}>
                    {items.map((content, i) => (
                      <p
                        key={i}
                        className="px-4 py-3.5 text-[14px] leading-relaxed"
                        style={{
                          ...(i > 0 ? { borderTop: "1px solid rgba(255,255,255,.06)" } : {}),
                          ...(sec.key === "speech" ? { fontFamily: "'Noto Serif SC','Songti SC',serif" } : {}),
                          ...(sec.key === "profile" ? { color: "rgba(255,246,236,.6)" } : {}),
                        }}
                      >
                        {content}
                      </p>
                    ))}
                    <button
                      onClick={() => openDrawer(sec.key)}
                      className="w-full px-4 py-3 text-[12px] text-center rounded-b-2xl transition active:opacity-80"
                      style={{ color: "#ffb35c", borderTop: "1px solid rgba(255,255,255,.06)" }}
                    >
                      + 添加
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* 底部固定添加按钮 */}
      <div
        className="fixed inset-x-0 bottom-0 px-5 pb-7"
        style={{
          background: "linear-gradient(to top, #070302 55%, transparent)",
          paddingTop: "2.5rem",
        }}
      >
        <button
          onClick={() => openDrawer("personality")}
          className="w-full h-14 rounded-full text-[16px] font-semibold tracking-widest text-white transition-all active:opacity-85 md:max-w-[760px] md:mx-auto md:block"
          style={{
            background: "linear-gradient(135deg,#ff8a3d 0%,#f45d12 55%,#d9480f 100%)",
            boxShadow: "0 8px 28px rgba(244,93,18,.45)",
          }}
        >
          + 添加记忆
        </button>
      </div>

      {/* 记忆抽屉 */}
      {memorialId && (
        <MemoryDrawer
          memorialId={memorialId}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          initialSection={drawerSection}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
