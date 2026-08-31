"use client";

// 星海顶部控件（Task 4，墓园规格 §2/§3）：返回 / 搜索 / 筛选入口 / 2.5D-3D 分段 / 复位。
// - 搜索框：真实 <label for>、清除按钮、结果数 aria-live=polite；输入防抖 400ms
//   才进入状态（300–500ms 区间），搜索只降亮星群、不改坐标（由场景实现）。
// - 复位只改镜头（scale=1 offset=0），不清浏览状态。
// - 动效档位（Task 8，规格 §6「完整/简化/静态；低性能只降默认值，用户可恢复」）：
//   控制条一枚循环按钮，键盘可达（原生 button），档位写 localStorage，默认尊重
//   系统 prefers-reduced-motion（默认值推导在控制器 GardenSea）。
// - 低性能设备（Task 8）：3D 分段禁用——性能闸门只拦 Three.js 创建，动效档仍可恢复。

import { useEffect, useRef, useState } from "react";
import type { GardenSeaState } from "../../lib/garden-sea-state";

const SEARCH_DEBOUNCE_MS = 400;

// ---- 动效档位（Task 8，规格 §6）----
export type MotionTier = "full" | "simplified" | "static";
export const MOTION_STORAGE_KEY = "starsea:motion";
export const MOTION_TIERS: ReadonlyArray<MotionTier> = ["full", "simplified", "static"];

export interface StarSeaControlsLabels {
  back: string;
  search: string;
  searchPlaceholder: string;
  clearSearch: string;
  resultCount: (n: number) => string; // 找到 N 座馆
  zoneAll: string;
  zonePublic: string;
  zoneFamily: string;
  zoneOfficial: string;
  zoneFilterLabel: string;
  view2d: string;
  view3d: string;
  viewSegmentLabel: string;
  /** 3D 分段禁用原因（低性能设备，title 展示） */
  view3dDisabledReason: string;
  reset: string;
  motionTierName: Record<MotionTier, string>; // 完整/简化/静态
  /** 动效档位按钮 aria-label（当前档 + 点击切换语义） */
  motionButtonLabel: (tier: MotionTier) => string;
}

interface StarSeaControlsProps {
  state: GardenSeaState;
  totalHalls: number;
  matchedCount: number;
  labels: StarSeaControlsLabels;
  /** 当前动效档位（Task 8） */
  motionTier: MotionTier;
  /** 循环切换动效档：完整 → 简化 → 静态 → 完整 */
  onMotionCycle: () => void;
  /** 低性能设备：3D 分段禁用（不创建 Three.js） */
  view3dDisabled: boolean;
  onQueryChange: (query: string) => void;
  onZoneChange: (zone: "" | "public" | "family" | "official") => void;
  onViewChange: (view: "2d" | "3d") => void;
  onBack: () => void;
  onResetCamera: () => void;
}

export default function StarSeaControls({
  state,
  totalHalls,
  matchedCount,
  labels,
  motionTier,
  onMotionCycle,
  view3dDisabled,
  onQueryChange,
  onZoneChange,
  onViewChange,
  onBack,
  onResetCamera,
}: StarSeaControlsProps) {
  const [localQuery, setLocalQuery] = useState(state.query);
  const lastEmitted = useRef(state.query);

  // 外部变化（popstate/URL 恢复）回灌输入框，避免用户输入被覆盖成回声
  useEffect(() => {
    if (state.query !== lastEmitted.current) {
      lastEmitted.current = state.query;
      setLocalQuery(state.query);
    }
  }, [state.query]);

  // 防抖：停顿 400ms 后才把搜索词写进状态/URL
  useEffect(() => {
    if (localQuery === lastEmitted.current) return;
    const timer = setTimeout(() => {
      lastEmitted.current = localQuery;
      onQueryChange(localQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearSearch() {
    lastEmitted.current = "";
    setLocalQuery("");
    onQueryChange("");
  }

  const hasQuery = state.query.length > 0;

  return (
    <div className="starsea-controls">
      <div className="starsea-controls-inner">
        <button
          type="button"
          className="starsea-back"
          onClick={onBack}
          disabled={state.panel === "list"}
          aria-label={labels.back}
        >
          ←
        </button>
        <div className="starsea-search">
          <label className="starsea-search-label" htmlFor="starsea-search">
            {labels.search}
          </label>
          <input
            id="starsea-search"
            className="starsea-search-input"
            type="search"
            value={localQuery}
            maxLength={40}
            placeholder={labels.searchPlaceholder}
            onChange={(event) => setLocalQuery(event.target.value)}
          />
          {localQuery && (
            <button type="button" className="starsea-search-clear" onClick={clearSearch} aria-label={labels.clearSearch}>
              ✕
            </button>
          )}
        </div>
        <p className="starsea-count" aria-live="polite">
          {hasQuery ? labels.resultCount(matchedCount) : labels.resultCount(totalHalls)}
        </p>
        <label className="starsea-zone-label" htmlFor="starsea-zone">
          {labels.zoneFilterLabel}
        </label>
        <select
          id="starsea-zone"
          className="starsea-zone"
          value={state.zone || ""}
          onChange={(event) => onZoneChange(event.target.value as "" | "public" | "family" | "official")}
        >
          <option value="">{labels.zoneAll}</option>
          <option value="public">{labels.zonePublic}</option>
          <option value="family">{labels.zoneFamily}</option>
          <option value="official">{labels.zoneOfficial}</option>
        </select>
        <div className="starsea-segment" role="group" aria-label={labels.viewSegmentLabel}>
          <button
            type="button"
            className={state.view === "2d" ? "is-active" : ""}
            aria-pressed={state.view === "2d"}
            onClick={() => onViewChange("2d")}
          >
            {labels.view2d}
          </button>
          <button
            type="button"
            className={state.view === "3d" ? "is-active" : ""}
            aria-pressed={state.view === "3d"}
            disabled={view3dDisabled}
            title={view3dDisabled ? labels.view3dDisabledReason : undefined}
            onClick={() => onViewChange("3d")}
          >
            {labels.view3d}
          </button>
        </div>
        <button
          type="button"
          className="starsea-motion"
          onClick={onMotionCycle}
          aria-label={labels.motionButtonLabel(motionTier)}
        >
          {labels.motionTierName[motionTier]}
        </button>
        <button type="button" className="starsea-reset" onClick={onResetCamera} aria-label={labels.reset}>
          ⟳
        </button>
      </div>
    </div>
  );
}
