/**
 * S2b F490–F672｜缅怀对话：提问 → AI 基于记忆回答 → 引用卡 + 追问（系统联动）
 * 接收记忆卡右滑交接；F628 对话头像变形为烛台移交 SceneOffer
 */
import React from "react";
import { tw, typer, on, wave, E } from "./engine";
import { C, SANS, SERIF } from "./shared";

const PX = 660; // 面板左（停靠后）
const PY = 40;
const PW = 580;

export default function SceneChat({ f }: { f: number }) {
  if (f < 486 || f > 676) return null;

  const slideIn = tw(f, 496, 524, 0, 1, E.smooth); // 面板自右推入（与记忆卡交接重叠）
  const panelX = 1280 - slideIn * (1280 - PX);
  const panelOp = 1 - tw(f, 648, 672, 0, 1, E.press);

  const userText = "最近工作好累，要是以前……";
  const typed = typer(f, 502, userText, 3);
  const sent = f >= 546;
  const sendPress = tw(f, 540, 546, 1, 0.9, E.press) * tw(f, 546, 552, 0.9, 1, E.pop);

  const thinking = on(f, 556, 576);
  const aiIn = tw(f, 574, 592, 0, 1, E.snap);
  const evIn = tw(f, 588, 608, 0, 1, E.snap); // 引用卡错峰
  const fuIn = tw(f, 606, 622, 0, 1, E.snap); // 追问再错峰

  return (
    <div style={{ position: "absolute", inset: 0, opacity: panelOp, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: panelX,
          top: PY,
          width: PW,
          height: 640,
          background: "rgba(20,17,16,0.96)",
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 头部：头像 + 诚实角标 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "linear-gradient(145deg,#78716c,#44403c)",
              border: "2px solid rgba(180,83,9,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              opacity: 1 - tw(f, 628, 650, 0, 1, E.press), // 头像变形移交祭堂
            }}
          >
            🕊️
          </div>
          <div>
            <p style={{ fontFamily: SERIF, fontSize: 22, color: C.text }}>和外婆说说话</p>
            <p style={{ fontFamily: SANS, fontSize: 16, color: C.text3, marginTop: 2 }}>缅怀对话 · 不是 TA 本人</p>
          </div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 16,
              fontFamily: SANS,
              color: C.amberSoft,
              border: "1px solid rgba(217,119,6,0.45)",
              background: "rgba(217,119,6,0.12)",
              padding: "5px 12px",
              borderRadius: 999,
              opacity: tw(f, 512, 526, 0, 1, E.soft),
            }}
          >
            基于 TA 的资料推测
          </span>
        </div>

        {/* 消息区 */}
        <div style={{ flex: 1, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
          {/* 用户气泡 */}
          {sent && (
            <div style={{ alignSelf: "flex-end", maxWidth: "78%", background: "rgba(217,119,6,0.22)", border: "1px solid rgba(217,119,6,0.4)", borderRadius: "14px 14px 4px 14px", padding: "12px 16px", fontFamily: SANS, fontSize: 20, color: C.text, transform: `translateY(${tw(f, 546, 558, 14, 0, E.snap)}px) scale(${tw(f, 546, 556, 0.92, 1, E.pop)})`, transformOrigin: "bottom right", opacity: tw(f, 546, 554, 0, 1, E.snap) }}>
              {userText}
            </div>
          )}

          {/* 输入指示 */}
          {thinking && (
            <div style={{ alignSelf: "flex-start", display: "flex", gap: 6, padding: "14px 18px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.borderSoft}`, borderRadius: "14px 14px 14px 4px" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.text2, opacity: 0.3 + 0.7 * wave(f, 12, i * 4) }} />
              ))}
            </div>
          )}

          {/* AI 回答 + 记忆引用卡 + 追问（错峰联动） */}
          {f >= 574 && (
            <div style={{ alignSelf: "flex-start", maxWidth: "88%", opacity: aiIn, transform: `translateY(${(1 - aiIn) * 16}px)` }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 40, height: 40, flex: "0 0 auto", borderRadius: "50%", background: "linear-gradient(145deg,#78716c,#44403c)", border: "1.5px solid rgba(180,83,9,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>🕊️</div>
                <div style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.borderSoft}`, borderRadius: "14px 14px 14px 4px", padding: "12px 16px", fontFamily: SANS, fontSize: 20, color: C.text, lineHeight: 1.65 }}>
                  爷爷大概会先问你，有没有好好吃饭。
                </div>
              </div>

              {/* evidence 记忆引用卡：承接 F430 写入的记忆 */}
              {evIn > 0 && (
                <div style={{ marginLeft: 50, marginTop: 10, borderLeft: `3px solid ${C.amber}`, background: "rgba(217,119,6,0.08)", borderRadius: "0 10px 10px 0", padding: "10px 14px", opacity: evIn, transform: `translateY(${(1 - evIn) * 14}px)` }}>
                  <p style={{ fontFamily: SANS, fontSize: 18, color: C.text2, lineHeight: 1.6 }}>「他每次见到我们，第一句话就是：吃饭了没。」</p>
                  <p style={{ fontFamily: SANS, fontSize: 15, color: C.text3, marginTop: 5 }}>来自记忆档案 · 口头禅</p>
                </div>
              )}

              {fuIn > 0 && (
                <div style={{ marginLeft: 50, marginTop: 10, display: "inline-block", background: "rgba(255,179,92,0.1)", border: "1px solid rgba(255,179,92,0.35)", borderRadius: 999, padding: "8px 16px", fontFamily: SANS, fontSize: 18, color: C.emberSoft, opacity: fuIn, transform: `translateY(${(1 - fuIn) * 12}px)` }}>
                  还记得她喜欢做什么菜吗？
                </div>
              )}
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${C.borderSoft}`, display: "flex", gap: 12 }}>
          <div style={{ flex: 1, height: 52, background: C.input, border: `1px solid ${on(f, 502, 540) ? C.amber : C.border}`, borderRadius: 999, padding: "0 20px", display: "flex", alignItems: "center", fontFamily: SANS, fontSize: 20, color: sent ? C.text3 : C.text }}>
            {sent ? "想 TA 的时候，就来说说话……" : typed}
            {on(f, 500, 540) && <span style={{ marginLeft: 2, width: 2, height: 22, background: C.amberSoft, opacity: wave(f, 16) > 0.4 ? 1 : 0 }} />}
          </div>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(145deg,${C.amberSoft},${C.amber})`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sendPress})` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#1c1917"><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>
          </div>
        </div>
      </div>

      {/* 移交祭堂：对话头像 🕊️ → 烛台 🕯️（F628–F668） */}
      {f >= 628 && (
        <div
          style={{
            position: "absolute",
            left: tw(f, 628, 668, panelX + 48, 640, E.grand),
            top: tw(f, 628, 668, 90, 300, E.grand),
            transform: `translate(-50%,-50%) scale(${tw(f, 628, 668, 1, 2.1, E.grand)})`,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "linear-gradient(145deg,#78716c,#3f2a1a)",
            border: "2px solid rgba(255,179,92,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            boxShadow: `0 0 ${tw(f, 640, 668, 8, 40, E.smooth)}px rgba(255,150,60,0.5)`,
            opacity: 1 - tw(f, 660, 676, 0, 1, E.press),
          }}
        >
          <span style={{ opacity: 1 - tw(f, 640, 652, 0, 1) }}>🕊️</span>
          <span style={{ position: "absolute", opacity: tw(f, 640, 652, 0, 1) }}>🕯️</span>
        </div>
      )}
    </div>
  );
}
