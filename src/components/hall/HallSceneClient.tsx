"use client";

// 馆级场景客户端壳（Task 5，13 号方案 §4/§5/§11）：
// - 服务端 page 完成路由解析（hallId 规范化）与数据装载，本组件只承接交互：
//   点灯聚焦（?p=，仅本馆成员，URL 保留 p）、Esc 层级回退（人物 → 馆级 → 离开回星海）、
//   「返回星海」（回 /garden，由 GardenSea 的 session snapshot 恢复浏览状态）。
// - 馆级公共层（不聚焦时的默认态）在本组件内渲染：1–6 盏灯的群像名单，点击 = 聚焦该灯。
// - 人物层与聊天体（HallChat）由服务端渲染后以 ReactNode 传入（RSC 槽位），
//   本组件不做任何数据请求 —— 不产生跨馆读取。
// - 桌面（≥768px）聊天侧栏：.hall-scene-chat（不复用 .hall-inline-chat，
//   该类在沉浸壳下被 M3 规则隐藏，正是 Task 2 遗留的「PC 馆页聊天入口丢失」根因）。

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export interface HallSceneMember {
  id: string;
  /** 已按视角装配：馆主原文 / 访客 nameMasked（首字 + **） */
  name: string;
  avatarUrl: string;
  birthYear: string;
  deathYear: string;
  epitaph: string;
  /** 24h 内有祭扫（口径同 /api/halls/[id] lamp candleLit） */
  candleLit: boolean;
}

interface HallSceneClientProps {
  lang: string;
  hallId: string;
  /** 已按视角装配（馆主原文 / 访客脱敏） */
  hallName: string;
  motto: string;
  members: HallSceneMember[];
  /** URL ?p 命中本馆成员（Esc 清 p 回馆级）；N=1 自动人物层时为 false */
  pActive: boolean;
  /** 当前渲染人物层（p 聚焦，或单人馆「行为不变」默认人物层） */
  personActive: boolean;
  personLayer: React.ReactNode;
  chatBody: React.ReactNode;
}

export default function HallSceneClient({
  lang,
  hallId,
  hallName,
  motto,
  members,
  pActive,
  personActive,
  personLayer,
  chatBody,
}: HallSceneClientProps) {
  const router = useRouter();
  const zh = lang !== "en";
  const hallPath = `/${lang}/hall/${encodeURIComponent(hallId)}`;

  function focusMember(memorialId: string) {
    router.push(`${hallPath}?p=${encodeURIComponent(memorialId)}`);
  }

  function clearFocus() {
    router.replace(hallPath);
  }

  function backToGarden() {
    router.push(`/${lang}/garden`);
  }

  // Esc 层级回退（13 号方案 §4）：聚焦人物 → 馆级公共层 → 离开回星海；
  // 输入控件（聊天框等）内的 Esc 不劫持
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (pActive) clearFocus();
      else backToGarden();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pActive, hallPath, lang]);

  return (
    <div
      className="hall-scene min-h-screen flex flex-col"
      data-hall-id={hallId}
      data-panel={personActive ? "person" : "hall"}
      style={{
        background:
          "radial-gradient(120% 55% at 50% -8%, rgba(255,106,32,.26), transparent 60%), radial-gradient(90% 40% at 50% 115%, rgba(180,58,14,.2), transparent 65%), #070302",
        color: "#fff6ec",
        fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",
      }}
    >
      {/* 顶部：返回星海 / 馆名（脱敏按视角）/ 馆训 / 回馆级 */}
      <header
        className="sticky top-0 z-30"
        style={{ background: "rgba(7,3,2,.88)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,.07)" }}
      >
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="hall-back-garden text-[13px] rounded-full px-4 py-1.5 transition active:opacity-85"
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,246,236,.8)" }}
            onClick={backToGarden}
            aria-label={zh ? "返回星海" : "Back to star sea"}
          >
            ← {zh ? "返回星海" : "Star sea"}
          </button>
          <p
            className="hall-scene-name text-[15px] tracking-[0.2em] flex-1 min-w-0 truncate text-center"
            style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}
          >
            {hallName}
          </p>
          {pActive && (
            <button
              type="button"
              className="hall-back-level text-[13px] rounded-full px-4 py-1.5 transition active:opacity-85"
              style={{ background: "rgba(255,122,47,.1)", border: "1px solid rgba(255,179,92,.3)", color: "#ffb35c" }}
              onClick={clearFocus}
              aria-label={zh ? "回馆级" : "Back to hall level"}
            >
              ← {zh ? "回馆级" : "Hall"}
            </button>
          )}
        </div>
        {motto && (
          <p className="text-center text-[11px] pb-2" style={{ color: "rgba(255,246,236,.4)" }}>
            {motto}
          </p>
        )}
      </header>

      <div className="hall-scene-body flex-1 w-full max-w-6xl mx-auto px-5 py-8 grid gap-10 md:grid-cols-[1fr_360px] md:items-start">
        <div className="hall-scene-main min-w-0">
          {personActive ? (
            personLayer
          ) : (
            <section className="hall-lamps" aria-label={zh ? "馆内亲人" : "Family members"}>
              <p className="text-center text-[13px] mb-6" style={{ color: "rgba(255,246,236,.5)" }}>
                {zh ? "点一盏灯，走近 TA" : "Choose a lamp to come closer"}
              </p>
              <ul className="grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto">
                {members.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      className="hall-lamp w-full rounded-3xl p-6 flex flex-col items-center gap-3 transition active:opacity-85"
                      data-memorial-id={member.id}
                      onClick={() => focusMember(member.id)}
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.09)",
                      }}
                      aria-label={`${member.name}，${member.birthYear} — ${member.deathYear}`}
                    >
                      <span
                        className="hall-lamp-avatar w-16 h-16 rounded-full flex items-center justify-center text-2xl overflow-hidden relative"
                        style={{
                          background: "linear-gradient(135deg,#ff8a3d,#b43a0e)",
                          boxShadow: member.candleLit ? "0 0 30px rgba(255,122,47,.55)" : "none",
                        }}
                      >
                        {member.avatarUrl && member.avatarUrl.startsWith("/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          member.avatarUrl || "🕯️"
                        )}
                      </span>
                      <span
                        className="hall-lamp-name text-[16px]"
                        style={{ fontFamily: "'Noto Serif SC','Songti SC',serif" }}
                      >
                        {member.name}
                      </span>
                      <span className="hall-lamp-years text-[12px] tracking-[0.2em]" style={{ color: "rgba(255,246,236,.38)" }}>
                        {member.birthYear} — {member.deathYear}
                      </span>
                      {member.epitaph && (
                        <span className="hall-lamp-epitaph text-[12px] text-center" style={{ color: "rgba(255,246,236,.5)" }}>
                          “{member.epitaph}”
                        </span>
                      )}
                      {member.candleLit && (
                        <span className="hall-lamp-lit text-[11px] flex items-center gap-1.5" style={{ color: "rgba(255,246,236,.45)" }}>
                          <span className="inline-block w-1.5 h-2.5 rounded-t-full" style={{ background: "#ff7a2f" }} />
                          {zh ? "灯还亮着" : "The lamp is lit"}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* 桌面（≥768px）右侧聊天侧栏；移动端排在主内容之后（沿用馆页既有行为） */}
        {personActive && <aside className="hall-scene-chat md:sticky md:top-20">{chatBody}</aside>}
      </div>
    </div>
  );
}
