"use client";

// 星海场景（Task 4）：2.5D 夜空容器。
// - 镜头 = camera transform（translate + scale），星群用 left/top 百分比挂其上；
//   平移拖拽 / 滚轮缩放 / 双指捏合 / 复位，全部经 onCameraChange 上抛控制器。
// - 数据加载由控制器按可视 bbox 分片（首屏 0,0,1,1，镜头变化扩 10%）；
//   API 错误时显示可重试横幅，背景场景仍可操作。
// - panel 非 list 时场景 inert（焦点限制在抽屉/控件内，墓园规格 §6）。
// - 背景星空用纯 CSS 渐变（确定性，无 Math.random）。
// - 择位模式（Task 6，墓园规格 §8.3）：placementHallId 非 null 时仅该星群可
//   pointer capture 拖拽（草稿位经控制器，松开提交 PATCH）；普通浏览
//   pointer down/up 只处理点击（点星群聚焦 / 拖空白平移），绝不移动星群。
//   拖拽期间显示 44px 目标环 + 实时坐标（馆主专属；访客永远看不到）。

import { useEffect, useRef } from "react";
import type { GardenSeaHall } from "../../lib/garden-sea";
import { roundPlacementPoint } from "../../lib/garden-sea";
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
  /** 择位模式目标馆（Task 6；非 null = 择位激活，馆主专属流程） */
  placementHallId: string | null;
  /** 拖拽草稿位（0–1 三位小数）；null = 尚未拖拽（星群停在原位） */
  placementDraft: { x: number; y: number } | null;
  /** 发送中锁定：禁止开始新的拖拽（Esc 仍可退出，由控制器处理） */
  placementLocked: boolean;
  loading: boolean;
  error: string | null;
  labels: StarSeaSceneLabels;
  onRetry: () => void;
  onSelectHall: (hallId: string) => void;
  onEnterHall: (hallId: string) => void;
  onCameraChange: (camera: { scale: number; x: number; y: number }) => void;
  onPlacementDrag: (point: { x: number; y: number }) => void;
  onPlacementDrop: (point: { x: number; y: number }) => void;
}

interface PointerState {
  pointers: Map<number, { x: number; y: number }>;
  last: { x: number; y: number } | null;
  pinchBase: { distance: number; scale: number } | null;
}

