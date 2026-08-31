// 星海浏览状态机（Task 3）：数据、镜头、选中项、抽屉与 URL 历史收敛为纯函数状态机。
// URL 契约（只写这 6 个参数）：view / q / zone / hall / memorial / panel；
// scale/offset（像素镜头）只进 sessionStorage（键按 lang 区分），刷新不恢复坐标，
// JSON 解析失败或结构非法时回到默认镜头。
// reducer 保持纯函数（无任何存储副作用）；持久化与 URL 回写由调用方
// （components/starsea/GardenSea 控制器）负责。
// 注：本模块须保持可擦除 TS 语法，供 node --experimental-strip-types 直载。

import type { GardenZone } from "./garden-sea";

export type GardenPanel = "list" | "detail" | "offer";
export type GardenDrawer = "collapsed" | "half" | "full";
export type GardenView = "2d" | "3d";

export interface GardenSeaCamera {
  scale: number;
  offset: { x: number; y: number };
}

export interface GardenSeaState {
  view: GardenView;
  query: string;
  zone: GardenZone | null;
  drawer: GardenDrawer;
  panel: GardenPanel;
  selectedHallId: string | null;
  selectedMemorialId: string | null;
  scale: number;
  offset: { x: number; y: number };
}

export type GardenSeaAction =
  | { type: "selectHall"; hallId: string }
  | { type: "selectMemorial"; hallId: string; memorialId: string }
  | { type: "openOffer" }
  | { type: "back" }
  | { type: "setQuery"; query: string }
  | { type: "setZone"; zone: GardenZone | null }
  | { type: "setView"; view: GardenView }
  | { type: "setDrawer"; drawer: GardenDrawer }
  | { type: "zoom"; scale: number }
  | { type: "pan"; x: number; y: number }
  | { type: "restoreCamera"; scale: number; offset: { x: number; y: number } };

// URL 白名单（序列化只产出这些键；解析只认这些键）
export const GARDEN_URL_PARAMS = ["view", "q", "zone", "hall", "memorial", "panel"] as const;

// 默认 2d（沿用旧墓园 2.5D 默认观感；星海缩放连续体由 Task 4 场景承载）
export const DEFAULT_GARDEN_VIEW: GardenView = "2d";
export const DEFAULT_GARDEN_CAMERA: GardenSeaCamera = { scale: 1, offset: { x: 0, y: 0 } };

// 缩放限幅（Task 4 场景消费）
const SCALE_MIN = 0.5;
const SCALE_MAX = 4;

// 搜索词合法化：与 garden page 初始 q 同规（trim + 截 40）
function sanitizeQuery(raw: string | null | undefined): string {
  return (raw || "").trim().slice(0, 40);
}

// 面板 → 抽屉档位的默认映射（列表收起 / 详情半开 / 供奉全开）
function drawerForPanel(panel: GardenPanel): GardenDrawer {
  if (panel === "offer") return "full";
  if (panel === "detail") return "half";
  return "collapsed";
}

export function initialGardenSeaState(): GardenSeaState {
  return {
    view: DEFAULT_GARDEN_VIEW,
    query: "",
    zone: null,
    drawer: "collapsed",
    panel: "list",
    selectedHallId: null,
    selectedMemorialId: null,
    scale: DEFAULT_GARDEN_CAMERA.scale,
    offset: { x: DEFAULT_GARDEN_CAMERA.offset.x, y: DEFAULT_GARDEN_CAMERA.offset.y },
  };
}

/**
 * URL → 状态：只认白名单参数；非法值回落默认；面板与选中项做一致性校验
 * （detail/offer 必须有选中馆；有馆无显式面板时默认详情；memorial 隶属于 hall）。
 * 镜头（scale/offset）不来自 URL —— 刷新不恢复像素坐标，由控制器从 sessionStorage 恢复。
 */
export function parseGardenUrl(searchParams: URLSearchParams): GardenSeaState {
  const state = initialGardenSeaState();
  const view = searchParams.get("view");
  if (view === "2d" || view === "3d") state.view = view;
  const zone = searchParams.get("zone");
  if (zone === "public" || zone === "family" || zone === "official") state.zone = zone;
  state.query = sanitizeQuery(searchParams.get("q"));
  const hall = searchParams.get("hall");
  const memorial = searchParams.get("memorial");
  if (hall) {
    state.selectedHallId = hall;
    state.selectedMemorialId = memorial || null;
  }
  const panel = searchParams.get("panel");
  if (panel === "list" || panel === "detail" || panel === "offer") {
    state.panel = panel;
    if ((panel === "detail" || panel === "offer") && !state.selectedHallId) state.panel = "list";
  } else if (state.selectedHallId) {
    state.panel = "detail";
  }
  state.drawer = drawerForPanel(state.panel);
  return state;
}

