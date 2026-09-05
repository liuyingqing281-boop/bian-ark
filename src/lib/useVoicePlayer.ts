"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useVoicePlayer —— 🔊 流式朗读（docs/14 §2.2，web/01 §11.2）
 * POST voice 接口（SSE）→ 逐片 base64 PCM16（24kHz 单声道）→ AudioContext 边收边播。
 * stop() 即断流；组件卸载自动清理。
 */

function base64ToFloat32(b64: string): Float32Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(new ArrayBuffer(int16.length * 4));
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
  return float32 as Float32Array<ArrayBuffer>;
}

export function useVoicePlayer() {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextTimeRef = useRef(0);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPlayingKey(null);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      ctxRef.current?.close().catch(() => {});
    },
    []
  );

  /** key 为气泡标识（同一 key 再点 = 中止）；body 为接口请求体 */
  const play = useCallback(
    async (key: string, url: string, body: Record<string, unknown>) => {
      if (playingKey === key) {
        stop();
        return;
      }
      stop();
      setError(false);
      setPlayingKey(key);
      try {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-client-platform": window.innerWidth >= 768 ? "web-pc" : "web-mobile",
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          setError(true);
          setPlayingKey(null);
          return;
        }
        if (!ctxRef.current || ctxRef.current.state === "closed") {
          ctxRef.current = new AudioContext({ sampleRate: 24000 });
        }
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") await ctx.resume();
        nextTimeRef.current = ctx.currentTime;

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
              if (payload.error) throw new Error("upstream");
              if (typeof payload.audio === "string" && payload.audio) {
                const samples = base64ToFloat32(payload.audio);
                if (samples.length === 0) continue;
                const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
                audioBuffer.copyToChannel(samples, 0);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                const at = Math.max(nextTimeRef.current, ctx.currentTime);
                source.start(at);
                nextTimeRef.current = at + audioBuffer.duration;
              }
            } catch (err) {
              if (err instanceof Error && err.message === "upstream") throw err;
              /* 跳过坏分片 */
            }
          }
        }
        // 播放到队列尾再复位状态
        const remain = Math.max(0, nextTimeRef.current - ctx.currentTime);
        setTimeout(() => setPlayingKey((k) => (k === key ? null : k)), remain * 1000);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setError(true);
        setPlayingKey(null);
      }
    },
    [playingKey, stop]
  );

  return { playingKey, error, play, stop };
}
