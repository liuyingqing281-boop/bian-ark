"use client";
import Image from "next/image";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Labels = Record<string, string>;

export interface MediaItem {
  id: string;
  kind: string;
  url: string;
  thumb_url: string;
  caption: string;
}

export default function MediaManager({
  memorialId,
  media,
  labels,
}: {
  memorialId: string;
  media: MediaItem[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setErrors([]);
    const res = await fetch("/api/media", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (Array.isArray(data.errors) && data.errors.length > 0) setErrors(data.errors);
    if (res.ok) {
      form.reset();
      router.refresh();
    }
  }

  async function remove(id: string) {
    await fetch("/api/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={upload} className="flex gap-2 flex-wrap items-center">
        <input type="hidden" name="memorial_id" value={memorialId} />
        <input
          type="file"
          name="files"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          required
          className="text-xs text-stone-500 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-stone-700 file:text-stone-200 hover:file:bg-stone-600"
        />
        <input
          name="caption"
          placeholder={labels.captionPlaceholder}
          className="flex-1 min-w-32 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-700"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-1.5 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 rounded-lg transition text-xs"
        >
          {busy ? labels.uploading : labels.uploadMedia}
        </button>
      </form>
      <p className="text-xs text-stone-600">{labels.mediaQuota}</p>
      {errors.length > 0 && (
        <ul className="text-xs text-red-400 space-y-1">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media.map((item) => (
            <div key={item.id} className="relative group">
              {item.kind === "video" ? (
                <video src={item.url} controls className="w-full aspect-square object-cover rounded-lg bg-stone-800" />
              ) : (
                <a href={item.url} target="_blank" rel="noreferrer">
                  <Image                     src={item.thumb_url || item.url}
                    alt={item.caption}
                    className="w-full aspect-square object-cover rounded-lg bg-stone-800"
                   fill />
                </a>
              )}
              {item.caption && <p className="mt-1 text-xs text-stone-500 truncate">{item.caption}</p>}
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="absolute top-1.5 right-1.5 px-2 py-0.5 bg-stone-950/80 text-red-400 rounded text-xs opacity-0 group-hover:opacity-100 transition"
              >
                {labels.deleteMedia}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}