/**
 * 状态 → URL：按 view/q/zone/hall/memorial/panel 白名单顺序产出规范查询串，
 * 默认值省略（list 面板 / 默认视图 / 空查询 / 无选中），保持 URL 干净可分享。
 */
export function serializeGardenUrl(state: GardenSeaState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== DEFAULT_GARDEN_VIEW) params.set("view", state.view);
  if (state.query) params.set("q", state.query);
  if (state.zone) params.set("zone", state.zone);
  if (state.selectedHallId) {
    params.set("hall", state.selectedHallId);
    if (state.selectedMemorialId) params.set("memorial", state.selectedMemorialId);
  }
  if (state.panel !== "list") params.set("panel", state.panel);
  return params;
}

export function gardenSeaReducer(state: GardenSeaState, action: GardenSeaAction): GardenSeaState {
  switch (action.type) {
    case "selectHall":
      // 重复点同一馆不重置抽屉档位
      if (action.hallId === state.selectedHallId && state.panel === "detail") return state;
      return {
        ...state,
        selectedHallId: action.hallId,
        selectedMemorialId: null,
        panel: "detail",
        drawer: "half",
      };
    case "selectMemorial":
      return {
        ...state,
        selectedHallId: action.hallId,
        selectedMemorialId: action.memorialId,
        panel: "detail",
        drawer: "half",
      };
    case "openOffer":
      return { ...state, panel: "offer", drawer: "full" };
    case "back":
      // 返回链：供奉 → 详情 → 列表（列表态返回为无操作）
      if (state.panel === "offer") return { ...state, panel: "detail", drawer: "half" };
      if (state.panel === "detail") {
        return {
          ...state,
          panel: "list",
          drawer: "collapsed",
          selectedHallId: null,
          selectedMemorialId: null,
        };
      }
      return state;
    case "setQuery":
      return { ...state, query: sanitizeQuery(action.query) };
    case "setZone":
      return { ...state, zone: action.zone };
    case "setView":
      return { ...state, view: action.view };
    case "setDrawer":
      return { ...state, drawer: action.drawer };
    case "zoom": {
      if (!Number.isFinite(action.scale)) return state;
      const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, action.scale));
      return { ...state, scale };
    }
    case "pan":
      if (!Number.isFinite(action.x) || !Number.isFinite(action.y)) return state;
      return { ...state, offset: { x: action.x, y: action.y } };
    case "restoreCamera":
      if (!Number.isFinite(action.scale) || !Number.isFinite(action.offset.x) || !Number.isFinite(action.offset.y)) {
        return state;
      }
      return { ...state, scale: action.scale, offset: { x: action.offset.x, y: action.offset.y } };
    default:
      return state;
  }
}

/** 镜头存储键：按 lang 区分（中英文用户各自的上次镜头互不覆盖） */
export function gardenCameraStorageKey(lang: string): string {
  return `starsea:camera:${lang}`;
}

// storage 解析：浏览器取 window.sessionStorage；无 DOM 环境（Node 直载单测）回落
// globalThis.sessionStorage（便于测试注入），均不可用时视为无存储
function resolveSessionStorage(): Storage | null {
  try {
    const scope: typeof globalThis = typeof window !== "undefined" ? window : globalThis;
    const storage = (scope as { sessionStorage?: Storage }).sessionStorage;
    return typeof storage === "undefined" ? null : storage;
  } catch {
    return null;
  }
}

function defaultCamera(): GardenSeaCamera {
  return {
    scale: DEFAULT_GARDEN_CAMERA.scale,
    offset: { x: DEFAULT_GARDEN_CAMERA.offset.x, y: DEFAULT_GARDEN_CAMERA.offset.y },
  };
}

export function saveGardenCamera(key: string, camera: GardenSeaCamera): void {
  const storage = resolveSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(camera));
  } catch {
    // 隐私模式/配额异常：镜头不持久化，静默降级
  }
}

export function loadGardenCamera(key: string): GardenSeaCamera {
  const storage = resolveSessionStorage();
  if (!storage) return defaultCamera();
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return defaultCamera();
  }
  if (!raw) return defaultCamera();
  try {
    const parsed = JSON.parse(raw) as Partial<GardenSeaCamera> | null;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.scale === "number" && Number.isFinite(parsed.scale) &&
      parsed.offset &&
      typeof parsed.offset.x === "number" && Number.isFinite(parsed.offset.x) &&
      typeof parsed.offset.y === "number" && Number.isFinite(parsed.offset.y)
    ) {
      return { scale: parsed.scale, offset: { x: parsed.offset.x, y: parsed.offset.y } };
    }
  } catch {
    // JSON 解析失败 → 默认镜头
  }
  return defaultCamera();
}
