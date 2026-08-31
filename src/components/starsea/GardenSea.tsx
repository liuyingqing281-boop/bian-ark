"use client";

// 星海客户端控制器（Task 3 最小实现）：
// - 挂载时从 URL 初始化浏览状态（parseGardenUrl），此后经 gardenSeaReducer 演进；
// - 状态变化以 window.history.replaceState 同步回 URL（Next 16 官方支持的原生 History 集成，
//   不产生历史条目；交互推历史由 Task 4 按需改 pushState）；
// - 镜头（scale/offset）按 lang 存 sessionStorage，URL 不承载像素坐标（刷新不恢复坐标）；
// - 不使用 useSearchParams（预渲染需 Suspense 边界），初始 URL 直接读 window.location.search。
// 场景 / 控件 / 抽屉 / 数据拉取（/api/garden/starsea）均为 Task 4 范围；
// 当前渲染固定尺寸骨架占位，初次加载不因数据返回改变布局。

import { useEffect, useReducer, useRef } from "react";
import {
  DEFAULT_GARDEN_CAMERA,
  gardenCameraStorageKey,
  gardenSeaReducer,
  initialGardenSeaState,
  loadGardenCamera,
  parseGardenUrl,
  saveGardenCamera,
  serializeGardenUrl,
} from "../../lib/garden-sea-state";
import type { GardenSeaState } from "../../lib/garden-sea-state";

interface GardenSeaProps {
  lang: string;
  /** 服务端合法化后的初始搜索词（trim + 截 40），SSR 兜底用；客户端以 URL 为准 */
  initialQuery: string;
}

function initState(initialQuery: string): GardenSeaState {
  // SSR 阶段无 window：以服务端注入的初始值兜底（骨架 DOM 不依赖状态，无水合错配）
  if (typeof window === "undefined") {
    return { ...initialGardenSeaState(), query: initialQuery };
  }
  return parseGardenUrl(new URLSearchParams(window.location.search));
}

export default function GardenSea({ lang, initialQuery }: GardenSeaProps) {
  const [state, dispatch] = useReducer(gardenSeaReducer, undefined, () => initState(initialQuery));
  const cameraKey = gardenCameraStorageKey(lang);

  // 挂载后恢复本语言上次镜头（镜头只走 sessionStorage；与默认镜头相同则不动）
  useEffect(() => {
    const camera = loadGardenCamera(cameraKey);
    if (
      camera.scale !== DEFAULT_GARDEN_CAMERA.scale ||
      camera.offset.x !== DEFAULT_GARDEN_CAMERA.offset.x ||
      camera.offset.y !== DEFAULT_GARDEN_CAMERA.offset.y
    ) {
      dispatch({ type: "restoreCamera", scale: camera.scale, offset: camera.offset });
    }
  }, [cameraKey]);

  // 镜头持久化（reducer 纯函数，存储副作用归控制器）；跳过首帧，只记用户产生的镜头变化
  const cameraPristine = useRef(true);
  useEffect(() => {
    if (cameraPristine.current) {
      cameraPristine.current = false;
      return;
    }
    saveGardenCamera(cameraKey, { scale: state.scale, offset: state.offset });
  }, [cameraKey, state.scale, state.offset.x, state.offset.y]);

  // URL 同步：状态 → 规范查询串（白名单 view/q/zone/hall/memorial/panel），
  // 与当前地址一致则不写，避免无谓的 replaceState
  useEffect(() => {
    const search = serializeGardenUrl(state).toString();
    const current = window.location.search.replace(/^\?/, "");
    if (search === current) return;
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history.replaceState(window.history.state, "", url);
  }, [state]);

  return (
    <div className="garden-sea" aria-busy="true" aria-label="星海加载中" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Task 4 将以星海场景替换此骨架；固定尺寸占位，不因数据返回改变布局 */}
      <div
        className="garden-sea-skeleton"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 280,
          height: 320,
          transform: "translate(-50%, -50%)",
          borderRadius: 16,
          border: "1px solid rgba(232, 226, 214, 0.12)",
          background: "rgba(232, 226, 214, 0.04)",
        }}
      />
    </div>
  );
}
