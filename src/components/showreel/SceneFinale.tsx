/**
 * S4 F790–F900｜大运动③：烛火特写大拉远 → 万家灯火墓园全景 → 品牌收束
 * 结尾保留烛光闪烁与萤火虫漂移（不静止成海报）
 */
import React from "react";
import { tw, wave, E } from "./engine";
import { C, SERIF, Stars, Fireflies, FlameVisual } from "./shared";

interface GlowStone {
  x: number; // 百分比
  row: 0 | 1 | 2;
  litF: number; // 烛光点亮帧
}

const STONES: GlowStone[] = [
  { x: 14, row: 0, litF: 812 }, { x: 34, row: 0, litF: 824 }, { x: 58, row: 0, litF: 818 }, { x: 82, row: 0, litF: 836 },
  { x: 20, row: 1, litF: 806 }, { x: 44, row: 1, litF: 830 }, { x: 66, row: 1, litF: 800 }, { x: 88, row: 1, litF: 842 },
  { x: 28, row: 2, litF: 848 }, { x: 72, row: 2, litF: 820 },
];

const ROW_Y = [350, 448, 552];
const ROW_S = [0.5, 0.68, 0.92];
const ROW_PARALLAX = [8, 22, 46]; // 视差：近景移动更多

export default function SceneFinale({ f }: { f: number }) {
  if (f < 786) return null;

  const pull = tw(f, 790, 856, 0, 1, E.grand); // 大拉远进程
  const sceneIn = tw(f, 790, 806, 0, 1, E.smooth);

  // 承接 S3 的烛火：从大特写收缩为墓园中的一点
  const heroFlameScale = tw(f, 790, 834, 3.2, 0.85, E.grand);
  const heroGlow = tw(f, 790, 840, 0.55, 0.16, E.smooth);

  const brandIn = tw(f, 846, 872, 0, 1, E.soft);
  const subIn = tw(f, 862, 886, 0, 1, E.soft);
  const brandSpacing = tw(f, 846, 890, 0.08, 0.3, E.smooth);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: sceneIn, pointerEvents: "none" }}>
      {/* 夜空 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 60% at 50% -10%, rgba(120,90,40,0.22), transparent 60%), linear-gradient(180deg,#101319 0%,#0c0a09 55%,#131110 100%)",
        }}
      />
      <Stars f={f} count={36} opacity={tw(f, 800, 824, 0, 1, E.soft)} />

      {/* 拉远景深层 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${1.45 - pull * 0.45})`,
          transformOrigin: "50% 62%",
        }}
      >
        {/* 地面 */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 420, background: "linear-gradient(180deg, transparent, rgba(41,37,36,0.5) 45%, rgba(28,25,23,0.92))" }} />

        {/* 三排石碑 + 逐一点亮的烛光（视差三层） */}
        {STONES.map((st, i) => {
          const lit = tw(f, st.litF, st.litF + 12, 0, 1, E.snap);
          const baseY = ROW_Y[st.row] + (1 - pull) * ROW_PARALLAX[st.row];
          const s = ROW_S[st.row];
          const inOp = tw(f, 794 + st.row * 4 + (i % 3) * 2, 808 + st.row * 4 + (i % 3) * 2, 0, 1, E.soft);
          return (
            <div key={i} style={{ position: "absolute", left: `${st.x}%`, top: baseY, transform: `translateX(-50%) scale(${s})`, opacity: inOp }}>
              {/* 简化石碑剪影 */}
              <div style={{ width: 74, borderRadius: "37px 37px 0 0", background: "linear-gradient(180deg,#8a8581 0%,#6b6660 55%,#514c46 100%)", padding: "14px 4px 10px", boxShadow: "0 8px 18px rgba(0,0,0,0.55)" }} />
              <div style={{ width: 88, height: 8, marginLeft: -7, background: "#514c46", borderRadius: "0 0 5px 5px" }} />
              {/* 烛光 */}
              {lit > 0.02 && (
                <div style={{ position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)" }}>
                  <FlameVisual f={f} scale={0.5} intensity={lit} />
                </div>
              )}
              {lit > 0.02 && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -4,
                    width: 110,
                    height: 70,
                    transform: "translateX(-50%)",
                    background: `radial-gradient(ellipse 50% 60% at 50% 75%, rgba(255,150,50,${0.34 * lit}), transparent 70%)`,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* 中央主烛火（承接 S3 特写） */}
        <div style={{ position: "absolute", left: "50%", top: 452, transform: "translateX(-50%)" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -20,
              width: 380,
              height: 300,
              transform: "translateX(-50%)",
              background: `radial-gradient(circle, rgba(255,160,60,${heroGlow}), transparent 65%)`,
            }}
          />
          <FlameVisual f={f} scale={heroFlameScale} intensity={1} />
          <div style={{ width: 26 * heroFlameScale > 40 ? 40 : 26 * heroFlameScale, height: 52, margin: "0 auto", borderRadius: 5, background: "linear-gradient(90deg,#f5ead2,#d9c9a8 60%,#b8a67f)", opacity: tw(f, 820, 834, 0, 1, E.soft) }} />
        </div>
      </div>

      <Fireflies f={f} count={10} opacity={tw(f, 812, 836, 0, 0.9, E.soft)} />

      {/* 品牌收束 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 196, textAlign: "center", opacity: brandIn, transform: `translateY(${(1 - brandIn) * 22}px)` }}>
        <p style={{ fontFamily: SERIF, fontSize: 66, color: "#f5f0e6", letterSpacing: `${brandSpacing}em`, marginRight: `-${brandSpacing}em`, textShadow: "0 2px 40px rgba(0,0,0,0.6)" }}>思念有处安放</p>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", opacity: subIn, transform: `translateY(${(1 - subIn) * 14}px)` }}>
        <p style={{ fontFamily: SERIF, fontSize: 26, color: "rgba(216,169,92,0.9)", letterSpacing: "0.5em", marginRight: "-0.5em" }}>彼岸 · 线上纪念馆</p>
      </div>

      {/* 暗角 */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 60%, rgba(0,0,0,0.42))" }} />
    </div>
  );
}
