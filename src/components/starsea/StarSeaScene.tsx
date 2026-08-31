"use client";

// 星海场景（Task 4）：2.5D 夜空容器。
// - 镜头 = camera transform（translate + scale），星群用 left/top 百分比挂其上；
//   平移拖拽 / 滚轮缩放 / 双指捏合 / 复位，全部经 onCameraChange 上抛控制器。
// - 数据加载由控制器按可视 bbox 分片（首屏 0,0,1,1，镜头变化扩 10%）；
//   API 错误时显示可重试横幅，背景场景仍可操作。
// - panel 非 list 时场景 inert（焦点限制在抽屉/控件内，墓园规格 §6）。
// - 背景星空用纯 CSS 渐变（确定性，无 Math.random）。

import { useEffect, useRef } from "react";
import type { GardenSeaHall } from "../../lib/garden-sea";
import type { GardenSeaState } from "../../lib/garden-sea-state";
import StarCluster from "./StarCluster";
import type { StarClusterLabels } from "./StarCluster";

export interface StarSeaSceneLabels extends StarClusterLabels {
  loading: string;
  empty: string;
  errorTitle: string;
  retry: string;
  scene: string;
}

interface StarSeaSceneProps {
  halls: Array<GardenSeaHall>;
  state: GardenSeaState;
  matchedHallIds: Set<string> | null; // null = 无搜索词，全部匹配
  focusedHallId: string | null;
  loading: boolean;
  error: string | null;
  labels: StarSeaSceneLabels;
  onRetry: () => void;
  onSelectHall: (hallId: string) => void;
  onEnterHall: (hallId: string) => void;
  onCameraChange: (camera: { scale: number; x: number; y: number }) => void;
}

interface PointerState {
  pointers: Map<number, { x: number; y: number }>;
  last: { x: number; y: number } | null;
  pinchBase: { distance: number; scale: number } | null;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

export default function StarSeaScene({
  halls,
  state,
  matchedHallIds,
  focusedHallId,
  loading,
  error,
  labels,
  onRetry,
  onSelectHall,
  onEnterHall,
  onCameraChange,
}: StarSeaSceneProps) {
  const dragRef = useRef<PointerState>({ pointers: new Map(), last: null, pinchBase: null });
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const camera = useRef({ scale: state.scale, x: state.offset.x, y: state.offset.y });
  camera.current = { scale: state.scale, x: state.offset.x, y: state.offset.y };

  function commit(next: { scale: number; x: number; y: number }) {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    onCameraChange({ scale, x: next.x, y: next.y });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".starsea-cluster")) return; // 点星群不触发拖拽
    sceneRef.current?.setPointerCapture(event.pointerId);
    const pointers = dragRef.current.pointers;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragRef.current.last = { x: event.clientX, y: event.clientY };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      dragRef.current.pinchBase = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: camera.current.scale };
    } else {
      dragRef.current.pinchBase = null;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pointers = dragRef.current.pointers;
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && dragRef.current.pinchBase) {
      // 双指捏合：围绕两指中点缩放
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const base = dragRef.current.pinchBase;
      if (base.distance <= 0) return;
      const factor = distance / base.distance;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const current = camera.current;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, base.scale * factor));
      // 中点锚定：mid = offset + scale * p → p = (mid - offset) / scale（按视口归一）
      const px = (mid.x - current.x) / current.scale;
      const py = (mid.y - current.y) / current.scale;
      commit({ scale, x: mid.x - px * scale, y: mid.y - py * scale });
      return;
    }
    const last = dragRef.current.last;
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    dragRef.current.last = { x: event.clientX, y: event.clientY };
    commit({ scale: camera.current.scale, x: camera.current.x + dx, y: camera.current.y + dy });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current.pointers.delete(event.pointerId);
    if (dragRef.current.pointers.size === 0) {
      dragRef.current.last = null;
      dragRef.current.pinchBase = null;
    }
  }

  // React 根节点把 wheel 注册为 passive（React 17+），preventDefault 需原生非 passive 监听
  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return;
    function onWheelNative(event: WheelEvent) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      const current = camera.current;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      // 光标锚定缩放
      const px = (event.clientX - current.x) / current.scale;
      const py = (event.clientY - current.y) / current.scale;
      commit({ scale, x: event.clientX - px * scale, y: event.clientY - py * scale });
    }
    node.addEventListener("wheel", onWheelNative, { passive: false });
    return () => node.removeEventListener("wheel", onWheelNative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inert = state.panel !== "list";

  return (
    <div
      className="garden-sea"
      aria-label={labels.scene}
      ref={sceneRef}
      inert={inert}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="starsea-camera"
        style={{ transform: `translate(${state.offset.x}px, ${state.offset.y}px) scale(${state.scale})` }}
      >
        {halls.map((hall) => (
          <StarCluster
            key={hall.hallId}
            hall={hall}
            matched={!matchedHallIds || matchedHallIds.has(hall.hallId)}
            focused={focusedHallId === hall.hallId}
            labels={labels}
            onSelect={onSelectHall}
            onEnter={onEnterHall}
          />
        ))}
      </div>
      {loading && halls.length === 0 && <div className="garden-sea-skeleton" aria-hidden="true" />}
      {!loading && !error && halls.length === 0 && (
        <p className="starsea-empty">{labels.empty}</p>
      )}
      {error && (
        <div className="starsea-error" role="alert">
          <span>{labels.errorTitle}</span>
          <button type="button" className="starsea-retry" onClick={onRetry}>
            {labels.retry}
          </button>
        </div>
      )}
      {loading && halls.length > 0 && <div className="starsea-loading" aria-hidden="true" />}
    </div>
  );
}
