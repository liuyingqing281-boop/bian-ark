"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface LifeEvent {
  id: string;
  year: string;
  title: string;
  description: string;
}

type Labels = Record<string, string>;

export default function TimelineManager({
  memorialId,
  events,
  labels,
}: {
  memorialId: string;
  events: LifeEvent[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    const res = await fetch("/api/timeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memorial_id: memorialId,
        year: (form.elements.namedItem("year") as HTMLInputElement).value,
        title: (form.elements.namedItem("title") as HTMLInputElement).value,
        description: (form.elements.namedItem("description") as HTMLInputElement).value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(labels["err_" + String(data.error)] || labels.errGeneric);
      return;
    }
    form.reset();
    router.refresh();
  }

  async function remove(id: string) {
    await fetch("/api/timeline", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2 flex-wrap items-center">
        <input
          name="year"
          required
          maxLength={20}
          placeholder={labels.timelineYear}
          className="w-28 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-700"
        />
        <input
          name="title"
          required
          maxLength={80}
          placeholder={labels.timelineEventTitle}
          className="flex-1 min-w-32 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-700"
        />
        <input
          name="description"
          maxLength={300}
          placeholder={labels.timelineDesc}
          className="flex-1 min-w-32 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-700"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-1.5 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 rounded-lg transition text-xs"
        >
          {labels.timelineAdd}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {events.length > 0 && (
        <ul className="space-y-1">
          {events.map((ev) => (
            <li key={ev.id} className="group flex items-center gap-2 text-xs text-stone-500">
              <span className="text-amber-600 shrink-0 w-24 truncate">{ev.year}</span>
              <span className="text-stone-400 truncate">{ev.title}</span>
              <button
                type="button"
                onClick={() => remove(ev.id)}
                className="ml-auto px-2 py-0.5 text-red-400 opacity-0 group-hover:opacity-100 transition shrink-0"
              >
                {labels.timelineDelete}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}