"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useVoiceInput —— 🎙 按住说话（docs/14 §2.1，web/01 §11.1）
 * MediaRecorder 录音 → 重采样 16kHz 单声道 → WAV PCM16 → base64 → POST /api/voice/asr（SSE 流式回文字）
 * 不支持录音时 supported=false（UI 回落置灰态）。
 */

const MAX_SECONDS = 60;

function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 单声道
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** 任意浏览器录音格式 → 16kHz 单声道 WAV data URL（MiMo ASR 仅收 wav/mp3） */
async function blobToWavDataUrl(blob: Blob): Promise<string> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const targetRate = 16000;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * targetRate)), targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const wav = encodeWavPcm16(rendered.getChannelData(0), targetRate);
    return `data:audio/wav;base64,${arrayBufferToBase64(wav)}`;
  } finally {
    ctx.close().catch(() => {});
  }
}

export type VoiceInputError = "mic_denied" | "unavailable" | "failed" | null;

export function useVoiceInput({ onDelta }: { onDelta: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<VoiceInputError>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const supported =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (!supported || recording || busy) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        cleanup();
        if (cancelledRef.current || chunksRef.current.length === 0) return;
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const dataUrl = await blobToWavDataUrl(blob);
          abortRef.current = new AbortController();
          const res = await fetch("/api/voice/asr", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-client-platform": window.innerWidth >= 768 ? "web-pc" : "web-mobile",
            },
            body: JSON.stringify({ audio: dataUrl }),
            signal: abortRef.current.signal,
          });
          if (res.status === 503) { setError("unavailable"); return; }
          if (!res.ok || !res.body) { setError("failed"); return; }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() ?? "";
            for (const raw of events) {
              const line = raw.split("\n").find((l) => l.startsWith("data:"));
              if (!line) continue;
              try {
                const payload = JSON.parse(line.slice(5).trim());
                if (typeof payload.delta === "string" && payload.delta) onDelta(payload.delta);
                if (payload.error) setError("failed");
              } catch { /* 跳过坏分片 */ }
            }
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) setError("failed");
        } finally {
          setBusy(false);
        }
      };
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            // 到上限自动结束并提交识别
            recorderRef.current?.state === "recording" && recorderRef.current.stop();
            setRecording(false);
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("mic_denied");
      cleanup();
    }
  }, [supported, recording, busy, cleanup, onDelta]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
    setBusy(false);
    cleanup();
  }, [cleanup]);

  return { supported, recording, busy, seconds, error, start, stop, cancel, maxSeconds: MAX_SECONDS };
}
