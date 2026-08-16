"use client";
import Image from "next/image";
import ItemAsset from "./ItemAsset";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PanelItem {
  id: string;
  label: string;
  icon: string;
  image_url: string;
  premium: number;
}

type Labels = Record<string, string>;

const inputCls =
  "ui-control min-w-0 px-4 py-2 text-sm placeholder-stone-600";

function ItemCard({
  item,
  selected,
  onSelect,
}: {
  item: PanelItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const hue = item.id ? item.id.charCodeAt(0) * 37 + item.id.length * 13 : 0;
  return (
    <label
      className={`flex h-28 min-w-0 cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 transition ${
        selected ? "border-amber-600 bg-amber-950/30 shadow-lg shadow-amber-900/20" : "border-stone-800 hover:border-amber-700/50"
      }`}
    >
      <input type="radio" name="item_id" value={item.id} checked={selected} onChange={onSelect} className="sr-only" />
      {item.image_url ? (
        <ItemAsset src={item.image_url} alt={item.label} fallback={item.icon} />
      ) : (
        <div
          className="w-12 h-12 rounded-md flex items-center justify-center text-2xl shadow-md"
          style={{
            background: `linear-gradient(145deg, hsl(${hue}, 25%, 35%), hsl(${hue}, 20%, 20%))`,
            boxShadow: `inset 0 1px 0 hsla(${hue}, 40%, 60%, 0.3), 0 2px 4px rgba(0,0,0,0.4)`,
          }}
        >
          <span aria-hidden style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>{item.icon || "🕯️"}</span>
        </div>
      )}
      <span className="text-xs text-stone-500 text-center leading-tight">{item.label}</span>
      {item.premium === 1 && (
        <span className="text-[10px] text-amber-600 bg-amber-950/50 px-1 rounded">VIP</span>
      )}
    </label>
  );
}

export default function OfferPanel({
  lang,
  memorialId,
  officialItems,
  myItems,
  loggedIn,
  labels,
}: {
  lang: string;
  memorialId: string;
  officialItems: PanelItem[];
  myItems: PanelItem[];
  loggedIn: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"official" | "mine">("official");
  const [selected, setSelected] = useState(officialItems[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const shownItems = tab === "official" ? officialItems : myItems;

  async function submitTribute(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("item_id", selected);
    setBusy(true);
    setError("");
    setSuccess(false);
    const res = await fetch("/api/tribute", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || labels.failed);
      return;
    }
    form.reset();
    setSuccess(true);
    router.refresh();
  }

  async function uploadItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setError("");
    const res = await fetch("/api/items/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      form.reset();
      router.refresh();
    } else {
      setError(data.error || labels.failed);
    }
  }

  async function generate() {
    if (prompt.trim().length < 2) return;
    setGenerating(true);
    setError("");
    setCandidates([]);
    const idempotencyKey = `web-${Date.now()}-${crypto.randomUUID()}`;
    const res = await fetch("/api/items/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setGenerating(false);
    if (res.ok) {
      setCandidates(data.candidates || []);
    } else {
      setError(data.error || labels.failed);
    }
  }

  async function claim(url: string) {
    setBusy(true);
    const res = await fetch("/api/items/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, prompt: prompt.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setCandidates([]);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {loggedIn && (
        <div className="flex flex-wrap gap-2" role="tablist">
          <button
            type="button"
            onClick={() => setTab("official")}
            className={`px-4 py-1.5 rounded-full text-xs transition ${
              tab === "official" ? "bg-amber-700 text-amber-100" : "bg-stone-800 text-stone-400 hover:text-stone-200"
            }`}
          >
            {labels.officialItems}
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`px-4 py-1.5 rounded-full text-xs transition ${
              tab === "mine" ? "bg-amber-700 text-amber-100" : "bg-stone-800 text-stone-400 hover:text-stone-200"
            }`}
          >
            {labels.myItems}
          </button>
        </div>
      )}

      <form onSubmit={submitTribute} className="space-y-4">
        <input type="hidden" name="memorial_id" value={memorialId} />
        <input type="hidden" name="lang" value={lang} />
        {shownItems.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
            {shownItems.map((item) => (
              <ItemCard key={item.id} item={item} selected={selected === item.id} onSelect={() => setSelected(item.id)} />
            ))}
          </div>
        ) : (
          tab === "mine" && <p className="text-xs text-stone-600">{labels.noCustomItems}</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_auto]">
          <input name="sender_name" placeholder={labels.namePlaceholder} className={`${inputCls} flex-1`} />
          <input name="message" placeholder={labels.messagePlaceholder} className={`${inputCls} flex-1`} />
          <button
            type="submit"
            disabled={busy || !selected}
            className="ui-button ui-button-primary px-6 py-2 whitespace-nowrap"
          >
            {labels.offerButton}
          </button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-500">
          <input type="checkbox" name="is_burning" value="1" className="accent-amber-600" />
          {labels.burnLabel}
        </label>
        <div aria-live="polite">
          {success && <p className="ui-status-success">{labels.offerSuccess}</p>}
          {error && <p className="ui-status-error">{error}</p>}
        </div>
      </form>

      {tab === "mine" && loggedIn && (
        <div className="border-t border-stone-800 pt-4 space-y-4">
          <form onSubmit={uploadItem} className="flex gap-2 flex-wrap items-center">
            <input name="name" required placeholder={labels.itemNamePlaceholder} className={`${inputCls} w-40`} />
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              required
              className="text-xs text-stone-500 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-stone-700 file:text-stone-200 hover:file:bg-stone-600"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-stone-200 rounded-lg transition text-xs"
            >
              {labels.uploadItem}
            </button>
          </form>

          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={labels.promptPlaceholder}
                maxLength={100}
                className={`${inputCls} flex-1 min-w-48`}
              />
              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 rounded-lg transition text-xs"
              >
                {generating ? labels.generating : labels.generateItem}
              </button>
            </div>
            <p className="text-[11px] text-stone-600">{labels.quotaHint}</p>
            {candidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-stone-500">{labels.pickOne}</p>
                <div className="grid grid-cols-4 gap-2">
                  {candidates.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => claim(url)}
                      disabled={busy}
                      className="rounded-lg overflow-hidden border border-stone-800 hover:border-amber-600 transition"
                    >
                      <Image src={url} alt="candidate" className="w-full aspect-square object-cover"  fill />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {error && <p className="ui-status-error">{error}</p>}
        </div>
      )}

      {!loggedIn && <p className="text-[11px] text-stone-600">{labels.loginToCustom}</p>}
    </div>
  );
}
