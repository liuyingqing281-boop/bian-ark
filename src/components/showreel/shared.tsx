/**
 * Showreel 共享视觉元素 —— 复刻项目真实 UI 语言
 * 墓园石碑 / 星空 / 萤火虫 / 烛火 / 光标
 */
import React from "react";
import { wave } from "./engine";

export const C = {
  bg: "#0c0a09",
  panel: "rgba(28,25,23,0.92)",
  panelSub: "rgba(41,37,36,0.72)",
  input: "#292524",
  text: "#e7e5e4",
  text2: "#a8a29e",
  text3: "#78716c",
  amber: "#d97706",
  amberSoft: "#fbbf24",
  amberDeep: "#b45309",
  ember: "#ff7a2f",
  emberSoft: "#ffb35c",
  border: "rgba(68,64,60,0.78)",
  borderSoft: "rgba(255,255,255,0.09)",
};

export const SERIF = '"Songti SC","Noto Serif SC","SimSun",serif';
export const SANS = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';

/** 石碑（复刻 GardenScene.Tombstone 的比例与质感） */
export function Tombstone({
  name,
  years,
  emoji = "🕊️",
  scale = 1,
  lit = 0,
}: {
  name: string;
  years: string;
  emoji?: string;
  scale?: number;
  /** 0–1 烛光点亮程度 */
  lit?: number;
}) {
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: "bottom center", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      {lit > 0.02 && (
        <div
          style={{
            position: "absolute",
            bottom: -6,
            width: 90,
            height: 60,
            background: `radial-gradient(ellipse 50% 60% at 50% 80%, rgba(255,150,50,${0.5 * lit}), transparent 70%)`,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          width: 104,
          borderRadius: "52px 52px 0 0",
          background: "linear-gradient(180deg,#a8a29e 0%,#78716c 55%,#57534e 100%)",
          padding: "20px 8px 12px",
          textAlign: "center",
          boxShadow: "0 10px 24px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            margin: "0 auto 6px",
            borderRadius: "50%",
            background: "rgba(68,64,60,0.6)",
            border: "1px solid rgba(168,162,158,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
        >
          {emoji}
        </div>
        <p style={{ color: "#1c1917", fontSize: 15, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden" }}>{name}</p>
        <p style={{ color: "#44403c", fontSize: 11, marginTop: 2 }}>{years}</p>
      </div>
      <div style={{ width: 120, height: 10, background: "#57534e", borderRadius: "0 0 6px 6px", boxShadow: "0 4px 10px rgba(0,0,0,0.5)" }} />
    </div>
  );
}

/** 星空（确定性位置） */
export function Stars({ f, count = 30, opacity = 1 }: { f: number; count?: number; opacity?: number }) {
  const stars = Array.from({ length: count }, (_, i) => {
    const x = ((i * 137.5) % 100);
    const y = ((i * 61.8) % 30);
    const s = 1 + ((i * 7) % 3) * 0.5;
    const twk = 0.4 + 0.6 * wave(f, 90 + (i % 5) * 30, i * 13);
    return { x, y, s, a: twk };
  });
  return (
    <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
      {stars.map((st, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            borderRadius: "50%",
            background: "#e7e5e4",
            opacity: st.a,
          }}
        />
      ))}
    </div>
  );
}

/** 萤火虫（帧驱动漂移） */
export function Fireflies({ f, count = 8, opacity = 1 }: { f: number; count?: number; opacity?: number }) {
  const flies = Array.from({ length: count }, (_, i) => {
    const bx = 8 + ((i * 173) % 84);
    const by = 34 + ((i * 97) % 34);
    const dx = Math.sin((f / 210) * Math.PI * 2 + i * 1.7) * 2.2;
    const dy = Math.cos((f / 260) * Math.PI * 2 + i * 2.3) * 1.6;
    const a = 0.25 + 0.55 * wave(f, 100 + (i % 4) * 40, i * 29);
    return { x: bx + dx, y: by + dy, a };
  });
  return (
    <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
      {flies.map((fl, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${fl.x}%`,
            top: `${fl.y}%`,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#fcd34d",
            boxShadow: "0 0 10px 3px rgba(252,211,77,0.55)",
            opacity: fl.a,
          }}
        />
      ))}
    </div>
  );
}

/** 烛火（帧驱动三层火苗，非 CSS 循环动画） */
export function FlameVisual({ f, scale = 1, intensity = 1 }: { f: number; scale?: number; intensity?: number }) {
  if (intensity <= 0.01) return null;
  const sway = Math.sin(f / 7) * 2.2 + Math.sin(f / 3.1) * 1.1;
  const h = 1 + Math.sin(f / 5.3) * 0.06;
  return (
    <div style={{ transform: `scale(${scale * intensity})`, transformOrigin: "bottom center", width: 40, height: 64, position: "relative", opacity: Math.min(1, intensity * 1.6) }}>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          width: 60,
          height: 60,
          transform: "translateX(-50%)",
          background: `radial-gradient(circle, rgba(255,150,50,${0.4 * intensity}), transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          width: 18,
          height: 44 * h,
          transform: `translateX(-50%) rotate(${sway}deg)`,
          transformOrigin: "bottom center",
          borderRadius: "50% 50% 50% 50% / 62% 62% 38% 38%",
          background: "linear-gradient(180deg,#ffdf8e 0%,#ffb35c 45%,#ff7a2f 80%,#e0531a 100%)",
          filter: "blur(0.4px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 2,
          left: "50%",
          width: 8,
          height: 22 * h,
          transform: `translateX(-50%) rotate(${-sway * 0.6}deg)`,
          transformOrigin: "bottom center",
          borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
          background: "linear-gradient(180deg,#fff7e0,#ffd98e)",
        }}
      />
    </div>
  );
}

/** 全局光标（经典指针，按压缩放） */
export function Cursor({
  x,
  y,
  press = 0,
  opacity = 1,
}: {
  x: number;
  y: number;
  press?: number;
  opacity?: number;
}) {
  if (opacity <= 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px) scale(${1 - press * 0.18})`,
        transformOrigin: "6px 4px",
        opacity,
        zIndex: 90,
        pointerEvents: "none",
        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.55))",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24">
        <path d="M5 3l14 7.2-6.4 1.6L9 18.4 5 3z" fill="#fafaf9" stroke="#1c1917" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      {press > 0.3 && (
        <span
          style={{
            position: "absolute",
            left: 2,
            top: 0,
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "2px solid rgba(251,191,36,0.8)",
            transform: `scale(${0.6 + press * 0.9})`,
            opacity: 1 - press,
          }}
        />
      )}
    </div>
  );
}
