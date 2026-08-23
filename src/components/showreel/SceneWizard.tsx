/**
 * S1 F096–F356｜建馆向导 3 步 → 生成纪念馆（第一次视觉高潮）
 * 接收 SceneGarden 的按钮变形；F296–F340 大运动②：确认卡头像+姓名放大移交 SceneMemorial
 */
import React from "react";
import { tw, typer, on, wave, E } from "./engine";
import { C, SANS, SERIF } from "./shared";

const PX = 310; // 面板左
const PY = 100; // 面板顶
const PW = 660;
const PH = 520;

function StepBar({ f, active }: { f: number; active: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginTop: 26 }}>
      {[1, 2, 3].map((n, i) => {
        // 步骤条提前于内容切换预热高亮
        const pre = [0, 176, 246][i];
        const lit = tw(f, pre, pre + 12, 0, 1, E.snap);
        const isActive = n <= active || lit > 0.5;
        return (
          <React.Fragment key={n}>
            {i > 0 && <div style={{ width: 72, height: 2, background: isActive || tw(f, pre, pre + 12, 0, 1) > 0.5 ? C.amber : "rgba(120,113,108,0.4)", transition: "none" }} />}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontFamily: SANS,
                color: isActive ? "#1c1917" : C.text3,
                background: isActive ? `linear-gradient(145deg,${C.amberSoft},${C.amber})` : "rgba(68,64,60,0.5)",
                transform: `scale(${1 + (lit > 0 && lit < 1 ? Math.sin(lit * Math.PI) * 0.15 : 0)})`,
              }}
            >
              {n}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

const inputBox: React.CSSProperties = {
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  fontFamily: SANS,
  color: C.text,
};

export default function SceneWizard({ f }: { f: number }) {
  if (f < 88 || f > 362) return null;

  const panelIn = tw(f, 96, 118, 0, 1, E.snap);
  // 大运动②：确认卡放大移交（F296–F340）
  const burst = tw(f, 296, 340, 0, 1, E.grand);
  const panelOp = panelIn * (1 - tw(f, 330, 356, 0, 1, E.press));

  // 步骤滑动：S1→S2 F176–196；S2→S3 F246–266
  const s1out = tw(f, 176, 196, 0, 1, E.snap);
  const s2in = tw(f, 180, 200, 0, 1, E.snap);
  const s2out = tw(f, 246, 266, 0, 1, E.snap);
  const s3in = tw(f, 250, 270, 0, 1, E.snap);
  const active = f < 176 ? 1 : f < 246 ? 2 : 3;

  // 生成按钮：按压 + 花瓣生成动效
  const genPress = tw(f, 290, 296, 1, 0.94, E.press) * tw(f, 296, 302, 0.94, 1, E.pop);
  const petal = on(f, 296, 340);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: panelOp, pointerEvents: "none" }}>
      {/* 背景压暗 */}
      <div style={{ position: "absolute", inset: 0, background: `rgba(7,3,2,${0.45 * panelIn})` }} />

      <div
        style={{
          position: "absolute",
          left: PX,
          top: PY,
          width: PW,
          height: PH,
          transform: `translateY(${30 * (1 - panelIn)}px) scale(${0.96 + panelIn * 0.04 - burst * 0.05})`,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
          opacity: 1 - burst * 0.85,
        }}
      >
        <p style={{ textAlign: "center", marginTop: 28, fontFamily: SERIF, fontSize: 30, color: C.text, letterSpacing: "0.12em" }}>为 TA 建一座纪念馆</p>
        <StepBar f={f} active={active} />

        {/* ── 步骤 1：TA 是谁 ── */}
        {f < 196 && (
          <div style={{ position: "absolute", left: 60, top: 170, width: 540, transform: `translateX(${-s1out * 120}px)`, opacity: 1 - s1out }}>
            <p style={{ fontFamily: SANS, fontSize: 20, color: C.text2, marginBottom: 10 }}>TA 的名字</p>
            <div style={{ ...inputBox, height: 56, display: "flex", alignItems: "center", padding: "0 20px", fontSize: 24, borderColor: on(f, 118, 150) ? C.amber : C.border }}>
              {typer(f, 122, "王秀兰", 5)}
              {on(f, 118, 150) && <span style={{ marginLeft: 2, width: 2, height: 26, background: C.amberSoft, opacity: wave(f, 16) > 0.4 ? 1 : 0 }} />}
            </div>

            <p style={{ fontFamily: SANS, fontSize: 20, color: C.text2, margin: "22px 0 10px" }}>与 TA 的关系</p>
            <div style={{ display: "flex", gap: 12, opacity: tw(f, 138, 148, 0, 1, E.soft) }}>
              {["父亲", "母亲", "外婆", "爷爷", "其他"].map((r) => {
                const sel = r === "外婆" ? tw(f, 146, 152, 0, 1, E.pop) : 0;
                return (
                  <div
                    key={r}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 999,
                      fontSize: 20,
                      fontFamily: SANS,
                      border: `1.5px solid ${sel > 0.4 ? C.amber : C.border}`,
                      background: sel > 0.4 ? "rgba(217,119,6,0.22)" : "transparent",
                      color: sel > 0.4 ? C.amberSoft : C.text2,
                      transform: `scale(${1 + sel * 0.08})`,
                    }}
                  >
                    {r}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 20, marginTop: 24, opacity: tw(f, 152, 162, 0, 1, E.soft) }}>
              {["1948", "2023"].map((yr, i) => (
                <div key={yr} style={{ ...inputBox, flex: 1, height: 52, display: "flex", alignItems: "center", padding: "0 18px", fontSize: 22, color: C.text }}>
                  <span style={{ color: C.text3, fontSize: 18, marginRight: 10 }}>{i === 0 ? "生于" : "逝于"}</span>
                  {typer(f, 156 + i * 6, yr, 3)}
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 26,
                height: 52,
                borderRadius: 999,
                background: `linear-gradient(145deg,${C.amberSoft},${C.amber})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontFamily: SANS,
                color: "#1c1917",
                fontWeight: 600,
                letterSpacing: "0.3em",
                transform: `scale(${tw(f, 172, 178, 1, 0.95, E.press) * tw(f, 178, 184, 0.95, 1, E.pop)})`,
                opacity: tw(f, 160, 170, 0, 1, E.soft),
              }}
            >
              下一步
            </div>
          </div>
        )}

        {/* ── 步骤 2：TA 的故事 ── */}
        {f >= 176 && f < 266 && (
          <div style={{ position: "absolute", left: 60, top: 170, width: 540, transform: `translateX(${(1 - s2in) * 120 - s2out * 120}px)`, opacity: s2in * (1 - s2out) }}>
            <p style={{ fontFamily: SANS, fontSize: 20, color: C.text2, marginBottom: 10 }}>TA 是怎样的人</p>
            <div style={{ ...inputBox, height: 150, padding: "16px 20px", fontSize: 21, lineHeight: 1.7, borderColor: on(f, 196, 236) ? C.amber : C.border }}>
              {typer(f, 200, "她总是先问我们，吃饭了没。", 3)}
              {on(f, 196, 238) && <span style={{ display: "inline-block", width: 2, height: 22, background: C.amberSoft, verticalAlign: "-3px", opacity: wave(f, 16) > 0.4 ? 1 : 0 }} />}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {["生平", "相册", "时间轴", "喜欢的事", "口头禅"].map((t, i) => (
                <div
                  key={t}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    fontSize: 18,
                    fontFamily: SANS,
                    color: C.amberSoft,
                    background: "rgba(217,119,6,0.14)",
                    border: "1px solid rgba(217,119,6,0.3)",
                    opacity: tw(f, 218 + i * 4, 226 + i * 4, 0, 1, E.soft),
                    transform: `translateY(${tw(f, 218 + i * 4, 226 + i * 4, 10, 0, E.snap)}px)`,
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
            <p style={{ marginTop: 12, fontSize: 17, fontFamily: SANS, color: C.text3, opacity: tw(f, 228, 238, 0, 1, E.soft) }}>记忆档案已附带 · 5 个分区</p>
            <div
              style={{
                marginTop: 12,
                height: 52,
                borderRadius: 999,
                background: `linear-gradient(145deg,${C.amberSoft},${C.amber})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontFamily: SANS,
                color: "#1c1917",
                fontWeight: 600,
                letterSpacing: "0.3em",
                transform: `scale(${tw(f, 238, 244, 1, 0.95, E.press) * tw(f, 244, 250, 0.95, 1, E.pop)})`,
              }}
            >
              下一步
            </div>
          </div>
        )}

        {/* ── 步骤 3：确认生成 ── */}
        {f >= 246 && (
          <div style={{ position: "absolute", left: 0, top: 150, width: PW, textAlign: "center", transform: `translateX(${(1 - s3in) * 120}px)`, opacity: s3in * (1 - tw(f, 296, 318, 0, 1, E.press)) }}>
            <div
              style={{
                width: 104,
                height: 104,
                margin: "6px auto 0",
                borderRadius: "50%",
                background: "linear-gradient(145deg,#57534e,#292524)",
                border: "3px solid rgba(180,83,9,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 44,
                boxShadow: "0 0 40px rgba(190,130,50,0.35)",
                transform: `scale(${tw(f, 252, 264, 0.6, 1, E.pop)})`,
              }}
            >
              🕊️
            </div>
            <p style={{ marginTop: 14, fontFamily: SERIF, fontSize: 34, color: C.text, letterSpacing: "0.14em", opacity: tw(f, 256, 266, 0, 1, E.soft), transform: `translateY(${tw(f, 256, 266, 12, 0, E.snap)}px)` }}>王秀兰</p>
            <p style={{ marginTop: 6, fontFamily: SANS, fontSize: 20, color: C.text3, opacity: tw(f, 260, 270, 0, 1, E.soft) }}>1948 – 2023</p>
            <p style={{ marginTop: 10, fontFamily: SANS, fontSize: 19, color: C.text2, opacity: tw(f, 264, 274, 0, 1, E.soft) }}>「她总是先问我们，吃饭了没。」</p>
            <div
              style={{
                margin: "22px auto 0",
                width: 300,
                height: 58,
                borderRadius: 999,
                background: `linear-gradient(145deg,${C.amberSoft},${C.amber})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                fontSize: 23,
                fontFamily: SANS,
                color: "#1c1917",
                fontWeight: 700,
                letterSpacing: "0.18em",
                transform: `scale(${genPress})`,
                boxShadow: petal ? "0 0 44px rgba(251,191,36,0.4)" : "0 0 22px rgba(217,119,6,0.25)",
              }}
            >
              {petal ? (
                // 花瓣生成动效（非通用圆环）
                <>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 12,
                        height: 18,
                        borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                        background: "#451a03",
                        opacity: 0.4 + 0.6 * wave(f, 14, i * 5),
                        transform: `scaleY(${0.7 + 0.3 * wave(f, 14, i * 5)})`,
                      }}
                    />
                  ))}
                  <span>生成中</span>
                </>
              ) : (
                "生成纪念馆"
              )}
            </div>
          </div>
        )}
      </div>

      {/* 大运动②：确认卡头像 + 姓名向前放大，移交馆主页（F296–F356） */}
      {burst > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - tw(f, 344, 362, 0, 1, E.press) }}>
          <div
            style={{
              position: "absolute",
              left: 640,
              top: 262,
              transform: `translate(-50%,-50%) translateY(${tw(f, 296, 340, 0, 60, E.grand)}px) scale(${1 + burst * 1.1})`,
              width: 104,
              height: 104,
              borderRadius: "50%",
              background: "linear-gradient(145deg,#78716c,#44403c)",
              border: "3px solid rgba(251,191,36,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              boxShadow: `0 0 ${40 + burst * 90}px rgba(251,191,36,${0.35 + burst * 0.35})`,
            }}
          >
            🕊️
          </div>
          <p
            style={{
              position: "absolute",
              left: 640,
              top: 336,
              transform: `translateX(-50%) translateY(${tw(f, 300, 342, 0, 66, E.grand)}px) scale(${1 + burst * 0.55})`,
              fontFamily: SERIF,
              fontSize: 34,
              letterSpacing: "0.14em",
              color: C.text,
              whiteSpace: "nowrap",
              textShadow: "0 2px 30px rgba(0,0,0,0.6)",
              opacity: 1 - tw(f, 336, 356, 0, 1, E.press),
            }}
          >
            王秀兰
          </p>
          {/* 光晕 */}
          <div
            style={{
              position: "absolute",
              left: 640,
              top: 300,
              width: 500,
              height: 500,
              transform: "translate(-50%,-50%)",
              background: `radial-gradient(circle, rgba(255,180,90,${burst * 0.32}), transparent 65%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}
