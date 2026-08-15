"use client";

import { useEffect, useMemo, useState } from "react";

export type ThemeId =
  | "auto"
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "dawn"
  | "midday"
  | "dusk"
  | "night"
  | "indoor";

export type SceneId = Exclude<ThemeId, "auto">;

export interface ThemeLabels {
  pickerLabel: string;
  auto: string;
  spring: string;
  summer: string;
  autumn: string;
  winter: string;
  dawn: string;
  midday: string;
  dusk: string;
  night: string;
  indoor: string;
}

const STORAGE_KEY = "bian-bg-theme";

const THEME_ORDER: ThemeId[] = [
  "auto",
  "spring",
  "summer",
  "autumn",
  "winter",
  "dawn",
  "midday",
  "dusk",
  "night",
  "indoor",
];

const THEME_ICONS: Record<ThemeId, string> = {
  auto: "🌗",
  spring: "🌸",
  summer: "🌿",
  autumn: "🍂",
  winter: "❄️",
  dawn: "🌅",
  midday: "☀️",
  dusk: "🌇",
  night: "🌌",
  indoor: "🏠",
};

/** 自动模式：清晨看朝霞，白天随季节，黄昏看晚霞，夜里看星空 */
function resolveAuto(now: Date): SceneId {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 17 && h < 19.5) return "dusk";
  if (h >= 19.5 || h < 5) return "night";
  const month = now.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/** 确定性伪随机，保证每次渲染粒子分布一致 */
function rng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Particle {
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  extra?: number;
}

function makeParticles(seed: number, count: number): Particle[] {
  const rand = rng(seed);
  return Array.from({ length: count }, () => ({
    left: rand() * 100,
    top: rand() * 100,
    size: 1 + rand() * 3,
    delay: -rand() * 40,
    duration: 14 + rand() * 22,
    opacity: 0.3 + rand() * 0.7,
    extra: rand(),
  }));
}

function Stars({ seed = 7, count = 70 }: { seed?: number; count?: number }) {
  const stars = useMemo(() => makeParticles(seed, count), [seed, count]);
  return (
    <>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.left}%`,
            top: `${s.top * 0.75}%`,
            width: s.size > 2.6 ? 3 : s.size > 1.6 ? 2 : 1,
            height: s.size > 2.6 ? 3 : s.size > 1.6 ? 2 : 1,
            opacity: s.opacity,
            animation: `star-twinkle ${2.5 + s.extra! * 4}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Moon({ className, size = 90 }: { className?: string; size?: number }) {
  return (
    <div
      className={`absolute rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 38% 35%, #fefce8 0%, #fde68a 45%, #d6d3d1 100%)",
        boxShadow: "0 0 60px 22px rgba(253, 230, 138, 0.28)",
      }}
    />
  );
}

function Sun({ className, size = 110, glow = "rgba(251, 191, 36, 0.45)" }: { className?: string; size?: number; glow?: string }) {
  return (
    <div
      className={`absolute rounded-full ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 42% 40%, #fffbeb 0%, #fde047 55%, #f59e0b 100%)",
        boxShadow: `0 0 90px 40px ${glow}`,
        animation: "glow-pulse 7s ease-in-out infinite",
      }}
    />
  );
}

