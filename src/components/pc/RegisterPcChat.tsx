"use client";

import { useEffect } from "react";
import { usePcChatContext } from "../../lib/pcChatContext";

/**
 * 把当前页面展示的纪念馆注册为 PC 对话侧板的对话对象。
 * 卸载（离开页面）时自动清空，侧板回到「请先进入纪念馆」空态。
 */
export default function RegisterPcChat({
  memorialId,
  memorialName,
  avatarUrl,
}: {
  memorialId: string;
  memorialName: string;
  avatarUrl: string;
}) {
  const setCtx = usePcChatContext((s) => s.setCtx);

  useEffect(() => {
    setCtx({ memorialId, memorialName, avatarUrl });
    return () => setCtx(null);
  }, [memorialId, memorialName, avatarUrl, setCtx]);

  return null;
}
