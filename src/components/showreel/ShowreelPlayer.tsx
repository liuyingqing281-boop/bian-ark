"use client";

/**
 * 彼岸 · 产品 Showreel 播放器
 * 30s @ 30fps = 900 帧，帧驱动（纯函数），支持播放/暂停/拖帧审计
 * 导演方案：docs/05-Showreel导演方案.md
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FPS, TOTAL, STAGE_W, STAGE_H, tw, E } from "./engine";
import { Cursor } from "./shared";
import SceneGarden from "./SceneGarden";
import SceneWizard from "./SceneWizard";
import SceneMemorial from "./SceneMemorial";
import SceneChat from "./SceneChat";
import SceneOffer from "./SceneOffer";
import SceneFinale from "./SceneFinale";

/* ── 全局光标路径（帧, x, y）── */
const CURSOR_PATH: [number, number, number][] = [
  [36, 1150, 660],
  [52, 640, 612],
  [100, 640, 612],
  [118, 430, 300],
  [146, 500, 302],
  [150, 614, 445],
  [160, 614, 445],
  [172, 640, 588],
  [182, 640, 588],
  [202, 450, 340],
  [232, 560, 350],
  [240, 640, 578],
  [248, 640, 578],
  [264, 640, 529],
  [296, 640, 529],
  [404, 640, 529],
  [418, 640, 441],
  [430, 560, 366],
  [520, 700, 420],
  [540, 1176, 610],
  [548, 1176, 610],
  [648, 1000, 560],
  [660, 568, 534],
  [668, 568, 534],
  [684, 640, 668],
  [692, 640, 668],
  [712, 640, 668],
];

/* ── 10s 精剪：分段非线性时间重映射（out 帧 → 源 900 帧）
 * 不是全局倍速：按镜头段落分配节奏，保留各段内部的缓动与重叠 */
const CUT10: [number, number][] = [
  [0, 0],       // S0 墓园 + 建馆按钮
  [28, 96],     // 按钮变形移交向导
  [100, 296],   // S1 建馆向导 3 步
  [132, 360],   // 大运动② + 馆主页建立
  [168, 472],   // 写入记忆
  [208, 610],   // 缅怀对话 + 引用卡
  [240, 720],   // S3 点亮蜡烛联动
  [258, 790],   // 记录上墙 + 烛火特写
  [286, 870],   // 大运动③ 拉远
  [300, 899],   // 品牌收束
];

export function remapFrame(outF: number, outTotal: number): number {
  if (outTotal === TOTAL) return outF;
  // 先归一到 10s 剪辑的 300 帧空间，再按 CUT10 分段映射（支持任意精剪时长）
  const f = (outF * 300) / outTotal;
  if (f <= CUT10[0][0]) return CUT10[0][1];
  for (let i = 0; i < CUT10.length - 1; i++) {
    const [o0, s0] = CUT10[i];
    const [o1, s1] = CUT10[i + 1];
    if (f >= o0 && f <= o1) {
      return s0 + ((f - o0) / (o1 - o0)) * (s1 - s0);
    }
  }
  return CUT10[CUT10.length - 1][1];
}

/** 按压帧段 */
const PRESSES: [number, number][] = [
  [58, 64], [150, 154], [172, 178], [238, 244], [290, 296],
  [418, 424], [540, 546], [660, 666], [684, 690],
];

function cursorPos(f: number): { x: number; y: number } {
  if (f <= CURSOR_PATH[0][0]) return { x: CURSOR_PATH[0][1], y: CURSOR_PATH[0][2] };
  for (let i = 0; i < CURSOR_PATH.length - 1; i++) {
    const [f0, x0, y0] = CURSOR_PATH[i];
    const [f1, x1, y1] = CURSOR_PATH[i + 1];
    if (f >= f0 && f <= f1) {
      const t = tw(f, f0, f1, 0, 1, E.smooth);
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
    }
  }
  const last = CURSOR_PATH[CURSOR_PATH.length - 1];
  return { x: last[1], y: last[2] };
}

function cursorPress(f: number): number {
  for (const [a, b] of PRESSES) {
    if (f >= a - 2 && f <= b + 6) {
      if (f < a) return tw(f, a - 2, a, 0, 1, E.press);
      if (f <= b) return 1;
      return tw(f, b, b + 6, 1, 0, E.snap);
    }
  }
  return 0;
}

