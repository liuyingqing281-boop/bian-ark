/**
 * S2a F330–F540｜纪念馆主页建立 → 写入记忆
 * 接收向导大运动②移交的头像；F462–F500 记忆卡右滑移交 SceneChat
 */
import React from "react";
import { tw, typer, on, wave, counter, E } from "./engine";
import { C, SANS, SERIF } from "./shared";

const TIMELINE = [
  { year: "1948", title: "出生在江南水乡", f0: 372 },
  { year: "1970", title: "成为一名小学教师", f0: 378 },
  { year: "1998", title: "退休，开始学做腌菜", f0: 384 },
  { year: "2023", title: "安静地离开了我们", f0: 390 },
];

export default function SceneMemorial({ f }: { f: number }) {
  if (f < 326 || f > 665) return null;

  const pageIn = tw(f, 330, 356, 0, 1, E.snap);
  // 相机缓慢下推：揭示时间轴
  const camY = tw(f, 380, 430, 0, -150, E.smooth);
  // 对话进入时页面左移缩小
  const shiftX = tw(f, 462, 500, 0, -210, E.smooth);
  const pageScale = tw(f, 462, 500, 1, 0.9, E.smooth);
  const pageOp = (1 - tw(f, 520, 545, 0, 0.55, E.press)) * (1 - tw(f, 616, 648, 0, 1, E.press));

  // 记忆档案特写卡
  const cardIn = tw(f, 410, 432, 0, 1, E.snap);
  const cardOut = tw(f, 462, 500, 0, 1, E.grand); // 右滑移交
  const cardX = 340 + cardOut * 560;
  const cardY = 200 + cardOut * -110;
  const cardScale = 1 - cardOut * 0.62;
  const cardOp = cardIn * (1 - tw(f, 492, 512, 0, 1, E.press));

  const btnPress = tw(f, 418, 424, 1, 0.94, E.press) * tw(f, 424, 430, 0.94, 1, E.pop);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* 馆主页 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: pageIn * pageOp,
          transform: `translate(${shiftX}px, 0px) scale(${pageScale})`,
          transformOrigin: "50% 45%",
        }}
      >
        <div style={{ position: "absolute", left: 210, top: 60 + camY, width: 860 }}>
          {/* 封面 */}
          <div
            style={{
              height: 250,
              borderRadius: 14,
              overflow: "hidden",
              position: "relative",
              background: "linear-gradient(180deg,#292524,#1c1917)",
              opacity: tw(f, 332, 350, 0, 1, E.soft),
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 55% at 50% 118%, rgba(190,110,40,0.4), transparent 70%)" }} />
            <span style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", fontSize: 60, opacity: 0.16 }}>🕊️</span>
          </div>

          {/* 头像：承接向导大运动②（F336 落位） */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 250,
              transform: `translateX(-50%) scale(${tw(f, 336, 356, 1.7, 1, E.grand)})`,
              width: 112,
              height: 112,
              borderRadius: "50%",
              background: "linear-gradient(145deg,#78716c,#44403c)",
              border: "4px solid #0c0a09",
              outline: "1.5px solid rgba(180,83,9,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              boxShadow: "0 0 44px rgba(190,130,50,0.4)",
            }}
          >
            🕊️
          </div>

          <p style={{ textAlign: "center", marginTop: 76, fontFamily: SERIF, fontSize: 42, color: C.text, letterSpacing: "0.16em", opacity: tw(f, 344, 360, 0, 1, E.soft), transform: `translateY(${tw(f, 344, 360, 14, 0, E.snap)}px)` }}>王秀兰</p>
          <p style={{ textAlign: "center", marginTop: 8, fontFamily: SANS, fontSize: 21, color: C.text3, opacity: tw(f, 350, 364, 0, 1, E.soft) }}>1948 – 2023 · 外婆</p>

          {/* 生平 */}
          <div style={{ marginTop: 26, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 26px", opacity: tw(f, 358, 376, 0, 1, E.soft), transform: `translateY(${tw(f, 358, 376, 16, 0, E.snap)}px)` }}>
            <p style={{ fontFamily: SERIF, fontSize: 22, color: C.amberSoft, letterSpacing: "0.2em", marginBottom: 8 }}>生平</p>
            <p style={{ fontFamily: SANS, fontSize: 19, color: C.text2, lineHeight: 1.75 }}>
              她做了三十年小学老师，腌的萝卜是整条巷子最好吃的。
            </p>
          </div>

          {/* 时间轴：4 节点错峰落下 */}
          <div style={{ marginTop: 22, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 26px", opacity: tw(f, 366, 380, 0, 1, E.soft) }}>
            <p style={{ fontFamily: SERIF, fontSize: 22, color: C.amberSoft, letterSpacing: "0.2em", marginBottom: 14 }}>时间轴</p>
            <div style={{ borderLeft: "1px solid #57534e", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {TIMELINE.map((ev) => {
                const d = tw(f, ev.f0, ev.f0 + 12, 0, 1, E.pop);
                return (
                  <div key={ev.year} style={{ position: "relative", opacity: d, transform: `translateY(${(1 - d) * 14}px)` }}>
                    <span style={{ position: "absolute", left: -27.5, top: 6, width: 10, height: 10, borderRadius: "50%", background: C.amberDeep, boxShadow: "0 0 0 4px #0c0a09" }} />
                    <span style={{ fontFamily: SANS, fontSize: 18, color: C.amber, marginRight: 14, letterSpacing: "0.1em" }}>{ev.year}</span>
                    <span style={{ fontFamily: SANS, fontSize: 19, color: C.text2 }}>{ev.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 记忆档案特写（约占画面 47% 宽） */}
      {cardOp > 0 && (
        <>
          <div style={{ position: "absolute", inset: 0, background: `rgba(7,3,2,${0.4 * cardIn * (1 - cardOut)})` }} />
          <div
            style={{
              position: "absolute",
              left: cardX,
              top: cardY,
              width: 600,
              transform: `scale(${cardScale * (0.94 + cardIn * 0.06)})`,
              transformOrigin: "top left",
              opacity: cardOp,
              background: C.panel,
              border: `1px solid ${on(f, 424, 462) ? "rgba(217,119,6,0.55)" : C.border}`,
              borderRadius: 14,
              padding: "22px 26px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <p style={{ fontFamily: SERIF, fontSize: 24, color: C.amberSoft, letterSpacing: "0.18em" }}>记忆档案</p>
              <p style={{ fontFamily: SANS, fontSize: 19, color: C.text3 }}>
                已记录 <span style={{ color: C.amberSoft, fontSize: 23, fontWeight: 700 }}>{counter(f, 458, 468, 12, 13, E.pop)}</span> 段
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, opacity: tw(f, 416, 428, 0, 1, E.soft) }}>
              {["口头禅", "喜欢的事", "我们的故事"].map((t) => (
                <span key={t} style={{ fontSize: 17, fontFamily: SANS, color: C.text3, padding: "4px 12px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.borderSoft}` }}>{t}</span>
              ))}
            </div>

            {/* 新记忆写入区 */}
            <div style={{ marginTop: 14, minHeight: 96, background: C.input, border: `1px solid ${on(f, 424, 462) ? C.amber : C.border}`, borderRadius: 10, padding: "14px 18px", fontFamily: SANS, fontSize: 20, color: C.text, lineHeight: 1.7 }}>
              {f >= 430 ? typer(f, 430, "他每次见到我们，第一句话就是：吃饭了没。", 2) : <span style={{ color: C.text3, opacity: tw(f, 416, 426, 0, 1) }}>记录一段关于 TA 的记忆……</span>}
              {on(f, 430, 458) && <span style={{ display: "inline-block", width: 2, height: 20, background: C.amberSoft, verticalAlign: "-3px", opacity: wave(f, 16) > 0.4 ? 1 : 0 }} />}
            </div>

            <div
              style={{
                marginTop: 14,
                height: 50,
                borderRadius: 999,
                background: `linear-gradient(145deg,${C.amberSoft},${C.amber})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 21,
                fontFamily: SANS,
                fontWeight: 600,
                color: "#1c1917",
                letterSpacing: "0.16em",
                transform: `scale(${btnPress})`,
              }}
            >
              ＋ 记录一段记忆
            </div>
          </div>
        </>
      )}
    </div>
  );
}
