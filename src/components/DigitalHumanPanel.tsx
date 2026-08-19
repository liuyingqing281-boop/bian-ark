"use client";
import Image from "next/image";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface DhTask {
  id: string;
  status: string;
  script: string;
  result_video_url: string;
  error: string;
  created_at: string;
}

type Labels = Record<string, string>;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-stone-800 text-stone-400",
  processing: "bg-amber-950/60 text-amber-500 animate-pulse",
  reviewing: "bg-sky-950/60 text-sky-400",
  done: "bg-emerald-950/60 text-emerald-400",
  failed: "bg-red-950/60 text-red-400",
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm)(\?|$)/i.test(url);
}

function ResultMedia({ url, badge }: { url: string; badge: string }) {
  return (
    <div className="relative max-w-sm">
      {isVideoUrl(url) ? (
        <video src={url} controls className="w-full rounded-lg bg-stone-800 aspect-square object-cover" />
      ) : (
        <Image src={url} alt="digital human" className="w-full rounded-lg bg-stone-800 aspect-square object-cover"  fill />
      )}
      <span className="absolute top-2 right-2 text-xs bg-stone-950/85 text-amber-500 px-2 py-0.5 rounded border border-amber-900/50">
        {badge}
      </span>
    </div>
  );
}

export default function DigitalHumanPanel({
  memorialId,
  initialTasks,
  isPremium,
  isMock,
  upgradeHref,
  labels,
}: {
  memorialId: string;
  initialTasks: DhTask[];
  isPremium: boolean;
  isMock: boolean;
  upgradeHref: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<DhTask[]>(initialTasks);
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<"custom" | "bio">("custom");
  const [ratio, setRatio] = useState<"9:16" | "16:9">("9:16");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeTask = tasks.find((t) => t.status !== "failed");
  const polling = tasks.some((t) => t.status === "pending" || t.status === "processing");

  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/digitalhumans?memorial_id=${memorialId}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const list = (data.tasks || []) as DhTask[];
      setTasks(list);
      if (list.some((t) => t.status === "reviewing" || t.status === "done")) router.refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [polling, memorialId, router]);

  async function refreshTasks() {
    const res = await fetch(`/api/digitalhumans?memorial_id=${memorialId}`);
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.tasks)) setTasks(data.tasks);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("consent", consent ? "1" : "0");
    fd.set("use_biography", mode === "bio" ? "1" : "0");
    fd.set("ratio", ratio);
    setBusy(true);
    setError("");
    const res = await fetch("/api/digitalhumans", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(labels["err_" + String(data.error)] || labels.errGeneric);
      return;
    }
    form.reset();
    setConsent(false);
    setMode("custom");
    await refreshTasks();
  }

  async function redo() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "dh_redo", memorial_id: memorialId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setError(labels["err_" + String(data.error)] || labels.errGeneric);
  }

  const statusLabel = (status: string) => labels["status_" + status] || status;

  const friendlyError = (raw: string) => {
    const code = raw.split(":")[0].trim();
    return labels["err_" + code] || raw || labels.errGeneric;
  };

  return (
    <div className="space-y-5">
      {tasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs tracking-widest text-stone-500">{labels.taskList}</h3>
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 p-3 bg-stone-800/40 rounded-lg">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLE[task.status] || STATUS_STYLE.pending}`}>
                    {statusLabel(task.status)}
                  </span>
                  <span className="text-xs text-stone-600">{task.created_at}</span>
                  {task.status === "reviewing" && (
                    <span className="text-xs text-stone-500">{labels.reviewNote}</span>
                  )}
                  {!isMock && (task.status === "pending" || task.status === "processing") && (
                    <span className="text-xs text-stone-500">{labels.waitNote}</span>
                  )}
                </div>
                {task.script && <p className="text-xs text-stone-500 line-clamp-2">{task.script}</p>}
                {task.status === "done" && task.result_video_url && (
                  <ResultMedia url={task.result_video_url} badge={labels.aiBadge} />
                )}
                {task.status === "failed" && task.error && (
                  <p className="text-xs text-red-400">{friendlyError(task.error)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isPremium ? (
        <div className="p-4 bg-stone-800/40 rounded-lg flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-stone-400">{labels.premiumOnly}</p>
          <a
            href={upgradeHref}
            className="px-4 py-1.5 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded-lg transition text-xs"
          >
            {labels.upgrade}
          </a>
        </div>
      ) : activeTask ? (
        <div className="p-4 bg-stone-800/40 rounded-lg space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-stone-400">{labels.redoHint}</p>
            <button
              type="button"
              onClick={redo}
              disabled={busy}
              className="px-4 py-1.5 border border-amber-800 text-amber-500 hover:bg-amber-950/50 disabled:opacity-40 rounded-lg transition text-xs"
            >
              {labels.redoButton}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input type="hidden" name="memorial_id" value={memorialId} />

          <div className="space-y-1">
            <p className="text-xs text-stone-300">{labels.stepPhoto}</p>
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
              className="text-xs text-stone-500 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-stone-700 file:text-stone-200 hover:file:bg-stone-600"
            />
            <p className="text-xs text-stone-600">{labels.photoHint}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-stone-300">{labels.stepAudio}</p>
            <input
              type="file"
              name="audio"
              accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac"
              className="text-xs text-stone-500 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-stone-700 file:text-stone-200 hover:file:bg-stone-600"
            />
            <p className="text-xs text-stone-600">{labels.audioHint}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-stone-300">{labels.stepVideo}</p>
            <input
              type="file"
              name="video"
              accept="video/mp4,video/webm"
              className="text-xs text-stone-500 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-stone-700 file:text-stone-200 hover:file:bg-stone-600"
            />
            <p className="text-xs text-stone-600">{labels.videoHint}</p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
              <input
                type="radio"
                name="script_mode"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
                className="accent-amber-600"
              />
              {labels.scriptCustom}
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
              <input
                type="radio"
                name="script_mode"
                checked={mode === "bio"}
                onChange={() => setMode("bio")}
                className="accent-amber-600"
              />
              {labels.scriptBio}
            </label>
            {mode === "custom" && (
              <textarea
                name="script"
                maxLength={500}
                rows={3}
                placeholder={labels.scriptPlaceholder}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-700"
              />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-stone-300">{labels.ratioLabel}</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                <input
                  type="radio"
                  name="ratio_mode"
                  checked={ratio === "9:16"}
                  onChange={() => setRatio("9:16")}
                  className="accent-amber-600"
                />
                {labels.ratioPortrait}
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                <input
                  type="radio"
                  name="ratio_mode"
                  checked={ratio === "16:9"}
                  onChange={() => setRatio("16:9")}
                  className="accent-amber-600"
                />
                {labels.ratioLandscape}
              </label>
            </div>
          </div>

          <div className="p-3 bg-stone-800/40 border border-stone-700/60 rounded-lg space-y-2">
            <p className="text-xs text-stone-500 leading-relaxed">{labels.consentDecl}</p>
            <label className="flex items-start gap-2 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="accent-amber-600 mt-0.5"
              />
              {labels.consentLabel}
            </label>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {isMock && <p className="text-xs text-stone-600">{labels.mockNote}</p>}

          <button
            type="submit"
            disabled={busy || !consent}
            className="px-5 py-2 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 rounded-lg transition text-xs"
          >
            {busy ? labels.submitting : labels.submit}
          </button>
        </form>
      )}
    </div>
  );
}