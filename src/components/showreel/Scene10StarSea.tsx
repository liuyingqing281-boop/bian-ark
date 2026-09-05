/**
 * 10s 星海版 S0/S4｜纪念星海：园级入口 → 点星推入（大运动①）；
 * 收束时馆升回星海成为星座 → 品牌（大运动③）
 * 星=馆、星群=多人馆；三颗星与馆内三盏灯一一对应（对象交接：Position/Scale/Color）
 */
import React from "react";
import { tw, wave, E } from "./engine";
import { C, SANS, SERIF } from "./shared";

/** 王家星群锚点（贯穿全片的星座位） */
export const CLUSTER = { x: 700, y: 298 };
/** 三颗星相对锚点偏移（core=王秀兰 / 左=王建国 / 右=李桂芳），与 Scene10Hall 灯位对应 */
export const CLUSTER_STARS = [
  { dx: 0, dy: 0, r: 13 },
  { dx: -46, dy: 20, r: 9 },
  { dx: 44, dy: 24, r: 9 },
];
/** 馆内三灯位（王建国 / 王秀兰 / 李桂芳），顺序与 CLUSTER_STARS 对齐后按索引映射 */
export const LAMP_POS = [
  { x: 548, y: 412 },
  { x: 700, y: 352 },
  { x: 852, y: 412 },
];

/** 散星（脱敏名）：% 定位，推入时随星海层整体放大退场 */
const SINGLES: { x: number; y: number; label?: string; litF: number }[] = [
  { x: 8, y: 13, label: "陈**", litF: 2 },
  { x: 21, y: 28, label: "张**", litF: 5 },
  { x: 38, y: 10, litF: 3 },
  { x: 54, y: 34, label: "刘**", litF: 8 },
  { x: 11, y: 46, litF: 6 },
  { x: 30, y: 60, label: "赵**", litF: 10 },
  { x: 87, y: 16, label: "孙**", litF: 4 },
  { x: 92, y: 42, litF: 9 },
  { x: 74, y: 56, litF: 7 },
  { x: 46, y: 54, litF: 11 },
  { x: 63, y: 12, litF: 5 },
];

function StarDot({ size, glow, flick }: { size: number; glow: string; flick: number }) {
  return (
    <span
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, #fff6ec 0%, ${glow} 45%, transparent 75%)`,
        boxShadow: `0 0 ${size * 1.6}px ${glow}`,
        opacity: 0.75 + 0.25 * flick,
      }}
    />
  );
}

