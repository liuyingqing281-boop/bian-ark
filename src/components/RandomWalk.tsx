"use client";

export default function RandomWalk({ ids, label }: { ids: string[]; label: string }) {
  function walk() {
    if (ids.length === 0) return;
    const id = ids[Math.floor(Math.random() * ids.length)];
    const lang = window.location.pathname.split("/")[1] || "zh";
    window.location.href = `/${lang}/memorial/${id}`;
  }
  return (
    <button
      type="button"
      onClick={walk}
      className="px-4 py-2 bg-stone-700/80 hover:bg-stone-600 text-stone-200 rounded-lg transition text-sm"
    >
      {label}
    </button>
  );
}