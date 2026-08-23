"use client";

import { create } from "zustand";

/**
 * PC 对话侧板的纪念馆上下文（M2）。
 * 页面（当前为 hall/[id]）挂载时注册自己正在展示的纪念馆，
 * 全局侧板据此与「当前 TA」对话；离开页面时清空。
 */
export interface PcChatContext {
  memorialId: string;
  memorialName: string;
  avatarUrl: string;
}

interface PcChatContextState {
  ctx: PcChatContext | null;
  setCtx: (ctx: PcChatContext | null) => void;
}

export const usePcChatContext = create<PcChatContextState>((set) => ({
  ctx: null,
  setCtx: (ctx) => set({ ctx }),
}));