function Clouds({ tint = "rgba(255,255,255,0.5)", seed = 3, count = 4 }: { tint?: string; seed?: number; count?: number }) {
  const clouds = useMemo(() => makeParticles(seed, count), [seed, count]);
  return (
    <>
      {clouds.map((c, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-2xl"
          style={{
            top: `${8 + c.top * 0.35}%`,
            left: 0,
            width: 180 + c.extra! * 220,
            height: 40 + c.extra! * 36,
            background: tint,
            opacity: 0.5 + c.opacity * 0.3,
            animation: `cloud-drift ${70 + c.extra! * 80}s linear ${c.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Falling({
  seed,
  count,
  color,
  shape = "round",
}: {
  seed: number;
  count: number;
  color: string;
  shape?: "round" | "petal" | "leaf";
}) {
  const parts = useMemo(() => makeParticles(seed, count), [seed, count]);
  const radius =
    shape === "round" ? "50%" : shape === "petal" ? "60% 40% 60% 40%" : "50% 0 50% 50%";
  return (
    <>
      {parts.map((p, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${p.left}%`,
            top: "-4vh",
            width: shape === "round" ? p.size + 1 : p.size * 2 + 4,
            height: shape === "round" ? p.size + 1 : p.size * 2 + 6,
            background: color,
            borderRadius: radius,
            opacity: 0.4 + p.opacity * 0.5,
            animation: `particle-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Hills({ fill = "#020617", opacity = 0.8 }: { fill?: string; opacity?: number }) {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full"
      style={{ height: "26vh", opacity }}
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
    >
      <path
        d="M0 120 Q 150 40 320 110 T 640 90 T 1000 130 L1000 200 L0 200 Z"
        fill={fill}
      />
      <path
        d="M0 160 Q 220 100 420 150 T 780 140 T 1000 170 L1000 200 L0 200 Z"
        fill={fill}
        opacity={0.7}
      />
    </svg>
  );
}

/** 各场景定义：天空渐变 + 元素 + 遮罩深浅 */
const SCENES: Record<SceneId, { sky: string; veil: string; render: () => React.ReactNode }> = {
  spring: {
    sky: "linear-gradient(180deg, #022c22 0%, #064e3b 45%, #166534 80%, #3f6212 100%)",
    veil: "bg-stone-950/25",
    render: () => (
      <>
        <Clouds tint="rgba(209, 250, 229, 0.28)" seed={11} count={3} />
        <Falling seed={21} count={26} color="#f9a8d4" shape="petal" />
        <Hills fill="#022c22" opacity={0.55} />
      </>
    ),
  },
  summer: {
    sky: "linear-gradient(180deg, #082f49 0%, #0c4a6e 40%, #155e75 75%, #115e59 100%)",
    veil: "bg-stone-950/25",
    render: () => (
      <>
        <Sun className="right-[12%] top-[10%]" size={86} glow="rgba(125, 211, 252, 0.3)" />
        <Clouds tint="rgba(224, 242, 254, 0.4)" seed={31} count={5} />
        <Hills fill="#052e2b" opacity={0.6} />
      </>
    ),
  },
  autumn: {
    sky: "linear-gradient(180deg, #1c0a00 0%, #431407 40%, #7c2d12 70%, #92400e 100%)",
    veil: "bg-stone-950/25",
    render: () => (
      <>
        <Clouds tint="rgba(253, 186, 116, 0.22)" seed={41} count={3} />
        <Falling seed={51} count={22} color="#f59e0b" shape="leaf" />
        <Falling seed={52} count={14} color="#b45309" shape="leaf" />
        <Hills fill="#1c0a00" opacity={0.6} />
      </>
    ),
  },
  winter: {
    sky: "linear-gradient(180deg, #0f172a 0%, #1e293b 45%, #334155 80%, #475569 100%)",
    veil: "bg-stone-950/25",
    render: () => (
      <>
        <Moon className="left-[14%] top-[10%]" size={64} />
        <Stars seed={61} count={36} />
        <Falling seed={71} count={46} color="#f8fafc" shape="round" />
        <Hills fill="#cbd5e1" opacity={0.14} />
      </>
    ),
  },
  dawn: {
    sky: "linear-gradient(180deg, #1e1b4b 0%, #4c1d95 30%, #9d174d 55%, #f97316 80%, #fbbf24 100%)",
    veil: "bg-stone-950/20",
    render: () => (
      <>
        <Stars seed={81} count={24} />
        <Sun className="left-1/2 -translate-x-1/2 bottom-[16%]" size={96} glow="rgba(251, 146, 60, 0.5)" />
        <Clouds tint="rgba(251, 113, 133, 0.3)" seed={91} count={4} />
        <Hills fill="#1e1b4b" opacity={0.7} />
      </>
    ),
  },
  midday: {
    sky: "linear-gradient(180deg, #0c4a6e 0%, #0369a1 40%, #0ea5e9 75%, #7dd3fc 100%)",
    veil: "bg-stone-950/30",
    render: () => (
      <>
        <Sun className="left-1/2 -translate-x-1/2 top-[8%]" size={120} glow="rgba(254, 240, 138, 0.55)" />
        <Clouds tint="rgba(255, 255, 255, 0.55)" seed={101} count={5} />
        <Hills fill="#075985" opacity={0.5} />
      </>
    ),
  },
  dusk: {
    sky: "linear-gradient(180deg, #180828 0%, #3b0764 30%, #831843 55%, #c2410c 80%, #fb923c 100%)",
    veil: "bg-stone-950/25",
    render: () => (
      <>
        <Sun className="left-[30%] bottom-[13%]" size={104} glow="rgba(249, 115, 22, 0.5)" />
        <Clouds tint="rgba(192, 132, 252, 0.28)" seed={111} count={4} />
        <Hills fill="#180828" opacity={0.75} />
      </>
    ),
  },
  night: {
    sky: "linear-gradient(180deg, #020617 0%, #0b1530 45%, #16224a 80%, #1e2a52 100%)",
    veil: "bg-stone-950/20",
    render: () => (
      <>
        <Stars seed={121} count={80} />
        <Moon className="right-[16%] top-[9%]" size={88} />
        <Clouds tint="rgba(148, 163, 184, 0.14)" seed={131} count={3} />
        <Hills fill="#020617" opacity={0.85} />
      </>
    ),
  },
  indoor: {
    sky: "linear-gradient(180deg, #0c0a09 0%, #1c1410 45%, #241a12 75%, #2b2016 100%)",
    veil: "bg-stone-950/15",
    render: () => (
      <>
        {/* 窗户：月光透进来 */}
        <div
          className="absolute right-[10%] top-[10%] rounded-lg border-2 border-stone-800/80 overflow-hidden"
          style={{
            width: 170,
            height: 220,
            background:
              "linear-gradient(180deg, #16224a 0%, #1e2a52 60%, #27355f 100%)",
            boxShadow: "0 0 70px 18px rgba(147, 197, 253, 0.16)",
          }}
        >
          <Stars seed={141} count={14} />
          <Moon className="right-[12%] top-[10%]" size={30} />
          <div className="absolute inset-y-0 left-1/2 w-[2px] bg-stone-800/80" />
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-stone-800/80" />
        </div>
        {/* 洒在地板上的月光 */}
        <div
          className="absolute right-[6%] top-[34%] blur-md"
          style={{
            width: 260,
            height: 340,
            background:
              "linear-gradient(200deg, rgba(147,197,253,0.14) 0%, rgba(147,197,253,0.05) 60%, transparent 100%)",
            transform: "skewX(-14deg)",
          }}
        />
        {/* 烛光 */}
        <div
          className="absolute left-[10%] bottom-[12%] rounded-full blur-xl"
          style={{
            width: 130,
            height: 130,
            background: "radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(180,83,9,0.25) 55%, transparent 75%)",
            animation: "candle-flicker 3.2s ease-in-out infinite",
          }}
        />
        <div
          className="absolute left-[10%] bottom-[12%] rounded-full"
          style={{
            width: 10,
            height: 18,
            margin: "46px 0 0 60px",
            background: "radial-gradient(ellipse at 50% 30%, #fef3c7 0%, #f59e0b 70%, #b45309 100%)",
            boxShadow: "0 0 26px 10px rgba(251, 191, 36, 0.5)",
            animation: "candle-flicker 2.4s ease-in-out infinite",
          }}
        />
        {/* 光尘 */}
        {makeParticles(151, 16).map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-100/60"
            style={{
              left: `${8 + p.left * 0.5}%`,
              top: `${20 + p.top * 0.6}%`,
              width: 2,
              height: 2,
              animation: `dust-float ${6 + p.extra! * 7}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}
      </>
    ),
  },
};

function Scene({ id }: { id: SceneId }) {
  const scene = SCENES[id];
  return (
    <div key={id} className="bg-scene-enter absolute inset-0" style={{ background: scene.sky }}>
      {scene.render()}
      {/* 阅读遮罩，保证文字清晰 */}
      <div className={`absolute inset-0 ${scene.veil}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/15 via-transparent to-stone-950/30" />
    </div>
  );
}

export default function ThemeBackground({ labels }: { labels: ThemeLabels }) {
  const [theme, setTheme] = useState<ThemeId>("auto");
  const [sceneId, setSceneId] = useState<SceneId>("night");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    if (saved && THEME_ORDER.includes(saved)) setTheme(saved);
    setMounted(true);
  }, []);

  useEffect(() => {
    const apply = () => setSceneId(theme === "auto" ? resolveAuto(new Date()) : theme);
    apply();
    if (theme === "auto") {
      const timer = window.setInterval(apply, 60_000);
      return () => window.clearInterval(timer);
    }
  }, [theme]);

  const pick = (id: ThemeId) => {
    setTheme(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    setOpen(false);
  };

  return (
    <>
      {/* 背景层： mounted 前保持默认深色，避免闪烁 */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        {mounted && <Scene id={sceneId} />}
      </div>

      {/* 主题选择器 */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {open && (
          <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-stone-700/70 bg-stone-900/90 p-2.5 shadow-2xl backdrop-blur">
            {THEME_ORDER.map((id) => (
              <button
                key={id}
                onClick={() => pick(id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition ${
                  theme === id
                    ? "bg-amber-800/80 text-amber-100"
                    : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
                }`}
              >
                <span>{THEME_ICONS[id]}</span>
                <span className="whitespace-nowrap">{labels[id]}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          title={labels.pickerLabel}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-700/70 bg-stone-900/85 text-lg shadow-xl backdrop-blur transition hover:border-amber-700/60 hover:text-amber-300"
        >
          {open ? "✕" : THEME_ICONS[theme]}
        </button>
      </div>
    </>
  );
}
