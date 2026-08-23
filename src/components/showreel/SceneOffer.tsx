/**
 * S3 F628–F830｜祭堂：选择蜡烛 → 点亮 → 烛火燃起 → 祭奠记录错峰上墙
 * F766–F810 烛火特写放大，移交 SceneFinale 大拉远
 */
import React from "react";
import { tw, on, wave, counter, E } from "./engine";
import { C, SANS, SERIF, FlameVisual } from "./shared";

const ITEMS = [
  { icon: "🌹", label: "鲜花", x: 364 },
  { icon: "🕯️", label: "蜡烛", x: 508 },
  { icon: "🪔", label: "清香", x: 652 },
  { icon: "🍰", label: "糕点", x: 796 },
];

const WALL = [
  { name: "李**", act: "点亮了蜡烛", icon: "🕯️", f0: 720 },
  { name: "王**", act: "献上了一束鲜花", icon: "🌹", f0: 736 },
  { name: "张**", act: "上了一炷清香", icon: "🪔", f0: 752 },
];

export default function SceneOffer({ f }: { f: number }) {
  if (f < 624 || f > 832) return null;

  const sceneIn = tw(f, 628, 656, 0, 1, E.smooth);
  // F766 起推向烛火特写
  const zoom = tw(f, 766, 812, 1, 2.0, E.grand);
  const sceneOp = 1 - tw(f, 800, 826, 0, 1, E.press);
  const chromeOp = 1 - tw(f, 770, 798, 0, 1, E.press); // 墙/计数/祭品栏在特写前退出

  const flame = tw(f, 684, 726, 0, 1, E.snap); // 烛火燃起
  const glow = tw(f, 690, 730, 0, 1, E.smooth); // 光晕扩散（错峰）
  const warmth = tw(f, 696, 734, 0, 1, E.smooth); // 背景暖度（再错峰）
  const selRing = tw(f, 660, 668, 0, 1, E.pop); // 选中「蜡烛」
  const btnPress = tw(f, 684, 690, 1, 0.93, E.press) * tw(f, 690, 696, 0.93, 1, E.pop);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: sceneOp, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: "640px 330px",
          opacity: sceneIn,
        }}
      >
        {/* 熔岩暖色背景（复刻祭堂页） */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(120% 55% at 50% -8%, rgba(255,106,32,${0.22 + warmth * 0.14}), transparent 60%), radial-gradient(90% 40% at 50% 115%, rgba(180,58,14,${0.18 + warmth * 0.1}), transparent 65%), #070302`,
          }}
        />

        {/* 标题 */}
        <p style={{ position: "absolute", left: 0, right: 0, top: 52, textAlign: "center", fontFamily: SERIF, fontSize: 34, letterSpacing: "0.4em", marginRight: "-0.4em", color: "#fff6ec", opacity: tw(f, 636, 654, 0, 1, E.soft) * chromeOp }}>祭 堂</p>

        {/* 中央烛台 */}
        <div style={{ position: "absolute", left: 640, top: 330, transform: "translate(-50%,-50%)", textAlign: "center" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -70,
              width: 320,
              height: 320,
              transform: "translate(-50%,-50%)",
              background: `radial-gradient(circle, rgba(255,150,50,${glow * 0.3}), transparent 65%)`,
            }}
          />
          <div style={{ position: "relative", height: 120, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ position: "absolute", bottom: 34 }}>
              <FlameVisual f={f} scale={1.15} intensity={flame} />
            </div>
            {/* 烛体 */}
            <div style={{ width: 30, height: 62, borderRadius: 6, background: "linear-gradient(90deg,#f5ead2,#d9c9a8 60%,#b8a67f)", boxShadow: "0 4px 14px rgba(0,0,0,0.5)" }} />
          </div>
          <div style={{ width: 90, height: 12, margin: "2px auto 0", borderRadius: 6, background: "linear-gradient(180deg,#6b4a2a,#4a3018)" }} />
        </div>

        {/* 祭品栏 */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 470, display: "flex", justifyContent: "center", gap: 24, opacity: tw(f, 644, 660, 0, 1, E.snap) * chromeOp, transform: `translateY(${tw(f, 644, 660, 24, 0, E.snap)}px)` }}>
          {ITEMS.map((it, i) => {
            const isCandle = it.label === "蜡烛";
            const sel = isCandle ? selRing : 0;
            return (
              <div
                key={it.label}
                style={{
                  width: 120,
                  height: 128,
                  borderRadius: 14,
                  border: `1.5px solid ${sel > 0.4 ? C.emberSoft : "rgba(255,255,255,0.12)"}`,
                  background: sel > 0.4 ? "rgba(255,122,47,0.14)" : "rgba(255,255,255,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transform: `scale(${1 + sel * 0.06}) translateY(${tw(f, 648 + i * 3, 660 + i * 3, 16, 0, E.snap)}px)`,
                  boxShadow: sel > 0.4 ? "0 0 26px rgba(255,150,60,0.28)" : "none",
                }}
              >
                <span style={{ fontSize: 40 }}>{it.icon}</span>
                <span style={{ fontFamily: SANS, fontSize: 20, color: "#fff6ec" }}>{it.label}</span>
                <span style={{ fontFamily: SANS, fontSize: 15, color: C.emberSoft, background: "rgba(255,179,92,0.12)", border: "1px solid rgba(255,179,92,0.3)", borderRadius: 6, padding: "2px 10px" }}>免费</span>
              </div>
            );
          })}
        </div>

        {/* 点亮按钮 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 640,
            transform: `translateX(-50%) scale(${btnPress})`,
            width: 240,
            height: 56,
            borderRadius: 999,
            background: `linear-gradient(145deg,${C.emberSoft},${C.ember})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SANS,
            fontSize: 23,
            fontWeight: 700,
            letterSpacing: "0.3em",
            color: "#2a0e02",
            opacity: tw(f, 650, 664, 0, 1, E.snap) * chromeOp,
            boxShadow: flame > 0 ? "0 0 40px rgba(255,150,60,0.45)" : "0 0 18px rgba(255,122,47,0.25)",
          }}
        >
          {flame > 0.5 ? "已点亮" : "点亮"}
        </div>

        {/* 祭奠记录墙（错峰上墙） */}
        <div style={{ position: "absolute", left: 960, top: 140, width: 280, opacity: chromeOp }}>
          <p style={{ fontFamily: SANS, fontSize: 19, color: "rgba(255,246,236,0.55)", marginBottom: 12, opacity: tw(f, 706, 720, 0, 1, E.soft) }}>
            祭奠记录 · <span style={{ color: C.emberSoft, fontWeight: 700, fontSize: 22 }}>{counter(f, 720, 770, 1024, 1027, E.snap).toLocaleString()}</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {WALL.map((w) => {
              const d = tw(f, w.f0, w.f0 + 14, 0, 1, E.snap);
              return (
                <div
                  key={w.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    opacity: d,
                    transform: `translateY(${(1 - d) * 18}px) scale(${0.95 + d * 0.05})`,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{w.icon}</span>
                  <span style={{ fontFamily: SANS, fontSize: 18, color: "#fff6ec" }}>
                    <b style={{ color: C.emberSoft }}>{w.name}</b> {w.act}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
