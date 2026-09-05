/**
 * 10s 星海版 S2｜聚焦抽屉：人物卡 → 按住 🎙 说话（语音识别转写）→
 * TA 的声音回答（AI 复刻声 + 「AI 合成声音」标识 + 记忆引用）→「为全家点灯」合祭入口
 * 语音范围遵循 docs/14：识别/朗读仅限交流对话框，复刻声带 AI 标识
 */
import React from "react";
import { tw, typer, on, wave, E } from "./engine";
import { C, SANS, SERIF } from "./shared";

const PX = 704; // 抽屉停靠后左边
const PW = 576;

const USER_TEXT = "外婆，最近工作好累……";
const AI_TEXT = "好好吃饭，别太累了。";

export default function Scene10Drawer({ f }: { f: number }) {
  if (f < 126 || f > 288) return null;

  const slide = tw(f, 128, 152, 0, 1, E.smooth);
  const panelX = 1280 - slide * (1280 - PX);
  const panelOp = 1 - tw(f, 266, 284, 0, 1, E.press);

  /* 人物卡错峰 */
  const avIn = tw(f, 132, 144, 0, 1, E.snap);
  const nmIn = tw(f, 136, 148, 0, 1, E.snap);
  const epIn = tw(f, 143, 155, 0, 1, E.snap);
  /* 聊天头 + 诚实角标 */
  const chIn = tw(f, 150, 162, 0, 1, E.snap);
  const bdIn = tw(f, 157, 167, 0, 1, E.soft);

  /* 语音输入（按住 F172–F196） */
  const holding = on(f, 172, 196);
  const recSheet = tw(f, 174, 184, 0, 1, E.snap) * (1 - tw(f, 196, 204, 0, 1, E.press));
  const transcript = typer(f, 176, USER_TEXT, 2);

  /* 用户气泡 / 思考 / AI 回答 */
  const sent = f >= 202;
  const think = on(f, 206, 217);
  const aiIn = tw(f, 217, 227, 0, 1, E.snap);
  const aiTyped = typer(f, 220, AI_TEXT, 2);
  const voiceBadge = tw(f, 230, 240, 0, 1, E.soft);
  const evIn = tw(f, 242, 252, 0, 1, E.soft);

  /* 🎳 按钮状态 */
  const micPress = holding ? 0.88 : 1;
  const micGlow = holding ? 1 : tw(f, 160, 172, 0.25, 1, E.soft) * 0.35;

  /* 为全家点灯 */
  const btnIn = tw(f, 168, 180, 0, 1, E.snap);
  const done = f >= 246;
  const btnPress = tw(f, 240, 246, 1, 0.95, E.press) * tw(f, 246, 252, 0.95, 1, E.pop);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: panelOp, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: panelX,
          top: 64,
          width: PW,
          height: 636,
          background: "rgba(18,15,14,0.97)",
          border: `1px solid ${C.border}`,
          borderRadius: "16px 0 0 16px",
          boxShadow: "-24px 0 70px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 人物卡（承接聚焦的灯） */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px 14px" }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: "linear-gradient(135deg,rgba(255,122,47,.4),rgba(255,122,47,.12))",
              border: "1.5px solid rgba(255,179,92,.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SERIF,
              fontSize: 26,
              color: C.emberSoft,
              opacity: avIn,
              transform: `scale(${tw(f, 132, 146, 0.8, 1, E.pop)})`,
            }}
          >
            王
          </div>
          <div style={{ flex: 1, opacity: nmIn, transform: `translateY(${(1 - nmIn) * 8}px)` }}>
            <p style={{ fontFamily: SERIF, fontSize: 22, color: C.text }}>王秀兰 <span style={{ fontFamily: SANS, fontSize: 15, color: C.text3 }}>· 外婆</span></p>
            <p style={{ fontFamily: SANS, fontSize: 13, color: C.text3, marginTop: 3 }}>1948 — 2023 · 长明灯位已安放</p>
          </div>
        </div>
        <div
          style={{
            margin: "0 22px 6px",
            borderLeft: "3px solid rgba(255,179,92,.5)",
            padding: "6px 12px",
            opacity: epIn,
            transform: `translateY(${(1 - epIn) * 8}px)`,
          }}
        >
          <p style={{ fontFamily: SERIF, fontSize: 16, color: C.text2, fontStyle: "italic" }}>“她总是先问我们，吃饭了没。”</p>
        </div>

        {/* 聊天头 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 22px 8px", opacity: chIn }}>
          <p style={{ fontFamily: SERIF, fontSize: 19, color: C.text }}>和外婆说说话</p>
          <span style={{ fontFamily: SANS, fontSize: 12, color: C.text3, border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 10px" }}>不是 TA 本人</span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: SANS,
              fontSize: 12,
              color: C.amberSoft,
              border: "1px solid rgba(217,119,6,.45)",
              background: "rgba(217,119,6,.12)",
              borderRadius: 999,
              padding: "3px 10px",
              opacity: bdIn,
            }}
          >
            基于 TA 的资料推测
          </span>
        </div>

        {/* 消息区 */}
        <div style={{ flex: 1, padding: "6px 22px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
          {/* 语音录入面板（按住说话） */}
          {recSheet > 0.01 && (
            <div
              style={{
                border: `1px solid rgba(255,179,92,.4)`,
                background: "rgba(217,119,6,.1)",
                borderRadius: 14,
                padding: "12px 16px",
                opacity: recSheet,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: `rgba(217,119,6,.9)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  transform: `scale(${1 + wave(f, 14) * 0.08})`,
                }}
              >
                🎙
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 3, height: 26 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 4,
                      borderRadius: 2,
                      background: C.emberSoft,
                      height: 6 + 16 * wave(f, 9, i * 3),
                    }}
                  />
                ))}
              </div>
              <p style={{ fontFamily: SANS, fontSize: 19, color: C.text, flex: 1 }}>{transcript}<span style={{ opacity: wave(f, 16) > 0.4 ? 1 : 0 }}>▍</span></p>
            </div>
          )}

          {/* 用户气泡 */}
          {sent && (
            <div
              style={{
                alignSelf: "flex-end",
                maxWidth: "82%",
                background: "rgba(217,119,6,.22)",
                border: "1px solid rgba(217,119,6,.4)",
                borderRadius: "13px 13px 4px 13px",
                padding: "10px 14px",
                fontFamily: SANS,
                fontSize: 19,
                color: C.text,
                transform: `translateY(${tw(f, 202, 212, 12, 0, E.snap)}px) scale(${tw(f, 202, 210, 0.94, 1, E.pop)})`,
                transformOrigin: "bottom right",
                opacity: tw(f, 202, 209, 0, 1, E.snap),
              }}
            >
              {USER_TEXT}
            </div>
          )}

          {/* 思考指示 */}
          {think && (
            <div style={{ alignSelf: "flex-start", display: "flex", gap: 5, padding: "12px 16px", background: "rgba(255,255,255,.05)", border: `1px solid ${C.borderSoft}`, borderRadius: "13px 13px 13px 4px" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.text2, opacity: 0.3 + 0.7 * wave(f, 11, i * 4) }} />
              ))}
            </div>
          )}

          {/* AI 回答（TA 的复刻声朗读） */}
          {f >= 217 && (
            <div style={{ alignSelf: "flex-start", maxWidth: "88%", opacity: aiIn, transform: `translateY(${(1 - aiIn) * 14}px)` }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 36, height: 36, flex: "0 0 auto", borderRadius: "50%", background: "linear-gradient(145deg,#78716c,#44403c)", border: "1.5px solid rgba(255,179,92,.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🕊️</div>
                <div style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${C.borderSoft}`, borderRadius: "13px 13px 13px 4px", padding: "10px 14px", fontFamily: SANS, fontSize: 19, color: C.text, lineHeight: 1.6 }}>
                  {aiTyped}
                  {on(f, 220, 242) && <span style={{ opacity: wave(f, 16) > 0.4 ? 1 : 0 }}>▍</span>}
                </div>
              </div>
              {/* 正在用 TA 的声音朗读 */}
              {voiceBadge > 0.01 && (
                <div style={{ marginLeft: 46, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,179,92,.4)", background: "rgba(255,179,92,.08)", borderRadius: 999, padding: "5px 12px", opacity: voiceBadge, transform: `translateY(${(1 - voiceBadge) * 8}px)` }}>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.emberSoft }}>🔊</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 2, height: 14 }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{ width: 3, borderRadius: 1, background: C.emberSoft, height: 4 + 9 * wave(f, 8, i * 3) }} />
                    ))}
                  </span>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: C.emberSoft }}>AI 合成声音</span>
                </div>
              )}
              {/* 记忆引用 */}
              {evIn > 0.01 && (
                <div style={{ marginLeft: 46, marginTop: 8, borderLeft: `3px solid ${C.amber}`, background: "rgba(217,119,6,.08)", borderRadius: "0 10px 10px 0", padding: "7px 12px", opacity: evIn, transform: `translateY(${(1 - evIn) * 10}px)` }}>
                  <p style={{ fontFamily: SANS, fontSize: 14, color: C.text2 }}>「吃饭了没」—— 外婆的口头禅 · 来自记忆档案</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 输入栏：按住 🎳 说话 */}
        <div style={{ padding: "0 22px 12px", display: "flex", gap: 12, opacity: chIn }}>
          <div style={{ flex: 1, height: 48, background: C.input, border: `1px solid ${C.border}`, borderRadius: 999, padding: "0 18px", display: "flex", alignItems: "center", fontFamily: SANS, fontSize: 16, color: C.text3 }}>
            {holding ? "正在听你说……" : "按住麦克风，对外婆说句话"}
          </div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: `linear-gradient(145deg,${C.amberSoft},${C.amber})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              transform: `scale(${micPress})`,
              boxShadow: `0 0 ${12 * micGlow}px rgba(255,179,92,.55)`,
            }}
          >
            🎙
          </div>
        </div>

        {/* 合祭入口：为全家点灯 */}
        {btnIn > 0.01 && (
          <div style={{ padding: "0 22px 20px", opacity: btnIn, transform: `translateY(${(1 - btnIn) * 14}px)` }}>
            <div
              style={{
                height: 52,
                borderRadius: 999,
                background: done ? "rgba(68,64,60,.5)" : "linear-gradient(145deg,#ffb35c,#d97706)",
                border: done ? "1px solid rgba(255,179,92,.3)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: SANS,
                fontSize: 19,
                fontWeight: 600,
                color: done ? C.emberSoft : "#1c1917",
                transform: `scale(${btnPress})`,
                opacity: done ? tw(f, 246, 254, 1, 0.85, E.soft) : 1,
              }}
            >
              {done ? "✓ 已为全家 3 位点亮" : "🔥 为全家点灯 · 免费"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
