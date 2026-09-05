"use client";

/**
 * 彼岸 · 产品 Showreel 10s 星海版播放器（原生 300 帧 @ 30fps，非旧片倍速）
 * 故事：星海 → 点星进馆 → 长明灯阵聚焦外婆 → 按住说话 + TA 的声音回答 →
 * 为全家点灯 → 馆升回星海成星座 → 思念有处安放
 * 导演方案：docs/05-Showreel导演方案.md §7
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FPS, STAGE_W, STAGE_H, tw, E } from "./engine";
import { Cursor } from "./shared";
import Scene10StarSea from "./Scene10StarSea";
import Scene10Hall from "./Scene10Hall";
import Scene10Drawer from "./Scene10Drawer";

const TOTAL10 = 300;

/* ── 全局光标路径（帧, x, y）：点星 → 点灯 → 按住麦克风 → 点「为全家点灯」── */
const CURSOR_PATH: [number, number, number][] = [
  [18, 1150, 640],
  [40, 700, 302],
  [48, 700, 302],
  [54, 700, 302],
  [56, 700, 302],
  [100, 1120, 640],
  [114, 700, 364],
  [116, 700, 364],
  [122, 700, 364],
  [160, 1234, 592],
  [172, 1234, 592],
  [196, 1234, 592],
  [224, 1234, 592],
  [238, 992, 654],
  [240, 992, 654],
  [246, 992, 654],
  [266, 992, 654],
];

/* 按压帧段（麦克风为按住说话，F172–F196 持续按住） */
const PRESSES: [number, number][] = [
  [48, 54],
  [116, 122],
  [172, 196],
  [240, 246],
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
    tw(f, 18, 24, 0, 1, E.soft) *
    (1 - tw(f, 56, 66, 0, 1, E.press)) *
    (f >= 66 ? tw(f, 100, 108, 0, 1, E.soft) : 1) *
    (f >= 108 ? 1 - tw(f, 266, 276, 0, 1, E.press) : 1)
  );
}

export default function Showreel10Player() {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scale, setScale] = useState(1);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const accRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const fit = () => {
      const s = Math.min((window.innerWidth - 24) / STAGE_W, (window.innerHeight - 130) / STAGE_H);
      setScale(Math.max(0.3, s));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

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
        frameRef.current = (frameRef.current + step) % TOTAL10;
        setFrame(frameRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const seek = useCallback((v: number) => {
    frameRef.current = Math.max(0, Math.min(TOTAL10 - 1, Math.round(v)));
    setFrame(frameRef.current);
  }, []);

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

  const cur = cursorPos(frame);
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
        <Scene10StarSea f={frame} />
        <Scene10Hall f={frame} />
        <Scene10Drawer f={frame} />
        <Cursor x={cur.x} y={cur.y} press={cursorPress(frame)} opacity={cursorOpacity(frame)} />
      </div>

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
          max={TOTAL10 - 1}
          value={frame}
          onChange={(e) => {
            setPlaying(false);
            seek(Number(e.target.value));
          }}
          style={{ flex: 1, accentColor: "#d97706", cursor: "pointer" }}
          aria-label="帧进度"
        />
        <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          F{String(frame).padStart(3, "0")} / {TOTAL10} · {seconds}s · 10s 星海版
        </span>
        <span style={{ color: "#57534e", whiteSpace: "nowrap" }}>空格 播放/暂停 · ←→ 逐帧</span>
      </div>
    </div>
  );
}