interface PlacementDrag {
  pointerId: number;
  /** 抓取点偏移（pointerNorm − 星群Norm）：拖拽中星群不跳变到手心 */
  grab: { x: number; y: number };
  /** 拖拽开始时星群的基准位（0–1）：pointerup 落点 ≈ 基准位 = 无位移点击，不提交 */
  base: { x: number; y: number };
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

export default function StarSeaScene({
  halls,
  state,
  matchedHallIds,
  focusedHallId,
  placementHallId,
  placementDraft,
  placementLocked,
  loading,
  error,
  labels,
  onRetry,
  onSelectHall,
  onEnterHall,
  onCameraChange,
  onPlacementDrag,
  onPlacementDrop,
}: StarSeaSceneProps) {
  const dragRef = useRef<PointerState>({ pointers: new Map(), last: null, pinchBase: null });
  const placementDragRef = useRef<PlacementDrag | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const camera = useRef({ scale: state.scale, x: state.offset.x, y: state.offset.y });
  camera.current = { scale: state.scale, x: state.offset.x, y: state.offset.y };

  function commit(next: { scale: number; x: number; y: number }) {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    onCameraChange({ scale, x: next.x, y: next.y });
  }

  // 视口坐标 → 场景归一化坐标（scene getBoundingClientRect 为基准，逆 camera transform）
  function sceneToNorm(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const cam = camera.current;
    return {
      x: (clientX - rect.left - cam.x) / (cam.scale * rect.width),
      y: (clientY - rect.top - cam.y) / (cam.scale * rect.height),
    };
  }

  // 拖拽前星群的当前视觉位（草稿优先，未拖过 = 原位）
  const placingHall = placementHallId ? halls.find((hall) => hall.hallId === placementHallId) || null : null;
  const placementBase =
    placementHallId ? (placementDraft || (placingHall ? { x: placingHall.x, y: placingHall.y } : null)) : null;

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (placementHallId) {
      const hit = (event.target as HTMLElement).closest(".starsea-cluster");
      if (hit && hit.getAttribute("data-hall-id") === placementHallId) {
        // 择位拖拽：仅显式择位模式 + 命中被择位星群才启用 pointer capture
        if (placementLocked) return; // 发送中锁定（Esc 退出归控制器）
        event.preventDefault();
        const norm = sceneToNorm(event.clientX, event.clientY);
        const base = placementBase || (norm ? { x: norm.x, y: norm.y } : { x: 0.5, y: 0.5 });
        placementDragRef.current = {
          pointerId: event.pointerId,
          grab: norm ? { x: norm.x - base.x, y: norm.y - base.y } : { x: 0, y: 0 },
          base: { x: base.x, y: base.y },
        };
        sceneRef.current?.setPointerCapture(event.pointerId);
        return;
      }
      if (hit) return; // 择位任务态：点其他星群不触发选中/聚焦（空场景仍可平移环顾）
    }
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
    const placement = placementDragRef.current;
    if (placement) {
      if (event.pointerId !== placement.pointerId) return;
      const norm = sceneToNorm(event.clientX, event.clientY);
      if (!norm) return;
      onPlacementDrag(roundPlacementPoint(norm.x - placement.grab.x, norm.y - placement.grab.y));
      return;
    }
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
    const placement = placementDragRef.current;
    if (placement && event.pointerId === placement.pointerId) {
      placementDragRef.current = null;
      const norm = sceneToNorm(event.clientX, event.clientY);
      if (!norm) return;
      const drop = roundPlacementPoint(norm.x - placement.grab.x, norm.y - placement.grab.y);
      // 无位移点击（pointerup 落点 ≈ 拖拽开始基准位，半个千分位内 = 亚像素抖动）
      // 不提交 PATCH：馆主在择位中点了一下自己的星群 ≠ 择位确认（Fix Round 1）
      const moved =
        Math.abs(drop.x - placement.base.x) >= 0.0005 || Math.abs(drop.y - placement.base.y) >= 0.0005;
      if (moved) onPlacementDrop(drop);
      return;
    }
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
      data-placing={placementHallId || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="starsea-camera"
        style={{ transform: `translate(${state.offset.x}px, ${state.offset.y}px) scale(${state.scale})` }}
      >
        {halls.map((hall) => {
          // 择位草稿不改 halls 节点数组（搜索空间不变性红线）：仅渲染层克隆覆盖坐标
          const isPlacing = placementHallId === hall.hallId;
          const renderHall =
            isPlacing && placementDraft ? { ...hall, x: placementDraft.x, y: placementDraft.y } : hall;
          return (
            <StarCluster
              key={hall.hallId}
              hall={renderHall}
              matched={!matchedHallIds || matchedHallIds.has(hall.hallId)}
              focused={focusedHallId === hall.hallId}
              labels={labels}
              onSelect={onSelectHall}
              onEnter={onEnterHall}
            />
          );
        })}
        {placementHallId && placementBase && (
          // 44px 目标环 + 实时坐标（馆主专属）：挂 camera 层用归一化百分比定位，
          // 随镜头变换；样式内联（globals.css 不在本任务改动清单内，Task 8/9 归拢 token）
          <div
            className="starsea-placement-ring"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${placementBase.x * 100}%`,
              top: `${placementBase.y * 100}%`,
              width: "44px",
              height: "44px",
              margin: 0,
              transform: "translate(-50%, -50%)",
              border: "2px dashed rgba(252, 211, 77, 0.85)",
              borderRadius: "50%",
              boxSizing: "border-box",
              background: "rgba(252, 211, 77, 0.08)",
              pointerEvents: "none",
            }}
          >
            <span
              className="starsea-placement-coords"
              style={{
                position: "absolute",
                left: "50%",
                top: "calc(100% + 6px)",
                transform: "translateX(-50%)",
                padding: "2px 8px",
                borderRadius: "8px",
                background: "rgba(10, 13, 26, 0.92)",
                color: "#cdd5e5",
                fontSize: "11px",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              {placementBase.x.toFixed(3)}, {placementBase.y.toFixed(3)}
            </span>
          </div>
        )}
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
