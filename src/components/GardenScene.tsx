"use client";
import Image from "next/image";

import Link from "next/link";
import { useRef, useState } from "react";

export interface GardenRow {
  id: string;
  name: string;
  type: string;
  avatar_url: string;
  birth_date: string;
  death_date: string;
  is_new: number;
}

export interface GardenSectionData {
  key: string;
  label: string;
  rows: GardenRow[];
}

const FIREFLIES = [
  { left: "12%", top: "38%", delay: "0s", dur: "7s" },
  { left: "24%", top: "55%", delay: "1.2s", dur: "9s" },
  { left: "40%", top: "42%", delay: "2.1s", dur: "8s" },
  { left: "58%", top: "60%", delay: "0.6s", dur: "10s" },
  { left: "72%", top: "45%", delay: "1.8s", dur: "7.5s" },
  { left: "86%", top: "58%", delay: "2.8s", dur: "8.6s" },
  { left: "33%", top: "68%", delay: "3.4s", dur: "9.4s" },
  { left: "65%", top: "35%", delay: "4.1s", dur: "7.8s" },
];

const STARS = [
  { left: "8%", top: "6%", size: 2, delay: "0s" },
  { left: "18%", top: "14%", size: 1, delay: "0.8s" },
  { left: "30%", top: "4%", size: 2, delay: "1.6s" },
  { left: "45%", top: "10%", size: 1, delay: "0.4s" },
  { left: "55%", top: "18%", size: 2, delay: "2.2s" },
  { left: "63%", top: "7%", size: 1, delay: "1.1s" },
  { left: "74%", top: "15%", size: 2, delay: "2.7s" },
  { left: "84%", top: "5%", size: 1, delay: "0.2s" },
  { left: "92%", top: "12%", size: 2, delay: "1.9s" },
  { left: "26%", top: "20%", size: 1, delay: "3.1s" },
  { left: "68%", top: "22%", size: 1, delay: "2.4s" },
  { left: "12%", top: "24%", size: 2, delay: "3.6s" },
];

function Tombstone({ memorial, lang, isNew }: { memorial: GardenRow; lang: string; isNew: boolean }) {
  const avatarIsImage = memorial.avatar_url?.startsWith("/uploads/");
  return (
    <Link href={`/${lang}/memorial/${memorial.id}`} className="group flex flex-col items-center relative">
      {isNew && (
        <span className="absolute -top-3 z-10 text-xs px-1.5 py-0.5 rounded bg-amber-800 text-amber-100 shadow">
          NEW
        </span>
      )}
      <div className="w-24 md:w-28 rounded-t-[3rem] bg-gradient-to-b from-stone-400 via-stone-500 to-stone-600 px-2 pt-5 pb-3 text-center shadow-lg shadow-black/60 group-hover:from-stone-300 group-hover:via-stone-400 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-amber-100/10">
        <div className="w-10 h-10 mx-auto rounded-full bg-stone-700/60 border border-stone-500/50 flex items-center justify-center text-lg overflow-hidden mb-1.5">
          {avatarIsImage ? (
            <Image src={memorial.avatar_url} alt={memorial.name} className="object-cover"  fill />
          ) : (
            memorial.avatar_url || (memorial.type === "pet" ? "🐾" : "🕊️")
          )}
        </div>
        <p className="text-stone-900 text-sm font-semibold truncate leading-tight">{memorial.name}</p>
        <p className="text-stone-700 text-xs mt-0.5">
          {memorial.birth_date || "?"} ~ {memorial.death_date || "?"}
        </p>
      </div>
      <div className="w-28 md:w-32 h-2.5 bg-stone-700 rounded-b-md shadow-md shadow-black/50" />
    </Link>
  );
}

