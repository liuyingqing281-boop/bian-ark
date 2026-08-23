/**
 * Showreel 帧驱动引擎
 * 30fps · 900 帧 · 所有动画为帧的纯函数（可拖帧审计、可录屏）
 */

export const FPS = 30;
export const TOTAL = 900;
export const STAGE_W = 1280;
export const STAGE_H = 720;

import type { CSSProperties } from "react";

/** 非对称缓动曲线组（禁止全局统一曲线，按运动类型分配） */
export type Bez = readonly [number, number, number, number];
export const E = {
  /** 快出缓停：UI 落位、卡片浮现 */
  snap: [0.16, 1, 0.3, 1] as Bez,
  /** 轻微过冲：选中、弹跳、计数 */
  pop: [0.34, 1.45, 0.44, 1] as Bez,
  /** 加速进入：按压、退出画面 */
  press: [0.5, 0, 0.75, 0] as Bez,
  /** 慢速漂移：相机推拉、长位移 */
  smooth: [0.37, 0, 0.2, 1] as Bez,
  /** 柔和浮现：文字、标签 */
  soft: [0.25, 0.8, 0.3, 1] as Bez,
  /** 大运动：场景级推拉升降 */
  grand: [0.55, 0.02, 0.18, 1] as Bez,
} as const;

function cubicBezier([x1, y1, x2, y2]: Bez, t: number): number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let x = t;
  for (let i = 0; i < 6; i++) {
    const err = ((ax * x + bx) * x + cx) * x - t;
    if (Math.abs(err) < 1e-5) break;
    const d = (3 * ax * x + 2 * bx) * x + cx;
    if (Math.abs(d) < 1e-6) break;
    x -= err / d;
  }
  x = Math.min(1, Math.max(0, x));
  return ((ay * x + by) * x + cy) * x;
}

/** 帧区间插值：f0→f1 之间从 from 到 to，区间外钳制 */
export function tw(f: number, f0: number, f1: number, from: number, to: number, bez: Bez = E.snap): number {
  if (f <= f0) return from;
  if (f >= f1) return to;
  return from + (to - from) * cubicBezier(bez, (f - f0) / (f1 - f0));
}

/** 打字机：f0 起每 framesPerChar 帧一个字 */
export function typer(f: number, f0: number, text: string, framesPerChar = 4): string {
  const n = Math.max(0, Math.min(text.length, Math.floor((f - f0) / framesPerChar)));
  return text.slice(0, n);
}

/** 帧区间判断 */
export const on = (f: number, f0: number, f1: number) => f >= f0 && f < f1;

/** 确定性闪烁/呼吸（以帧为参数的正弦，非 CSS 周期动画） */
export const wave = (f: number, period: number, phase = 0) =>
  0.5 + 0.5 * Math.sin(((f + phase) / period) * Math.PI * 2);

/** 数字滚动：f0→f1 从 a 到 b 取整 */
export const counter = (f: number, f0: number, f1: number, a: number, b: number, bez: Bez = E.snap) =>
  Math.round(tw(f, f0, f1, a, b, bez));

/** 常用样式工具 */
export const abs = (x: number, y: number, w?: number, h?: number): CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  ...(w !== undefined ? { width: w } : {}),
  ...(h !== undefined ? { height: h } : {}),
});

export const tx = (
  x: number,
  y: number,
  scale = 1,
  extra = ""
): string => `translate(${x}px, ${y}px) scale(${scale}) ${extra}`;
