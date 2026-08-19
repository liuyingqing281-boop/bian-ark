"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import GardenScene from "./GardenScene";
import type { GardenSectionData } from "./GardenScene";

const Garden3D = dynamic(() => import("./Garden3D"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-stone-800 bg-stone-950 h-[480px] sm:h-[560px] flex items-center justify-center">
      <p className="text-stone-400 text-sm animate-pulse" aria-label="loading">…</p>
    </div>
  ),
});

export default function GardenViewSwitch({
  sections,
  newTodayText,
  lang,
  labels,
  avatarAltFormat,
}: {
  sections: GardenSectionData[];
  newTodayText: string;
  lang: string;
  labels: { view3d: string; view2d: string; hint3d: string };
  avatarAltFormat: string;
}) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMode(mode === "2d" ? "3d" : "2d")}
        className="absolute -top-14 right-0 z-20 px-4 py-2 bg-stone-700/80 hover:bg-stone-600 text-stone-200 rounded-lg transition text-sm"
      >
        {mode === "2d" ? labels.view3d : labels.view2d}
      </button>
      {mode === "2d" ? (
        <GardenScene sections={sections} newTodayText={newTodayText} lang={lang} avatarAltFormat={avatarAltFormat} />
      ) : (
        <Garden3D sections={sections} lang={lang} hint={labels.hint3d} />
      )}
    </div>
  );
}