export default function Scene10StarSea({ f }: { f: number }) {
  if (f >= 92 && f < 244) return null;

  /* ── 入场段 F000–F092 ── */
  const enter = f < 92;
  const push = tw(f, 54, 88, 0, 1, E.grand); // 大运动①进程
  const fieldOp = enter ? 1 - tw(f, 72, 86, 0, 1, E.press) : tw(f, 272, 292, 0, 1, E.soft);
  const fieldScale = enter ? 1 + push * 2.4 : 1 + (1 - tw(f, 272, 296, 0, 1, E.smooth)) * 0.14;

  const titleOp = tw(f, 12, 34, 0, 1, E.soft) * (1 - tw(f, 58, 72, 0, 1, E.press));
  const titleUp = tw(f, 12, 34, 14, 0, E.snap) + tw(f, 58, 74, 0, -22, E.press);
  const subOp = tw(f, 20, 42, 0, 1, E.soft) * (1 - tw(f, 58, 72, 0, 1, E.press));

  /* hover 光环 + 馆名标签 */
  const ringOp = tw(f, 42, 48, 0, 1, E.snap) * (1 - tw(f, 56, 66, 0, 1, E.press));
  const ringR = tw(f, 42, 60, 74, 92, E.smooth);
  const tagOp = tw(f, 43, 51, 0, 1, E.soft) * (1 - tw(f, 56, 66, 0, 1, E.press));

  /* ── 收束段 F244–F300 ── */
  const brandOp = tw(f, 280, 296, 0, 1, E.soft);
  const brandSp = tw(f, 280, 298, 0.06, 0.3, E.smooth);
  const subBrandOp = tw(f, 289, 300, 0, 1, E.soft);
  const clLabelOp = tw(f, 291, 300, 0, 0.85, E.soft);
  /* 星座回亮（candleLit 暖光） */
  const bloom = tw(f, 280, 296, 0, 1, E.pop);
  /* 三灯 → 星座迁移光点 */
  const travel = LAMP_POS.map((_, i) => tw(f, 268 + i * 4, 290 + i * 4, 0, 1, E.grand));

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* 夜空底色 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: fieldOp,
          background:
            "radial-gradient(120% 55% at 50% -8%, rgba(96,104,148,0.20), transparent 62%), linear-gradient(180deg,#090b12 0%,#0b0a09 58%,#12100e 100%)",
        }}
      />

      {/* 散星层（推入时以星群为锚放大退场；收束时回场） */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: fieldOp,
          transform: `scale(${fieldScale})`,
          transformOrigin: `${(CLUSTER.x / 1280) * 100}% ${(CLUSTER.y / 720) * 100}%`,
        }}
      >
        {SINGLES.map((st, i) => {
          const lit = tw(f, st.litF, st.litF + 10, 0, 1, E.soft);
          const flick = wave(f, 80 + (i % 5) * 26, i * 17);
          return (
            <div key={i} style={{ position: "absolute", left: `${st.x}%`, top: `${st.y}%`, transform: "translate(-50%,-50%)", opacity: lit }}>
              <StarDot size={11} glow="rgba(255,214,170,.45)" flick={flick} />
              {st.label && (
                <p style={{ marginTop: 5, fontSize: 11, fontFamily: SANS, color: "rgba(255,246,236,.55)", textAlign: "center", whiteSpace: "nowrap" }}>{st.label}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 王家星群（入场可点 / 推入时三星飞向灯位 / 收束时回亮为星座） */}
      {CLUSTER_STARS.map((st, i) => {
        const sx = CLUSTER.x + st.dx;
        const sy = CLUSTER.y + st.dy;
        const flick = wave(f, 70 + i * 21, i * 23);
        if (enter) {
          const m = tw(f, 54, 86, 0, 1, E.grand); // 三星分别飞向对应灯位
          const tx = sx + (LAMP_POS[i].x - sx) * m;
          const ty = sy + (LAMP_POS[i].y - sy) * m;
          const s = 1 + m * 0.5;
          const op = (1 - tw(f, 80, 88, 0, 1, E.press)) * (i === 0 ? 1 : 0.95);
          return (
            <div key={i} style={{ position: "absolute", left: tx, top: ty, transform: `translate(-50%,-50%) scale(${s})`, opacity: op }}>
              <StarDot size={st.r} glow={i === 0 ? "rgba(255,214,170,.55)" : "rgba(255,214,170,.45)"} flick={flick} />
            </div>
          );
        }
        /* 收束：迁移光点落位 + 星座回亮 */
        const dot = travel[i];
        const glow = 0.45 + 0.5 * bloom;
        return (
          <div key={i} style={{ position: "absolute", inset: 0}}>
            <div
              style={{
                position: "absolute",
                left: LAMP_POS[i].x + (sx - LAMP_POS[i].x) * dot,
                top: LAMP_POS[i].y + (sy - LAMP_POS[i].y) * dot,
                transform: `translate(-50%,-50%) scale(${0.8 + dot * 0.4})`,
                opacity: dot * (0.4 + 0.6 * bloom),
              }}
            >
              <StarDot size={st.r} glow={`rgba(255,179,92,${glow})`} flick={flick} />
            </div>
          </div>
        );
      })}

      {/* hover 光环（星群被选中） */}
      {enter && (
        <div
          style={{
            position: "absolute",
            left: CLUSTER.x,
            top: CLUSTER.y,
            transform: `translate(-50%,-50%) scale(${ringR / 74})`,
            opacity: ringOp,
            width: 74,
            height: 74,
            borderRadius: "50%",
            border: "1.5px dashed rgba(255,179,92,.65)",
          }}
        />
      )}
      {/* 星群标签 */}
      {enter && (
        <div
          style={{
            position: "absolute",
            left: CLUSTER.x,
            top: CLUSTER.y - 64,
            transform: `translate(-50%,-50%) translateY(${(1 - tagOp) * 10}px)`,
            opacity: tagOp,
            padding: "7px 16px",
            borderRadius: 999,
            background: "rgba(28,25,23,.85)",
            border: "1px solid rgba(255,179,92,.4)",
            fontFamily: SANS,
            fontSize: 15,
            color: C.emberSoft,
            whiteSpace: "nowrap",
          }}
        >
          王家的纪念馆 · 3 位家人
        </div>
      )}

      {/* 标题 */}
      {enter && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 118, textAlign: "center", opacity: titleOp, transform: `translateY(${titleUp}px)` }}>
          <p style={{ fontFamily: SERIF, fontSize: 40, color: "#f5f0e6", letterSpacing: "0.12em", textShadow: "0 2px 30px rgba(0,0,0,.6)" }}>彼岸 · 纪念星海</p>
          <p style={{ fontFamily: SANS, fontSize: 16, color: "rgba(216,169,92,.85)", letterSpacing: "0.24em", marginTop: 12, opacity: subOp }}>每一颗星，是一座纪念馆</p>
        </div>
      )}

      {/* 收束：星座标签 + 品牌 */}
      {f >= 244 && (
        <>
          <div style={{ position: "absolute", left: CLUSTER.x, top: CLUSTER.y + 46, transform: "translateX(-50%)", opacity: clLabelOp }}>
            <p style={{ fontFamily: SANS, fontSize: 12, color: "rgba(255,246,236,.6)", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>王家的纪念馆 · 灯火常明</p>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 176, textAlign: "center", opacity: brandOp, transform: `translateY(${(1 - brandOp) * 20}px)` }}>
            <p style={{ fontFamily: SERIF, fontSize: 58, color: "#f5f0e6", letterSpacing: `${brandSp}em`, marginRight: `-${brandSp}em`, textShadow: "0 2px 40px rgba(0,0,0,.6)" }}>思念有处安放</p>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 272, textAlign: "center", opacity: subBrandOp, transform: `translateY(${(1 - subBrandOp) * 12}px)` }}>
            <p style={{ fontFamily: SERIF, fontSize: 25, color: "rgba(216,169,92,.9)", letterSpacing: "0.5em", marginRight: "-0.5em" }}>彼岸 · 线上纪念馆</p>
          </div>
        </>
      )}

      {/* 暗角 */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 58%, rgba(0,0,0,.4))", opacity: fieldOp }} />
    </div>
  );
}
