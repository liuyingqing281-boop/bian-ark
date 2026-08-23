"use client";

import { useEffect, useRef } from "react";

/**
 * 彼岸 · 概念视觉舞台（共用组件）
 * 源自概念稿 docs/web/concept/index.html：WebGL 折叠光绸着色器 + 色板切换 + 鼠标视差。
 * 无 WebGL 时降级为静态 CSS 渐变；prefers-reduced-motion 时光流近乎静止。
 * 使用方：/[lang] 概念首页（ConceptHome）、/[lang]/login 登录首页。
 */

export type Vec3 = [number, number, number];
export type Palette = { name: string; base: Vec3; a: Vec3; b: Vec3; c: Vec3 };

// 每组：底色 + 两层流动光 + 微光点缀，均为 rgb(0-1)
export const PALETTES: Palette[] = [
  { name: "烛夜", base: [0.063, 0.078, 0.110], a: [0.847, 0.663, 0.361], b: [0.698, 0.235, 0.188], c: [0.980, 0.878, 0.722] },
  { name: "黄昏", base: [0.118, 0.078, 0.078], a: [0.937, 0.541, 0.290], b: [0.706, 0.322, 0.478], c: [1.000, 0.839, 0.639] },
  { name: "晨雾", base: [0.086, 0.110, 0.125], a: [0.573, 0.729, 0.780], b: [0.808, 0.878, 0.843], c: [0.925, 0.937, 0.890] },
  { name: "星夜", base: [0.047, 0.055, 0.098], a: [0.400, 0.510, 0.830], b: [0.660, 0.480, 0.780], c: [0.880, 0.910, 1.000] },
];

