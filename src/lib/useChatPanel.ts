"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * PC 对话侧板状态（M1）。
 * - localStorage 记忆：`pc.chat.open` 展开态、`pc.chat.intro` 身份说明已确认
 * - Esc 收起侧板（身份说明层无 Esc 出口）
 * - 任意页面可通过 window.dispatchEvent(new CustomEvent("pc:request-chat")) 唤起
 * M2 将接入 HallChat 真实对话。
 */
export function useChatPanel() {
  const [open, setOpen] = useState(false);
  const [introSeen, setIntroSeen] = useState(true); // 默认 true 避免 SSR 首帧闪烁，挂载后读取真实值
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    setOpen(localStorage.getItem("pc.chat.open") === "1");
    setIntroSeen(localStorage.getItem("pc.chat.intro") === "1");
  }, []);

  const doOpen = useCallback(() => {
    localStorage.setItem("pc.chat.open", "1");
    setOpen(true);
  }, []);

  const requestOpen = useCallback(() => {
    if (localStorage.getItem("pc.chat.intro") !== "1") {
      setShowIntro(true); // 首次必经身份说明
      return;
    }
    doOpen();
  }, [doOpen]);

  const confirmIntro = useCallback(() => {
    localStorage.setItem("pc.chat.intro", "1"); // 点击按钮 = 确认边界
    setIntroSeen(true);
    setShowIntro(false);
    doOpen();
  }, [doOpen]);

  const close = useCallback(() => {
    localStorage.setItem("pc.chat.open", "0");
    setOpen(false);
  }, []);

  // Esc 收起侧板；说明层无 Esc 出口
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !showIntro) close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, showIntro, close]);

  // 全局唤起事件
  useEffect(() => {
    const onReq = () => requestOpen();
    window.addEventListener("pc:request-chat", onReq);
    return () => window.removeEventListener("pc:request-chat", onReq);
  }, [requestOpen]);

  return { open, introSeen, showIntro, requestOpen, confirmIntro, close };
}

/** 任意组件唤起 PC 对话侧板（移动端无壳时静默无效） */
export function requestPcChat() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pc:request-chat"));
  }
}