export default function GardenScene({
  sections,
  newTodayText,
  lang,
}: {
  sections: GardenSectionData[];
  newTodayText: string;
  lang: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  function onMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setTilt({
      x: (e.clientX - rect.left) / rect.width - 0.5,
      y: (e.clientY - rect.top) / rect.height - 0.5,
    });
  }

  const layer = (depth: number) => ({
    transform: `translate3d(${tilt.x * depth}px, ${tilt.y * depth * 0.6}px, 0)`,
    transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.3, 1)",
  });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative rounded-2xl overflow-hidden border border-stone-800"
      style={{
        background:
          "linear-gradient(to bottom, #0b1126 0%, #141c38 24%, #27304f 33%, #2c3524 34%, #1c2415 60%, #141a0f 100%)",
      }}
    >
      <style>{`
        @keyframes garden-twinkle { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
        @keyframes garden-firefly {
          0%, 100% { transform: translate(0, 0); opacity: 0.15; }
          25% { transform: translate(10px, -14px); opacity: 0.9; }
          50% { transform: translate(-6px, -24px); opacity: 0.4; }
          75% { transform: translate(-14px, -8px); opacity: 0.8; }
        }
        @keyframes garden-mist { 0% { transform: translateX(-8%); } 100% { transform: translateX(8%); } }
      `}</style>

      {/* sky layer: stars + moon (deepest parallax) */}
      <div className="absolute inset-0 pointer-events-none" style={layer(-14)}>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animation: `garden-twinkle 3.2s ease-in-out ${s.delay} infinite`,
            }}
          />
        ))}
        <div className="absolute top-8 right-10 w-14 h-14 rounded-full bg-amber-100/90 shadow-[0_0_60px_20px_rgba(254,243,199,0.25)]" />
      </div>

      {/* distant ridge (mid parallax) */}
      <div className="absolute left-0 right-0 top-[26%] h-24 pointer-events-none" style={layer(-7)}>
        <svg viewBox="0 0 1200 100" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,70 L140,30 L260,62 L400,18 L560,66 L700,34 L860,72 L1000,26 L1120,58 L1200,40 L1200,100 L0,100 Z" fill="#1a2140" opacity="0.85" />
          <path d="M0,84 L180,52 L340,80 L520,44 L720,82 L900,50 L1080,78 L1200,60 L1200,100 L0,100 Z" fill="#141a30" opacity="0.9" />
        </svg>
      </div>

      {/* drifting mist above the tree line */}
      <div
        className="absolute left-[-10%] right-[-10%] top-[30%] h-16 pointer-events-none"
        style={{
          background: "linear-gradient(to right, transparent, rgba(180,190,220,0.07) 30%, rgba(180,190,220,0.11) 55%, rgba(180,190,220,0.07) 75%, transparent)",
          animation: "garden-mist 26s ease-in-out infinite alternate",
        }}
      />

      {/* fireflies (near layer) */}
      <div className="absolute inset-0 pointer-events-none" style={layer(10)}>
        {FIREFLIES.map((f, i) => (
          <span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-amber-200"
            style={{
              left: f.left,
              top: f.top,
              boxShadow: "0 0 8px 2px rgba(253,230,138,0.5)",
              animation: `garden-firefly ${f.dur} ease-in-out ${f.delay} infinite`,
            }}
          />
        ))}
      </div>

      <div className="h-36" />
      {newTodayText && (
        <p className="relative z-10 text-center text-xs text-amber-200/70 tracking-widest mb-2">{newTodayText}</p>
      )}

      {/* ground rows with a subtle 2.5D perspective tilt */}
      <div style={{ perspective: "1000px" }}>
        {sections.map((section, sIdx) => (
          <div key={section.key} className="relative z-10 px-6 md:px-12 pb-10">
            <p className="text-center text-xs tracking-[0.3em] text-stone-400/60 mb-6 mt-4">
              — {section.label} —
            </p>
            <div
              className="flex flex-wrap justify-center gap-x-4 gap-y-8"
              style={{
                transform: `perspective(1000px) rotateX(${6 + sIdx * 2}deg)`,
                transformOrigin: "center bottom",
              }}
            >
              {section.rows.map((memorial) => (
                <Tombstone key={memorial.id} memorial={memorial} lang={lang} isNew={memorial.is_new === 1} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="h-8 bg-gradient-to-b from-transparent to-black/30" />
    </div>
  );
}