const VERT = `
  attribute vec2 p;
  void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// 片元着色器：fbm 域扭曲 + 正弦折叠，模拟"柔光折叠层"
const FRAG = `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec3 uBase, uA, uB, uC;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(13.7, 7.1);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
    uv += uMouse * 0.08;
    float t = uTime * 0.03;
    vec2 q = vec2(fbm(uv * 1.4 + t), fbm(uv * 1.4 - t * 0.7 + 4.7));
    vec2 r = vec2(fbm(uv * 1.8 + 2.2 * q + vec2(1.7, 9.2) + t * 0.5),
                  fbm(uv * 1.8 + 2.2 * q + vec2(8.3, 2.8) - t * 0.4));
    float f = fbm(uv * 1.6 + 2.5 * r);
    float fold = sin((uv.x * 1.8 + f * 3.2 + t) * 3.14159) * 0.5 + 0.5;
    float fold2 = sin((uv.y * 1.2 - f * 2.4 - t * 0.6) * 2.4) * 0.5 + 0.5;
    vec3 col = uBase;
    col = mix(col, uA, smoothstep(0.25, 0.85, f * fold * 1.15) * 0.62);
    col = mix(col, uB, smoothstep(0.35, 0.95, fold2 * (1.0 - f) * 1.2) * 0.45);
    col += uC * pow(max(fold * f - 0.55, 0.0), 2.2) * 0.5;
    float vig = 1.0 - 0.45 * dot(uv, uv);
    col *= vig;
    float grain = (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.035;
    col += grain;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const lerp3 = (x: Vec3, y: Vec3, k: number): Vec3 => [
  x[0] + (y[0] - x[0]) * k,
  x[1] + (y[1] - x[1]) * k,
  x[2] + (y[2] - x[2]) * k,
];

export default function ConceptStage({
  lang,
  children,
  showPalette = true,
  cornerNote,
  height = "calc(100vh - 4rem)",
}: {
  lang: string;
  /** 覆盖在光绸之上的内容（居中 flex 容器内） */
  children?: React.ReactNode;
  /** 是否显示右下角「换个意境」色板按钮 */
  showPalette?: boolean;
  /** 左上角小字；不传则不渲染 */
  cornerNote?: string;
  /** 舞台高度，默认扣除顶部导航 4rem；登录页等全屏场景传 "100vh" 类值 */
  height?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef(0);
  const switchRef = useRef<() => void>(() => {});
  const zh = lang !== "en";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      canvas.remove(); // 无 WebGL：保留 CSS 静态渐变降级
      return;
    }

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        console.error(gl!.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT)!);
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG)!);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const locP = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);

    const U = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      mouse: gl.getUniformLocation(prog, "uMouse"),
      base: gl.getUniformLocation(prog, "uBase"),
      a: gl.getUniformLocation(prog, "uA"),
      b: gl.getUniformLocation(prog, "uB"),
      c: gl.getUniformLocation(prog, "uC"),
    };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(canvas!.clientWidth * dpr);
      canvas!.height = Math.round(canvas!.clientHeight * dpr);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }
    window.addEventListener("resize", resize);
    resize();

    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove);

    let cur: Palette = { ...PALETTES[0], base: [...PALETTES[0].base] as Vec3, a: [...PALETTES[0].a] as Vec3, b: [...PALETTES[0].b] as Vec3, c: [...PALETTES[0].c] as Vec3 };
    let from: Palette | null = null, to: Palette | null = null, mixT = 1;
    switchRef.current = () => {
      const next = PALETTES[(paletteRef.current + 1) % PALETTES.length];
      paletteRef.current = (paletteRef.current + 1) % PALETTES.length;
      from = { ...cur, base: [...cur.base] as Vec3, a: [...cur.a] as Vec3, b: [...cur.b] as Vec3, c: [...cur.c] as Vec3 };
      to = next;
      mixT = 0;
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const SPEED = reduced ? 0.15 : 1;

    let raf = 0;
    function frame(now: number) {
      const t = ((now - start) / 1000) * SPEED;
      if (mixT < 1 && from && to) {
        mixT = Math.min(1, mixT + 0.02);
        const k = mixT * mixT * (3 - 2 * mixT);
        cur = { ...cur, base: lerp3(from.base, to.base, k), a: lerp3(from.a, to.a, k), b: lerp3(from.b, to.b, k), c: lerp3(from.c, to.c, k) };
      }
      mx += (tx - mx) * 0.04;
      my += (ty - my) * 0.04;
      gl!.uniform2f(U.res, canvas!.width, canvas!.height);
      gl!.uniform1f(U.time, t);
      gl!.uniform2f(U.mouse, mx, my);
      gl!.uniform3fv(U.base, cur.base);
      gl!.uniform3fv(U.a, cur.a);
      gl!.uniform3fv(U.b, cur.b);
      gl!.uniform3fv(U.c, cur.c);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="cstage" style={{ height }}>
      <style>{`
        .cstage {
          position: relative;
          min-height: 480px;
          overflow: hidden;
          background: #10141c;
          color: #e8e2d6;
          font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .cstage-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(120% 90% at 30% 20%, rgba(216, 169, 92, 0.28), transparent 55%),
            radial-gradient(100% 80% at 75% 80%, rgba(178, 60, 48, 0.20), transparent 60%),
            radial-gradient(140% 120% at 50% 50%, #1a2233 0%, #10141c 70%);
        }
        .cstage-bg canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        .cstage-content {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 28px;
          text-align: center;
          padding: 0 24px;
          overflow-y: auto;
        }
        .cstage-corner {
          position: absolute;
          font-size: 12px;
          letter-spacing: 0.15em;
          color: rgba(232, 226, 214, 0.38);
          user-select: none;
          z-index: 2;
        }
        .cstage-corner.tl { top: 24px; left: 28px; }
        .cstage-corner.br { bottom: 24px; right: 28px; }
        .cstage-palette-btn {
          font: inherit;
          color: inherit;
          background: none;
          border: 1px solid rgba(232, 226, 214, 0.22);
          border-radius: 999px;
          padding: 7px 18px;
          cursor: pointer;
          transition: border-color 0.3s ease, color 0.3s ease;
        }
        .cstage-palette-btn:hover { border-color: rgba(216, 169, 92, 0.6); color: #d8a95c; }
      `}</style>

      <div className="cstage-bg">
        <canvas ref={canvasRef} />
      </div>

      {children && <div className="cstage-content">{children}</div>}

      {cornerNote && <div className="cstage-corner tl">{cornerNote}</div>}
      {showPalette && (
        <div className="cstage-corner br">
          <button className="cstage-palette-btn" type="button" onClick={() => switchRef.current()}>
            {zh ? "换个意境" : "Shift mood"}
          </button>
        </div>
      )}
    </div>
  );
}
