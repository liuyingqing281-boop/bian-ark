/**
 * 10s 星海版 S1/S3｜馆内长明灯阵：三星落位燃灯（与 Scene10StarSea 三星交接）→
 * 聚焦外婆的灯 → 「为全家点灯」合祭：三灯错峰增亮 + 祭奠记录上墙 → 收束时灯位收敛回星座
 */
import React from "react";
import { tw, wave, E } from "./engine";
import { C, SANS, SERIF, FlameVisual } from "./shared";
import { CLUSTER, LAMP_POS } from "./Scene10StarSea";

const MEMBERS = [
  { name: "王建国", role: "外公", years: "1946 — 2019", igniteF: 88, recede: -20 },
  { name: "王秀兰", role: "外婆", years: "1948 — 2023", igniteF: 82, recede: 0 }, // 中央主灯（聚焦对象）
  { name: "李桂芳", role: "奶奶", years: "1952 — 2021", igniteF: 94, recede: 20 },
];
const FOCUS = 1; // 王秀兰

export default function Scene10Hall({ f }: { f: number }) {
  if (f < 62) return null;

  /* 馆内底色（暖夜）+ 合祭后增暖 */
  const bgOp = tw(f, 66, 88, 0, 1, E.smooth) * (1 - tw(f, 274, 292, 0, 1, E.press));
  const warm = tw(f, 250, 282, 0, 1, E.smooth);

  /* 馆名 / 馆训 */
  const nameOp = tw(f, 78, 98, 0, 1, E.soft) * (1 - tw(f, 268, 280, 0, 1, E.press));
  /* 灯数角标：合祭后 1→3 */
  const litCount = Math.round(tw(f, 248, 262, 1, 3, E.snap));
  const badgeOp = tw(f, 248, 256, 0, 1, E.soft) * (1 - tw(f, 274, 288, 0, 1, E.press));

  /* 聚焦进程（点击外婆的灯 F122） */
  const focus = tw(f, 122, 142, 0, 1, E.smooth);
  /* 合祭错峰增亮 */
  const burstOf = (i: number) => tw(f, 246 + i * 6, 260 + i * 6, 0, 1, E.pop);
  /* 收束收敛：灯位 → 星座 */
  const conv = tw(f, 268, 292, 0, 1, E.grand);

  /* 祭奠记录（错峰上浮） */
  const records = [
    { t: "李** 为全家点了灯", f0: 256 },
    { t: "王** 献上了一束鲜花", f0: 263 },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, opacity: bgOp, pointerEvents: "none" }}>
      {/* 暖夜底 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(90% 60% at 50% 78%, rgba(255,140,50,${0.1 + warm * 0.1}), transparent 65%), linear-gradient(180deg,#0b0908 0%,#0d0a08 52%,#161110 100%)`,
        }}
      />
      {/* 地面 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 330, background: "linear-gradient(180deg, transparent, rgba(41,30,22,0.4) 55%, rgba(22,16,12,0.9))" }} />

      {/* 馆名 */}
      <div style={{ position: "absolute", left: 340, width: 600, top: 66, textAlign: "center", opacity: nameOp, transform: `translateY(${(1 - nameOp) * 12}px)` }}>
        <p style={{ fontFamily: SERIF, fontSize: 32, color: "#f5f0e6", letterSpacing: "0.14em" }}>王家的纪念馆</p>
        <p style={{ fontFamily: SANS, fontSize: 14, color: "rgba(216,169,92,.8)", letterSpacing: "0.3em", marginTop: 8 }}>一盏灯 · 一位家人</p>
      </div>
      {/* 已点亮角标 */}
      {f >= 248 && (
        <div
          style={{
            position: "absolute",
            left: 640,
            top: 158,
            transform: `translate(-50%,${(1 - badgeOp) * 10}px)`,
            opacity: badgeOp,
            padding: "5px 14px",
            borderRadius: 999,
            background: "rgba(217,119,6,.16)",
            border: "1px solid rgba(255,179,92,.45)",
            fontFamily: SANS,
            fontSize: 14,
            color: C.emberSoft,
            whiteSpace: "nowrap",
          }}
        >
          🔥 {litCount} / 3 盏灯已点亮
        </div>
      )}

      {/* 灯阵 */}
      {MEMBERS.map((m, i) => {
        const isFocus = i === FOCUS;
        const ignite = tw(f, m.igniteF, m.igniteF + 16, 0, 1, E.snap);
        const burst = burstOf(i);
        const fs = isFocus ? 1.6 + focus * 0.38 + burst * 0.1 : 1.15 - focus * 0.12;
        const dim = isFocus ? 1 : 1 - focus * 0.22;
        const glow = (isFocus ? 0.2 + focus * 0.32 : 0.16) + burst * 0.4;
        /* 收敛位移（灯 → 星座锚点），名字提前退场 */
        const cx = LAMP_POS[i].x + (CLUSTER.x - LAMP_POS[i].x) * conv;
        const cy = LAMP_POS[i].y + (CLUSTER.y - LAMP_POS[i].y) * conv;
        const lampOp = (1 - tw(f, 286, 294, 0, 1, E.press)) * dim;
        const labelOp = (1 - tw(f, 268, 278, 0, 1, E.press)) * (isFocus && focus > 0.5 ? 1 : 0.85);
        const recedeX = m.recede * focus * (1 - conv); // 聚焦时旁灯轻微让位，收敛时还原
        return (
          <div key={m.name} style={{ position: "absolute", left: cx + recedeX, top: cy, transform: `translate(-50%,-50%) scale(${fs * (1 - conv * 0.45)})`, opacity: lampOp }}>
            {/* 光晕 */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 8,
                width: 150 * (1 + burst * 0.5),
                height: 150 * (1 + burst * 0.5),
                transform: "translate(-50%,-50%)",
                background: `radial-gradient(circle, rgba(255,150,60,${glow * (1 - conv)}), transparent 68%)`,
              }}
            />
            {/* 灯焰（点火 = 承接 Scene10StarSea 飞来的星） */}
            <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <FlameVisual f={f} scale={1.15} intensity={ignite * (1 + burst * 0.3) * (1 - conv)} />
              {/* 灯座 */}
              <div style={{ position: "absolute", bottom: -6, width: 30, height: 46, borderRadius: "5px 5px 8px 8px", background: "linear-gradient(90deg,#e8dcc0,#c9b896 60%,#a8946d)", opacity: ignite * (1 - conv) }} />
            </div>
            <div style={{ textAlign: "center", marginTop: 10, opacity: labelOp }}>
              <p style={{ fontFamily: SERIF, fontSize: isFocus ? 21 : 18, color: isFocus && focus > 0.5 ? C.emberSoft : "#d6d0c8", letterSpacing: "0.08em" }}>{m.name}</p>
              <p style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 3 }}>{m.role} · {m.years}</p>
            </div>
          </div>
        );
      })}

      {/* 祭奠记录（错峰上浮） */}
      {records.map((r, i) => {
        const rop = tw(f, r.f0, r.f0 + 10, 0, 1, E.soft) * (1 - tw(f, 276, 288, 0, 1, E.press));
        return (
          <div
            key={r.t}
            style={{
              position: "absolute",
              left: 340 + i * 330,
              top: 214,
              transform: `translate(0,${(1 - rop) * 14}px)`,
              opacity: rop,
              padding: "8px 16px",
              borderRadius: 10,
              background: "rgba(28,25,23,.88)",
              border: `1px solid ${C.border}`,
              fontFamily: SANS,
              fontSize: 14,
              color: C.text2,
              whiteSpace: "nowrap",
            }}
          >
            {r.t}
          </div>
        );
      })}
    </div>
  );
}
