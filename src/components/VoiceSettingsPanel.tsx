"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoicePlayer } from "../lib/useVoicePlayer";

/**
 * VoiceSettingsPanel —— 角色音色配置（FR-14，docs/14 §2.3，web/01 §11.3）
 * A 档：预置音色试听选择 / 一句话描述生成；B 档：生前声音复刻（授权 + 人工审核）。
 * 挂在「我的」纪念馆设置条下方。
 */

interface VoiceProfile {
  mode: "none" | "preset" | "design" | "clone" | string;
  voice: string;
  voiceDesc: string;
  cloneStatus: "" | "pending" | "approved" | "rejected";
  updatedAt: string;
}

const inputCls =
  "bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-700";
const btnCls =
  "px-3 py-1.5 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-100 rounded-lg transition text-xs";

export default function VoiceSettingsPanel({ memorialId }: { memorialId: string }) {
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [presets, setPresets] = useState<string[]>([]);
  const [voiceDesc, setVoiceDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const player = useVoicePlayer();

  const load = useCallback(() => {
    fetch(`/api/memorials/${memorialId}/voice`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setProfile(d.voiceProfile ?? null);
        setPresets(Array.isArray(d.presetVoices) ? d.presetVoices : []);
      })
      .catch(() => {});
  }, [memorialId]);

  useEffect(load, [load]);

  const showHint = (text: string) => {
    setHint(text);
    setTimeout(() => setHint(null), 3000);
  };

  const preview = (payload: Record<string, unknown>) => {
    player.play("voice-preview", "/api/voice/preview", { line: 0, ...payload });
  };

  const save = async (payload: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/memorials/${memorialId}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.voiceProfile) setProfile(data.voiceProfile);
      showHint("声音已保存");
    } else if (res.status === 422) {
      showHint("这段描述不合适，换一句试试");
    } else {
      showHint("保存失败，稍后再试");
    }
  };

  const submitClone = async () => {
    if (!file || !consent || busy) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("consentAccepted", "true");
    const res = await fetch(`/api/memorials/${memorialId}/voice`, { method: "POST", body: fd });
    setBusy(false);
    if (res.status === 202) {
      setFile(null);
      setConsent(false);
      if (fileRef.current) fileRef.current.value = "";
      load();
      showHint("已提交审核，通过后即可使用");
    } else if (res.status === 413) {
      showHint("音频超过 10MB，请裁剪后再传");
    } else if (res.status === 422) {
      showHint("请先勾选授权声明");
    } else {
      showHint("上传失败，稍后再试");
    }
  };

  const statusText =
    profile?.mode === "clone"
      ? profile.cloneStatus === "pending"
        ? "声音审核中…"
        : profile.cloneStatus === "approved"
          ? "已启用 TA 生前的声音"
          : profile.cloneStatus === "rejected"
            ? "复刻未通过审核，可重新上传"
            : ""
      : profile?.mode === "preset"
        ? `当前音色：${profile.voice}`
        : profile?.mode === "design"
          ? "当前音色：描述生成"
          : "未配置（朗读用默认温和音色）";

  return (
    <div className="w-full mt-2 rounded-xl border border-stone-800 bg-stone-900/60 p-4 space-y-3 text-xs text-stone-400">
      <div className="flex items-center justify-between">
        <span className="text-stone-300 text-sm">TA 的声音</span>
        <span className="text-stone-500">{statusText}</span>
      </div>

      {/* A 档：预置音色 */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((v) => (
            <span key={v} className="flex items-center gap-1 rounded-lg border border-stone-700 px-2 py-1">
              <button type="button" onClick={() => preview({ voice: v })} className="hover:text-amber-400 transition" aria-label={`试听${v}`}>
                {player.playingKey === "voice-preview" ? "⏸" : "▶"}
              </button>
              <span className="text-stone-300">{v}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => save({ mode: "preset", voice: v })}
                className="text-amber-500 hover:text-amber-400 transition disabled:opacity-40"
              >
                选用
              </button>
            </span>
          ))}
        </div>
      )}

      {/* A 档：描述生成 */}
      <div className="flex gap-2">
        <input
          value={voiceDesc}
          onChange={(e) => setVoiceDesc(e.target.value)}
          maxLength={100}
          placeholder="或者描述一种声音，如「年迈女性，语速慢，带江南口音」"
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          disabled={!voiceDesc.trim()}
          onClick={() => preview({ voiceDesc: voiceDesc.trim() })}
          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-300 rounded-lg transition text-xs"
        >
          试听
        </button>
        <button
          type="button"
          disabled={!voiceDesc.trim() || busy}
          onClick={() => save({ mode: "design", voiceDesc: voiceDesc.trim() })}
          className={btnCls}
        >
          生成并保存
        </button>
      </div>

      {/* B 档：生前声音复刻 */}
      <details className="rounded-lg border border-stone-800 p-3">
        <summary className="cursor-pointer text-stone-400 hover:text-stone-200 transition">
          用 TA 生前的声音（需审核）
        </summary>
        <div className="mt-3 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-800 file:px-3 file:py-1.5 file:text-stone-300 file:text-xs"
          />
          <p className="text-stone-600">mp3 / wav，≤10MB，建议 10 秒以上清晰人声</p>
          <label className="flex items-start gap-2 cursor-pointer text-stone-400">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 accent-amber-600"
            />
            我是逝者近亲属或已获合法授权，同意将此声音样本用于纪念馆内的语音合成
          </label>
          <button type="button" disabled={!file || !consent || busy} onClick={submitClone} className={btnCls}>
            提交审核
          </button>
        </div>
      </details>

      {profile && profile.mode !== "none" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => save({ mode: "none" })}
          className="text-stone-600 hover:text-stone-400 transition"
        >
          清除声音配置
        </button>
      )}
      {hint && <p className="text-amber-500">{hint}</p>}
      {player.error && <p className="text-stone-500">试听暂时不可用</p>}
    </div>
  );
}
