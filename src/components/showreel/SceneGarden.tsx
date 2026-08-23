/**
 * S0 F000–F120｜公共墓园夜景 → 建馆入口
 * 大运动①：F062–F104 相机推入「为 TA 建馆」按钮，按钮变形为向导面板（移交 SceneWizard）
 */
import React from "react";
import { tw, on, E, counter } from "./engine";
import { C, SERIF, SANS, Stars, Fireflies, Tombstone } from "./shared";

const STONES = [
  { x: 130, y: 320, s: 0.72, name: "林父", years: "1951 ~ 2020", emoji: "🕊️", f0: 6 },
  { x: 330, y: 300, s: 0.78, name: "外婆", years: "1946 ~ 2022", emoji: "🕊️", f0: 10 },
  { x: 880, y: 305, s: 0.75, name: "豆豆", years: "2012 ~ 2024", emoji: "🐾", f0: 14 },
  { x: 1060, y: 325, s: 0.7, name: "父亲", years: "1955 ~ 2021", emoji: "🕊️", f0: 18 },
  { x: 220, y: 470, s: 1.0, name: "母亲", years: "1958 ~ 2023", emoji: "🕊️", f0: 22 },
  { x: 960, y: 480, s: 1.0, name: "阿公", years: "1940 ~ 2019", emoji: "🕊️", f0: 26 },
];

export default function SceneGarden({ f }: { f: number }) {
  if (f > 124) return null;

  // 大运动①：推入按钮（F062–F104）墓园后退
  const retreat = tw(f, 62, 104, 0, 1, E.grand);
  const camScale = tw(f, 0, 90, 1.06, 1.0, E.smooth) * (1 + retreat * 0.12);
  const gardenOp = 1 - tw(f, 88, 118, 0, 1, E.press);
  const gardenBlur = retreat * 3;

  // 按钮 → 向导面板 变形交接（F062–F110）：按钮本体持续放大成卡片轮廓
  const morph = tw(f, 62, 104, 0, 1, E.grand);
  const btnW = 300 + morph * 360; // 300 → 660（向导面板宽）
  const btnH = 64 + morph * 456; // 64 → 520
  const btnR = 32 - morph * 16; // 圆角 32 → 16
  const btnY = 610 - morph * 510; // 610 → 100（面板顶）
  const btnOp = f >= 104 ? 0 : 1;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: gardenOp }}>
      {/* 夜空 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120% 60% at 50% -10%, rgba(120,90,40,0.20), transparent 60%), linear-gradient(180deg,#101319 0%,#0c0a09 55%,#131110 100%)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${camScale})`, filter: `blur(${gardenBlur}px)`, transformOrigin: "50% 78%" }}>
        <Stars f={f} opacity={tw(f, 0, 18, 0, 1, E.soft)} />
        <Fireflies f={f} opacity={tw(f, 16, 34, 0, 1, E.soft)} />

        {/* 地面 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 300,
            background: "linear-gradient(180deg, transparent, rgba(41,37,36,0.55) 40%, rgba(28,25,23,0.9))",
          }}
        />

        {/* 石碑群：错峰升起 */}
        {STONES.map((st) => {
          const rise = tw(f, st.f0, st.f0 + 20, 0, 1, E.snap);
          return (
            <div
              key={st.name}
              style={{
                position: "absolute",
                left: st.x,
                top: st.y,
                transform: `translateY(${40 * (1 - rise)}px)`,
                opacity: rise,
              }}
            >
              <Tombstone name={st.name} years={st.years} emoji={st.emoji} scale={st.s} />
            </div>
          );
        })}
      </div>

      {/* 标题 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 74, textAlign: "center", opacity: tw(f, 20, 44, 0, 1, E.soft), transform: `translateY(${tw(f, 20, 44, 18, 0, E.snap)}px)` }}>
        <p style={{ fontFamily: SERIF, fontSize: 40, letterSpacing: "0.32em", marginRight: "-0.32em", color: C.text }}>彼岸 · 公共墓园</p>
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 140,
          transform: `translateX(-50%) translateY(${tw(f, 30, 50, 12, 0, E.snap)}px)`,
          opacity: tw(f, 30, 50, 0, 1, E.soft),
          padding: "6px 18px",
          borderRadius: 999,
          border: `1px solid ${C.border}`,
          background: "rgba(16,20,28,0.5)",
          color: C.amberSoft,
          fontSize: 20,
          fontFamily: SANS,
        }}
      >
        今夜新增 {counter(f, 34, 52, 0, 3, E.pop)} 座馆
      </div>

      {/* 建馆按钮 → 变形为向导面板（交接对象） */}
      {btnOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: btnY,
            width: btnW,
            height: btnH,
            transform: `translateX(-50%) scale(${tw(f, 58, 64, 1, 0.96, E.press) * tw(f, 62, 68, 0.96, 1, E.pop)})`,
            opacity: tw(f, 30, 44, 0, 1, E.snap) * (1 - tw(f, 100, 112, 0, 1, E.press)),
            borderRadius: btnR,
            border: `1.5px solid rgba(216,169,92,${0.65 + 0.35 * tw(f, 50, 56, 0, 1)})`,
            background: `rgba(16,20,28,${0.35 + morph * 0.55})`,
            boxShadow: tw(f, 50, 56, 0, 1) > 0.5 || morph > 0 ? "0 0 36px rgba(216,169,92,0.30)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontSize: 24,
              letterSpacing: "0.2em",
              color: "#d8a95c",
              opacity: 1 - tw(f, 66, 84, 0, 1, E.press),
              whiteSpace: "nowrap",
            }}
          >
            ＋ 为 TA 建一座馆
          </span>
        </div>
      )}
    </div>
  );
}