function cursorOpacity(f: number): number {
  return (
    tw(f, 36, 42, 0, 1, E.soft) *
    (1 - tw(f, 298, 316, 0, 1, E.press)) *
    (f >= 316 ? tw(f, 404, 414, 0, 1, E.soft) : 1) *
    (f >= 414 ? 1 - tw(f, 548, 562, 0, 1, E.press) : 1) *
    (f >= 562 ? tw(f, 648, 656, 0, 1, E.soft) : 1) *
    (f >= 656 ? 1 - tw(f, 696, 712, 0, 1, E.press) : 1)
  );
}

export default function ShowreelPlayer({ outTotal = TOTAL }: { outTotal?: number }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scale, setScale] = useState(1);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const accRef = useRef(0);
  const frameRef = useRef(0);

  /* 舞台缩放适配 */
  useEffect(() => {
    const fit = () => {
      const s = Math.min((window.innerWidth - 24) / STAGE_W, (window.innerHeight - 130) / STAGE_H);
      setScale(Math.max(0.3, s));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /* 30fps 播放循环 */
  useEffect(() => {
    if (!playing) return;
    lastTsRef.current = 0;
    accRef.current = 0;
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      accRef.current += (ts - lastTsRef.current) / (1000 / FPS);
      lastTsRef.current = ts;
      if (accRef.current >= 1) {
        const step = Math.floor(accRef.current);
        accRef.current -= step;
        frameRef.current = (frameRef.current + step) % outTotal;
        setFrame(frameRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, outTotal]);

  const seek = useCallback((v: number) => {
    frameRef.current = Math.max(0, Math.min(outTotal - 1, Math.round(v)));
    setFrame(frameRef.current);
  }, [outTotal]);

  /* 空格播放/暂停，左右箭头逐帧 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.code === "ArrowLeft") {
        setPlaying(false);
        seek(frameRef.current - 1);
      } else if (e.code === "ArrowRight") {
        setPlaying(false);
        seek(frameRef.current + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seek]);

  const f = remapFrame(frame, outTotal);
  const cur = cursorPos(f);
  const seconds = (frame / FPS).toFixed(2);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050403",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        fontFamily: '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif',
        padding: "12px 0 20px",
      }}
    >
      {/* 舞台 1280×720 */}
      <div
        data-stage
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          position: "relative",
          overflow: "hidden",
          borderRadius: 10,
          background: "#0c0a09",
          boxShadow: "0 30px 90px rgba(0,0,0,0.7), 0 0 0 1px rgba(120,113,108,0.25)",
          flex: "0 0 auto",
          marginTop: -((STAGE_H * (1 - scale)) / 2),
          marginBottom: -((STAGE_H * (1 - scale)) / 2),
        }}
      >
        <SceneGarden f={f} />
        <SceneWizard f={f} />
        <SceneMemorial f={f} />
        <SceneChat f={f} />
        <SceneOffer f={f} />
        <SceneFinale f={f} />
        <Cursor x={cur.x} y={cur.y} press={cursorPress(f)} opacity={cursorOpacity(f)} />
      </div>

      {/* 控制台 */}
      <div
        style={{
          width: STAGE_W * scale,
          display: "flex",
          alignItems: "center",
          gap: 14,
          color: "#a8a29e",
          fontSize: 13,
          flex: "0 0 auto",
        }}
      >
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid rgba(217,119,6,0.5)",
            background: "rgba(217,119,6,0.12)",
            color: "#fbbf24",
            fontSize: 15,
            cursor: "pointer",
            flex: "0 0 auto",
          }}
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={outTotal - 1}
          value={frame}
          onChange={(e) => {
            setPlaying(false);
            seek(Number(e.target.value));
          }}
          style={{ flex: 1, accentColor: "#d97706", cursor: "pointer" }}
          aria-label="帧进度"
        />
        <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          F{String(frame).padStart(3, "0")} / {outTotal} · {seconds}s{outTotal !== TOTAL ? ` · ${(outTotal / FPS).toFixed(1)}s 精剪（源 F${String(Math.round(f)).padStart(3, "0")}）` : ""}
        </span>
        <span style={{ color: "#57534e", whiteSpace: "nowrap" }}>空格 播放/暂停 · ←→ 逐帧</span>
      </div>
    </div>
  );
}
