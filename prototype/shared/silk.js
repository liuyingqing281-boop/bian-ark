/* 彼岸原型 · 折叠光绸背景（src/components/concept/ConceptStage.tsx 的 vanilla 移植）
 * 用途：屏01 登录注册屏背景。规格：docs/前端具体设计流程.md §2.0「视觉规范」——
 * 默认「烛夜」色板、四色板逐帧插值切换、鼠标视差缓动、无 WebGL 时保留 CSS 静态渐变降级、
 * prefers-reduced-motion 时光流近乎静止、DPR 上限 2、单全屏三角形 + rAF。
 * 生命周期：宿主 DOM 被摘除（isConnected=false）时自动停止 rAF 并移除监听。
 */
(function () {
  // 每组：底色 + 两层流动光 + 微光点缀，均为 rgb(0-1)，与 ConceptStage.PALETTES 一致
  const PALETTES = [
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

  const lerp3 = (x, y, k) => [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
  const clone = (p) => ({ name: p.name, base: [...p.base], a: [...p.a], b: [...p.b], c: [...p.c] });

  /**
   * 在 host 元素内挂载光绸背景。
   * @param {HTMLElement} host 定位容器（需 position:relative/absolute，自带静态渐变降级层）
   * @returns {{ switchPalette: () => void }} 无 WebGL 时 switchPalette 为空操作
   */
  function mount(host) {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) {
      canvas.remove(); // 无 WebGL：保留 host 内的 CSS 静态渐变降级层
      return { switchPalette: () => {} };
    }

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
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
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize);
    resize();

    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove);

    let paletteIdx = 0;
    let cur = clone(PALETTES[0]);
    let from = null, to = null, mixT = 1;
    function switchPalette() {
      paletteIdx = (paletteIdx + 1) % PALETTES.length;
      from = clone(cur);
      to = PALETTES[paletteIdx];
      mixT = 0;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const SPEED = reduced ? 0.15 : 1;

    let raf = 0;
    function frame(now) {
      // 宿主被摘除（离开屏01）→ 自动停止并清理
      if (!canvas.isConnected) {
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onMove);
        return;
      }
      const t = ((now - start) / 1000) * SPEED;
      if (mixT < 1 && from && to) {
        mixT = Math.min(1, mixT + 0.02);
        const k = mixT * mixT * (3 - 2 * mixT);
        cur = { name: to.name, base: lerp3(from.base, to.base, k), a: lerp3(from.a, to.a, k), b: lerp3(from.b, to.b, k), c: lerp3(from.c, to.c, k) };
      }
      mx += (tx - mx) * 0.04;
      my += (ty - my) * 0.04;
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, t);
      gl.uniform2f(U.mouse, mx, my);
      gl.uniform3fv(U.base, cur.base);
      gl.uniform3fv(U.a, cur.a);
      gl.uniform3fv(U.b, cur.b);
      gl.uniform3fv(U.c, cur.c);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return { switchPalette };
  }

  window.BianSilk = { mount, PALETTES };
})();
