"use client";

// 星海客户端控制器（Task 4 正式实现）：
// - 状态机沿用 Task 3（lib/garden-sea-state）：useState + gardenSeaReducer，
//   需要整树替换（popstate 水合）时直接 setState，不改冻结模块。
// - 数据：GET /api/garden/starsea 分片；首屏 bbox=0,0,1,1，镜头变化按可视区
//   扩 10% 增量拉取（去重合并 + 稳定排序）；AbortController + 序号守卫，
//   旧响应绝不覆盖新镜头；错误进入可重试态，场景仍可操作。
// - URL：白名单参数（view/q/zone/hall/memorial/panel）；选中/供奉/搜索/筛选
//   走 pushState（浏览器返回按层级回退），其余 replaceState；popstate 回灌状态。
// - 聚焦时序：点星群 → 400–700ms 可见聚焦（reduced-motion 100ms）→ 打开详情；
//   双击/Enter 同样先聚焦再进馆。
// - 供奉：POST /api/tribute 按 response.status 分流（ok/401/其他），
//   成功 1000ms 反馈后回详情；失败/未登录绝不清空输入与选中。
// - 镜头（scale/offset）只进 sessionStorage（按 lang），URL 永不承载像素坐标。
// - 园→馆→园（Task 5）：浏览状态持续落 sessionStorage 快照（gardenSnapshotStorageKey
//   按 lang 区分，TTL 10min）；进馆附 from=garden（仅状态恢复语义），馆页返回 /garden
//   时无显式 URL 参数则恢复快照，快照无效/过期回默认星海。
// - 择位模式（Task 6，墓园规格 §8.3 馆主亲手择位）：挂载时读取一次 placing
//   参数显式激活（「我的」页择位入口专用，URL 白名单不含 placing，激活即剥离）；
//   拖拽草稿 → 松开 PATCH /api/halls/[id]/garden-pos；200 更新本地坐标 + toast；
//   409 建议位可一键确认吸附；403 公开权限/无权提示；网络错误弹回原位可重试；
//   发送中锁定星群但 Esc 仍可退出（序号守卫丢弃迟到响应）。访客永远看不到
//   择位 UI（激活仅靠显式 placing 参数，写入鉴权在服务端）。

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_GARDEN_CAMERA,
  GARDEN_URL_PARAMS,
  gardenCameraStorageKey,
  gardenSeaReducer,
  initialGardenSeaState,
  loadGardenCamera,
  parseGardenUrl,
  saveGardenCamera,
  serializeGardenUrl,
} from "../../lib/garden-sea-state";
import type { GardenSeaAction, GardenSeaCamera, GardenSeaState } from "../../lib/garden-sea-state";
import { roundPlacementPoint, stableHallOrder } from "../../lib/garden-sea";
import type { GardenSeaHall, GardenZone, PlacementState } from "../../lib/garden-sea";
import StarSeaScene from "./StarSeaScene";
import StarSea3D, { StarSeaDomOverlay } from "./StarSea3D";
import StarSeaControls from "./StarSeaControls";
import StarSeaDrawer from "./StarSeaDrawer";
import type { HallMember, OfferItemOption, OfferStatus } from "./StarSeaDrawer";

interface GardenSeaProps {
  lang: string;
  /** 服务端合法化后的初始搜索词（trim + 截 40），SSR 兜底用；客户端以 URL 为准 */
  initialQuery: string;
}

type Bbox = [number, number, number, number];

// 择位写入状态机：idle 拖拽中 / sending 锁定 / conflict 409 建议位 /
// visibility·forbidden 403 两类 / error 网络或其他失败（弹回原位可重试）
type PlacementPhase = "idle" | "sending" | "conflict" | "visibility" | "forbidden" | "error";

const ZH_LABELS = {
  scene: "星海",
  loading: "星海加载中",
  empty: "这片星域还很安静",
  errorTitle: "星海暂时无法加载",
  retry: "重试",
  membersUnit: "位亲人",
  back: "返回",
  search: "搜索星海",
  searchPlaceholder: "搜索馆名或墓志铭",
  clearSearch: "清除搜索",
  resultCount: (n: number) => `找到 ${n} 座馆`,
  zoneFilterLabel: "星域",
  zoneAll: "全部星域",
  zonePublic: "普通星域",
  zoneFamily: "家族星域",
  zoneOfficial: "名人星域",
  view2d: "2.5D",
  view3d: "3D",
  viewSegmentLabel: "视图切换",
  reset: "复位镜头",
  drawerLabel: "星海抽屉",
  handleExpand: "收起抽屉",
  listTitle: "星海馆列表",
  hallCount: (n: number) => `${n} 座纪念馆`,
  detailLoading: "正在找到这颗星…",
  detailCount: (n: number) => `${n} 位亲人`,
  enterHall: "进馆",
  offerCta: "供奉",
  offerTitle: "供奉",
  offerMemberLabel: "供奉对象",
  offerItemLabel: "祭品",
  offerMessageLabel: "留言（可选）",
  offerMessagePlaceholder: "想说的话…",
  offerSubmit: "送上心意",
  offerSubmitting: "提交中…",
  offerSuccess: "供奉已送达",
  offerRequiresLogin: "请先登录后再供奉",
  offerFailedPrefix: "供奉失败：",
  offerRetryLater: "，请稍后再试",
  membersLoading: "正在唤起馆内亲人…",
  membersError: "馆内信息暂时无法加载",
  membersRetry: "重试",
  loginLink: "去登录",
  epitaphEmpty: "此处安息，静待思念",
  placementHint: "择位模式：拖动你的星群到心仪位置，松开保存",
  placementSending: "正在保存位置…",
  placementConflict: "这里太靠近其他纪念馆",
  placementSuggest: "使用建议位置",
  placementDismiss: "重新拖拽",
  placementVisibility: "入星海需先将纪念馆设为公开（「我的」页可修改可见性）",
  placementForbidden: "只有馆主可以调整这个位置",
  placementError: "位置保存失败，请重试或重新拖拽",
  placementRetry: "重试",
  placementExit: "退出择位",
  placementUpdated: "位置已更新",
  viewFallback: "当前环境暂不支持 3D 渲染，已切换到 2.5D 视图",
  candidatesTitle: "请选择星群",
};

const EN_LABELS = {
  ...ZH_LABELS,
  scene: "Star sea",
  loading: "Loading the star sea",
  empty: "This region of the sea is quiet",
  errorTitle: "The star sea failed to load",
  retry: "Retry",
  membersUnit: "family members",
  back: "Back",
  search: "Search the star sea",
  searchPlaceholder: "Search halls or epitaphs",
  clearSearch: "Clear search",
  resultCount: (n: number) => `${n} halls found`,
  zoneFilterLabel: "Zone",
  zoneAll: "All zones",
  zonePublic: "Public zone",
  zoneFamily: "Family zone",
  zoneOfficial: "Official zone",
  view2d: "2.5D",
  view3d: "3D",
  viewSegmentLabel: "View switch",
  reset: "Reset camera",
  drawerLabel: "Star sea drawer",
  handleExpand: "Collapse drawer",
  listTitle: "Hall list",
  hallCount: (n: number) => `${n} memorial halls`,
  detailLoading: "Finding this star…",
  detailCount: (n: number) => `${n} family members`,
  enterHall: "Enter hall",
  offerCta: "Offer",
  offerTitle: "Offer a tribute",
  offerMemberLabel: "Recipient",
  offerItemLabel: "Tribute item",
  offerMessageLabel: "Message (optional)",
  offerMessagePlaceholder: "Something you want to say…",
  offerSubmit: "Send",
  offerSubmitting: "Sending…",
  offerSuccess: "Tribute delivered",
  offerRequiresLogin: "Please sign in first",
  offerFailedPrefix: "Tribute failed: ",
  offerRetryLater: ", please try again later",
  membersLoading: "Waking the family…",
  membersError: "Hall members failed to load",
  membersRetry: "Retry",
  loginLink: "Sign in",
  epitaphEmpty: "Resting here, awaiting remembrance",
  placementHint: "Placement mode: drag your star cluster to a spot you like and release to save",
  placementSending: "Saving position…",
  placementConflict: "Too close to another memorial hall",
  placementSuggest: "Use suggested spot",
  placementDismiss: "Drag again",
  placementVisibility: "Set the hall to public first (visibility can be changed on the profile page)",
  placementForbidden: "Only the hall owner can place this hall",
  placementError: "Failed to save the position; retry or drag again",
  placementRetry: "Retry",
  placementExit: "Exit placement",
  placementUpdated: "Position updated",
  viewFallback: "3D rendering is unavailable here; switched to the 2.5D view",
  candidatesTitle: "Choose a star cluster",
};

const ZH_ITEM_NAMES: Record<string, string> = {
  flower_white: "白菊",
  candle: "蜡烛",
  incense: "香火",
  fruit: "水果",
};
const EN_ITEM_NAMES: Record<string, string> = {
  flower_white: "Chrysanthemum",
  candle: "Candle",
  incense: "Incense",
  fruit: "Fruit",
};
const OFFER_ITEMS: Array<OfferItemOption> = [
  { id: "flower_white", icon: "🌸" },
  { id: "candle", icon: "🕯️" },
  { id: "incense", icon: "🪔" },
  { id: "fruit", icon: "🍎" },
];

// 产生历史条目的动作（浏览器返回按 供奉→详情→列表→搜索/筛选 层级回退）
const PUSH_ACTIONS = new Set<GardenSeaAction["type"]>([
  "selectHall",
  "selectMemorial",
  "openOffer",
  "setQuery",
  "setZone",
]);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// 镜头 → 可视归一化区域
function visibleBbox(scale: number, offset: { x: number; y: number }, vw: number, vh: number): Bbox {
  const w = vw * scale;
  const h = vh * scale;
  return [
    clamp01((0 - offset.x) / w),
    clamp01((0 - offset.y) / h),
    clamp01((vw - offset.x) / w),
    clamp01((vh - offset.y) / h),
  ];
}

function expandBbox(bbox: Bbox, ratio: number): Bbox {
  const dx = Math.max(bbox[2] - bbox[0], 0.05) * ratio;
  const dy = Math.max(bbox[3] - bbox[1], 0.05) * ratio;
  return [clamp01(bbox[0] - dx), clamp01(bbox[1] - dy), clamp01(bbox[2] + dx), clamp01(bbox[3] + dy)];
}

function unionBbox(a: Bbox | null, b: Bbox): Bbox {
  if (!a) return b;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

function bboxContains(loaded: Bbox | null, needed: Bbox): boolean {
  if (!loaded) return false;
  const eps = 1e-6;
  return (
    loaded[0] <= needed[0] + eps &&
    loaded[1] <= needed[1] + eps &&
    loaded[2] >= needed[2] - eps &&
    loaded[3] >= needed[3] - eps
  );
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string } | null;
    if (data && typeof data.error === "string" && data.error) return data.error;
  } catch {
    // 非 JSON 错误体
  }
  return `http_${response.status}`;
}

// ---- 园 → 馆 → 园 浏览状态快照（Task 5，墓园规格 §8.2 / 13 号方案 §11.2） ----
// 进馆前把 query/zone/selectedHallId/drawer/panel/scale/offset 存 sessionStorage；
// 馆页「返回星海」回到 /garden 时恢复。存储约定沿用 Task 3 镜头键风格：
// JSON 解析失败 / 结构非法 / 超时（10 分钟）一律回落默认星海。
// 快照随浏览持续刷新（不一次性消费）：React dev StrictMode 会双重调用挂载效应，
// 读取即删会让第二次调用读到空、把恢复态打回默认；TTL 负责过期。
// 键按 lang 区分（Task 6 修 Task 5 评审小项）：中英文会话各自恢复各自的
// 浏览态，zh 的快照不泄漏到 /en/garden（同 gardenCameraStorageKey 规则）。
function gardenSnapshotStorageKey(lang: string): string {
  return `starsea:snapshot:${lang}`;
}
const GARDEN_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

interface GardenSnapshot {
  savedAt: number;
  /** serializeGardenUrl 产出的白名单查询串（view/q/zone/hall/memorial/panel） */
  params: string;
  scale: number;
  offset: { x: number; y: number };
}

function saveGardenSnapshot(key: string, params: string, camera: GardenSeaCamera): void {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), params, scale: camera.scale, offset: camera.offset })
    );
  } catch {
    // 隐私模式/配额异常：快照不持久化，静默降级
  }
}

// 无效/过期返回 null → 调用方回落默认星海（快照留在存储中不影响，下次保存即覆盖）
function readGardenSnapshot(key: string): GardenSnapshot | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GardenSnapshot> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt) ||
      typeof parsed.params !== "string" ||
      typeof parsed.scale !== "number" ||
      !Number.isFinite(parsed.scale) ||
      !parsed.offset ||
      typeof parsed.offset.x !== "number" ||
      !Number.isFinite(parsed.offset.x) ||
      typeof parsed.offset.y !== "number" ||
      !Number.isFinite(parsed.offset.y)
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > GARDEN_SNAPSHOT_TTL_MS) return null;
    return {
      savedAt: parsed.savedAt,
      params: parsed.params,
      scale: parsed.scale,
      offset: { x: parsed.offset.x, y: parsed.offset.y },
    };
  } catch {
    return null;
  }
}

export default function GardenSea({ lang, initialQuery }: GardenSeaProps) {
  const router = useRouter();
  const labels = lang === "en" ? EN_LABELS : ZH_LABELS;
  const itemNames = lang === "en" ? EN_ITEM_NAMES : ZH_ITEM_NAMES;

  // 服务端与客户端首帧一致（防注水错配）；URL 水合在挂载后进行
  const [state, setState] = useState<GardenSeaState>(() => ({ ...initialGardenSeaState(), query: initialQuery }));
  const [urlReady, setUrlReady] = useState(false);
  const pushIntentRef = useRef(false);
  const skipUrlWriteRef = useRef(false);

  // 数据分片状态
  const [halls, setHalls] = useState<Array<GardenSeaHall>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hallsRef = useRef(new Map<string, GardenSeaHall>());
  const loadedBboxRef = useRef<Bbox | null>(null);
  const loadedZoneRef = useRef("");
  const fetchSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // 聚焦时序（400–700ms；reduced-motion 100ms）
  const [focusMs] = useState(() =>
    typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 100
      : 500
  );
  const [focusedHallId, setFocusedHallId] = useState<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 供奉成员与供奉提交状态
  const [members, setMembers] = useState<Array<HallMember> | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const membersHallRef = useRef<string | null>(null);
  const [membersRetry, setMembersRetry] = useState(0);
  const [offerStatus, setOfferStatus] = useState<OfferStatus>("idle");
  const [offerNotice, setOfferNotice] = useState("");
  const offerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 择位模式（Task 6，墓园规格 §8.3）----
  const [placement, setPlacement] = useState<PlacementState>({ active: false });
  const [placementDraft, setPlacementDraft] = useState<{ x: number; y: number } | null>(null);
  const [placementPhase, setPlacementPhase] = useState<PlacementPhase>("idle");
  const [placementSuggested, setPlacementSuggested] = useState<{ x: number; y: number } | null>(null);
  const [placementLastPoint, setPlacementLastPoint] = useState<{ x: number; y: number } | null>(null);
  const placementSeqRef = useRef(0);

  // 择位成功 toast（≤1.2s 仪式反馈区间）
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 3D 渐进增强（Task 7）----
  // fallback2d：WebGL/three 失败只回退视图（state.view 整树 setState，不改冻结状态机）
  // 并以 role=status 播报；抽屉/控制条/其余浏览状态原样保留。用户主动切换视图即清除提示。
  const [fallback3dNotice, setFallback3dNotice] = useState(false);

  const cameraKey = gardenCameraStorageKey(lang);

  function send(action: GardenSeaAction) {
    if (PUSH_ACTIONS.has(action.type)) pushIntentRef.current = true;
    setState((prev) => gardenSeaReducer(prev, action));
  }

  // ---- 挂载：URL 水合 + 未决快照恢复 + popstate 监听 ----
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const explicit = GARDEN_URL_PARAMS.some((key) => urlParams.has(key));
    let next = parseGardenUrl(urlParams);
    if (!explicit) {
      // 无显式状态（含从馆页「返回星海」）：恢复进馆前的浏览状态；
      // 显式深链（分享链接等）优先 URL；快照无效/过期/JSON 损坏时
      // parseGardenUrl 已给出默认星海
      const snapshot = readGardenSnapshot(gardenSnapshotStorageKey(lang));
      if (snapshot) {
        const restored = parseGardenUrl(new URLSearchParams(snapshot.params));
        next = { ...restored, scale: snapshot.scale, offset: { x: snapshot.offset.x, y: snapshot.offset.y } };
      }
    }
    // Task 6：读取一次 placing 参数（「我的」页择位入口显式激活，仅馆主入口生成）。
    // 激活即消费：URL 白名单不含 placing，下一次 URL 同步即剥离（刷新即退出择位）。
    // 择位为专注任务态，进入时重置快照恢复的全部浏览过滤：
    // - 选中/面板（详情/供奉）让位给任务态；
    // - zone 必须重置——public 星域目标馆会被残留的 family 过滤整个吞掉
    //   （fetchStarsea 按 zone 分片，横幅在、星群永不出，Fix Round 1 Important）；
    // - q 只降亮不吞节点（无害），但择位态保留搜索词徒增视觉噪声，一并清空。
    const placingHallId = urlParams.get("placing");
    if (placingHallId) {
      next = {
        ...next,
        panel: "list",
        drawer: "collapsed",
        selectedHallId: null,
        selectedMemorialId: null,
        zone: null,
        query: "",
        // Task 7：择位拖拽是 2D DOM 交互，任务态锁定 2.5D（即使深链/快照带 view=3d）
        view: "2d",
      };
      setPlacement({ hallId: placingHallId, active: true });
    }
    setState(next);
    setUrlReady(true);
    function onPopState() {
      const pop = parseGardenUrl(new URLSearchParams(window.location.search));
      skipUrlWriteRef.current = true;
      setState((prev) => ({ ...pop, scale: prev.scale, offset: prev.offset }));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- URL 同步：状态 → 规范查询串；push 意图决定 pushState/replaceState ----
  useEffect(() => {
    if (!urlReady) return;
    const search = serializeGardenUrl(state).toString();
    // 浏览状态持续落快照：星群双击 / 抽屉「进馆」锚点 / Enter 进馆
    // （任意离馆导航）都能在返回时恢复，不依赖特定入口先存快照
    saveGardenSnapshot(gardenSnapshotStorageKey(lang), search, { scale: state.scale, offset: state.offset });
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }
    const current = window.location.search.replace(/^\?/, "");
    if (search === current) return;
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    if (pushIntentRef.current) {
      window.history.pushState(window.history.state, "", url);
      pushIntentRef.current = false;
    } else {
      window.history.replaceState(window.history.state, "", url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, urlReady]);

  // ---- 镜头持久化（sessionStorage，按 lang；跳过首帧） ----
  const cameraPristine = useRef(true);
  useEffect(() => {
    if (cameraPristine.current) {
      cameraPristine.current = false;
      return;
    }
    saveGardenCamera(cameraKey, { scale: state.scale, offset: state.offset });
  }, [cameraKey, state.scale, state.offset.x, state.offset.y]);

  // 挂载后恢复本语言上次镜头
  useEffect(() => {
    const camera = loadGardenCamera(cameraKey);
    if (
      camera.scale !== DEFAULT_GARDEN_CAMERA.scale ||
      camera.offset.x !== DEFAULT_GARDEN_CAMERA.offset.x ||
      camera.offset.y !== DEFAULT_GARDEN_CAMERA.offset.y
    ) {
      setState((prev) => gardenSeaReducer(prev, { type: "restoreCamera", scale: camera.scale, offset: camera.offset }));
    }
  }, [cameraKey]);

  // ---- 数据分片：/api/garden/starsea（AbortController + 序号守卫 + 翻页） ----
  async function fetchStarsea(bbox: Bbox, zone: GardenZone | null) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    const zoneKey = zone || "all";
    const freshZone = loadedZoneRef.current !== zoneKey;
    if (freshZone) {
      hallsRef.current = new Map();
      loadedZoneRef.current = zoneKey;
    }
    try {
      let cursor: string | null = null;
      let pages = 0;
      do {
        const params = new URLSearchParams({ bbox: bbox.map((v) => v.toFixed(4)).join(",") });
        if (zone) params.set("zone", zone);
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/garden/starsea?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`starsea_http_${response.status}`);
        const body = (await response.json()) as { halls: Array<GardenSeaHall>; nextCursor: string | null };
        if (seq !== fetchSeqRef.current || controller.signal.aborted) return;
        for (const hall of body.halls || []) hallsRef.current.set(hall.hallId, hall);
        cursor = body.nextCursor;
        pages += 1;
      } while (cursor && pages < 3);
      if (seq !== fetchSeqRef.current || controller.signal.aborted) return;
      loadedBboxRef.current = unionBbox(freshZone ? null : loadedBboxRef.current, bbox);
      setHalls(stableHallOrder([...hallsRef.current.values()]));
    } catch (err) {
      if (controller.signal.aborted || seq !== fetchSeqRef.current) return;
      setError(err instanceof Error ? err.message : "starsea_failed");
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }

  // 首次/星域切换：全量分片 0,0,1,1
  useEffect(() => {
    const zoneKey = state.zone || "all";
    if (loadedZoneRef.current === zoneKey && loadedBboxRef.current) return;
    void fetchStarsea([0, 0, 1, 1], state.zone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.zone]);

  // 镜头变化：防抖 300ms 后按可视区域（扩 10%）增量拉取
  useEffect(() => {
    const timer = setTimeout(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (vw <= 0 || vh <= 0) return;
      const needed = visibleBbox(state.scale, state.offset, vw, vh);
      if (bboxContains(loadedBboxRef.current, needed)) return;
      void fetchStarsea(expandBbox(needed, 0.1), state.zone);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scale, state.offset.x, state.offset.y, state.zone]);

  // 卸载清理：终止在途请求与定时器
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function retryLoad() {
    loadedBboxRef.current = null;
    void fetchStarsea([0, 0, 1, 1], state.zone);
  }

  // ---- 聚焦时序：先可见聚焦，再执行选中/进馆 ----
  function focusThen(hallId: string, action: () => void) {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    setFocusedHallId(hallId);
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      setFocusedHallId(null);
      action();
    }, focusMs);
  }

  function handleSelectHall(hallId: string) {
    if (placement.active) return; // 择位任务态：点击不进入详情（含被择位星群自身的误触 click）
    focusThen(hallId, () => send({ type: "selectHall", hallId }));
  }

  function handleEnterHall(hallId: string) {
    if (placement.active) return; // 择位任务态：双击/Enter 不进馆
    focusThen(hallId, () => {
      // 进馆前再兜底落一次快照（聚焦动画期间状态未变时 URL 同步效应已存）；
      // from=garden 只用于返回状态恢复语义，绝不参与权限判断
      saveGardenSnapshot(gardenSnapshotStorageKey(lang), serializeGardenUrl(state).toString(), {
        scale: state.scale,
        offset: state.offset,
      });
      router.push(`/${lang}/hall/${encodeURIComponent(hallId)}?from=garden`);
    });
  }

  function handleResetCamera() {
    // 复位只改镜头，不清浏览状态（墓园规格 §5）
    setState((prev) =>
      gardenSeaReducer(gardenSeaReducer(prev, { type: "zoom", scale: 1 }), { type: "pan", x: 0, y: 0 })
    );
  }

  // 2.5D 场景与 3D 层共用同一镜头回流（zoom+pan 归一到共享状态，双向保留快照）
  function handleSceneCameraChange(camera: { scale: number; x: number; y: number }) {
    setState((prev) =>
      gardenSeaReducer(
        gardenSeaReducer(prev, { type: "zoom", scale: camera.scale }),
        { type: "pan", x: camera.x, y: camera.y }
      )
    );
  }

  // 3D 致命错误（WebGL 不可用 / three 加载失败 / 上下文丢失）：回退 2.5D + 播报。
  // 只改 view（scene renderer 归属），抽屉/控制条/选中/搜索/星域全部不动。
  function handle3dFatalError() {
    setFallback3dNotice(true);
    setState((prev) => (prev.view === "3d" ? { ...prev, view: "2d" } : prev));
  }

  function handleViewChange(view: "2d" | "3d") {
    // 择位任务态锁定 2.5D（择位拖拽是 2D DOM 交互，Task 7 裁定）
    if (placement.active && view === "3d") return;
    setFallback3dNotice(false);
    send({ type: "setView", view });
  }

  // ---- 供奉成员（GET /api/halls/[id]） ----
  useEffect(() => {
    if (state.panel !== "offer" || !state.selectedHallId) return;
    if (membersHallRef.current === state.selectedHallId) return;
    const hallId = state.selectedHallId;
    membersHallRef.current = hallId;
    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);
    setMembers(null);
    fetch(`/api/halls/${encodeURIComponent(hallId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`hall_http_${response.status}`);
        const body = (await response.json()) as { members?: Array<{ id: string; name: string }> };
        if (cancelled) return;
        setMembers((body.members || []).map((m) => ({ id: m.id, name: m.name })));
      })
      .catch(() => {
        if (!cancelled) setMembersError("hall_members_failed");
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.panel, state.selectedHallId, membersRetry]);

  function retryMembers() {
    membersHallRef.current = null;
    setMembersRetry((n) => n + 1);
  }

  // ---- 供奉提交：按 response.status 分流（Task 4 契约） ----
  async function submitOffer(payload: { memorialId: string; itemId: string; message: string }) {
    setOfferStatus("pending");
    setOfferNotice("");
    try {
      const response = await fetch("/api/tribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setOfferStatus("success");
        if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
        offerTimerRef.current = setTimeout(() => {
          offerTimerRef.current = null;
          // 迟到守卫：pending 中 Esc 已离开供奉面板时，成功反馈不得再把详情回退成列表
          setState((prev) => (prev.panel === "offer" ? gardenSeaReducer(prev, { type: "back" }) : prev));
        }, 1000); // 800–1200ms 仪式反馈
      } else if (response.status === 401) {
        setOfferStatus("requiresLogin");
      } else {
        setOfferStatus("failed");
        setOfferNotice(await readApiError(response));
      }
    } catch {
      setOfferStatus("failed");
      setOfferNotice("network_error");
    }
  }

  // 离开供奉面板且已成功 → 状态机复位（失败态保留到下次打开时重置）
  useEffect(() => {
    if (state.panel !== "offer" && offerStatus === "success") {
      const timer = setTimeout(() => {
        setOfferStatus("idle");
        setOfferNotice("");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [state.panel, offerStatus]);

  // 面板离开供奉（含 pending 中 Esc）即取消在途的成功反馈定时器：
  // 迟到的成功只允许更新文案状态，绝不允许再触发面板回退
  useEffect(() => {
    if (state.panel !== "offer" && offerTimerRef.current) {
      clearTimeout(offerTimerRef.current);
      offerTimerRef.current = null;
    }
  }, [state.panel]);

  function handleOpenOffer() {
    setOfferStatus("idle");
    setOfferNotice("");
    send({ type: "openOffer" });
  }

  // ---- 择位提交与状态（Task 6）----
  function exitPlacement() {
    placementSeqRef.current += 1; // 在途响应作废（含发送中 Esc 后迟到的成功）
    setPlacement({ active: false });
    setPlacementDraft(null);
    setPlacementPhase("idle");
    setPlacementSuggested(null);
    setPlacementLastPoint(null);
  }

  function applyHallPosition(hallId: string, point: { x: number; y: number }) {
    const hall = hallsRef.current.get(hallId);
    if (!hall) return;
    hallsRef.current.set(hallId, { ...hall, x: point.x, y: point.y });
    setHalls(stableHallOrder([...hallsRef.current.values()]));
  }

  function showToast(text: string) {
    setToast(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToast("");
    }, 1800);
  }

  function handlePlacementDrag(point: { x: number; y: number }) {
    setPlacementDraft(point);
  }

  function handlePlacementDrop(point: { x: number; y: number }) {
    setPlacementDraft(point);
    setPlacementLastPoint(point);
    void commitPlacement(point);
  }

  function confirmSuggested() {
    if (!placementSuggested) return;
    setPlacementDraft(placementSuggested); // 先视觉吸附建议位，再以建议位提交
    setPlacementLastPoint(placementSuggested);
    void commitPlacement(placementSuggested);
  }

  async function commitPlacement(point: { x: number; y: number }) {
    if (!placement.active) return;
    const hallId = placement.hallId;
    const seq = ++placementSeqRef.current;
    setPlacementPhase("sending");
    try {
      const response = await fetch(`/api/halls/${encodeURIComponent(hallId)}/garden-pos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(point),
      });
      if (seq !== placementSeqRef.current) return; // Esc 退出后迟到的响应直接丢弃
      if (response.ok) {
        // 200：更新本地坐标（服务端回显为准）+ toast + 退出择位
        const body = (await response.json().catch(() => null)) as { x?: number; y?: number } | null;
        const final =
          body && typeof body.x === "number" && typeof body.y === "number" ? roundPlacementPoint(body.x, body.y) : point;
        applyHallPosition(hallId, final);
        exitPlacement();
        showToast(labels.placementUpdated);
      } else if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string; suggested?: { x: number; y: number } }
          | null;
        if (body?.error === "position_conflict" && body.suggested) {
          setPlacementSuggested(roundPlacementPoint(body.suggested.x, body.suggested.y));
          setPlacementPhase("conflict");
        } else {
          // no_space：整片星域无空位，重试同一坐标无意义 → 错误态提示换区域
          setPlacementDraft(null);
          setPlacementPhase("error");
        }
      } else if (response.status === 403) {
        const body = (await response.json().catch(() => null)) as { reason?: string } | null;
        setPlacementPhase(body?.reason === "visibility_required" ? "visibility" : "forbidden");
      } else {
        setPlacementDraft(null); // 弹回原位
        setPlacementPhase("error");
      }
    } catch {
      if (seq !== placementSeqRef.current) return;
      setPlacementDraft(null); // 网络错误：保持原位，支持重试（重发上次坐标）
      setPlacementPhase("error");
    }
  }

  // Esc 退出择位（含发送中）：document 捕获阶段先于抽屉的 bubble 监听，
  // 择位退出一次到位，不再连带触发面板层级回退
  useEffect(() => {
    if (!placement.active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      exitPlacement();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement]);

  // ---- 搜索匹配（只影响降亮与抽屉轨道，不改坐标/节点） ----
  // 搜索空间不变性（Task 6 §5）：只产出匹配集（is-dimmed / 抽屉轨道 / 选中候选），
  // 绝不改场景节点数组与位置。数据源无别名字段（GardenSeaHall 契约无 alias，
  // API 也不下发），只匹配馆名（nameMasked；单人馆即首位逝者名）与墓志铭，
  // 不伪造别名命中。
  const query = state.query.trim().toLowerCase();
  const matchedHallIds = useMemo(() => {
    if (!query) return null;
    const matched = new Set<string>();
    for (const hall of halls) {
      if (
        hall.nameMasked.toLowerCase().includes(query) ||
        hall.epitaph.toLowerCase().includes(query)
      ) {
        matched.add(hall.hallId);
      }
    }
    return matched;
  }, [halls, query]);

  const selectedHall = useMemo(
    () => halls.find((hall) => hall.hallId === state.selectedHallId) || null,
    [halls, state.selectedHallId]
  );
  const matchedCount = matchedHallIds ? matchedHallIds.size : halls.length;

  // 3D 渐进增强（Task 7）：view=3d 时渲染 StarSea3D（canvas + 独立 DOM overlay），
  // 其余情况（默认 2.5D / 择位任务态 / 3D 回退后）渲染 2.5D 场景。
  // .starsea-scene-2d 是 2.5D 场景的语义包裹层（降级/测试识别钩子）。
  const scene3d = state.view === "3d" && !placement.active;

  return (
    <>
      {scene3d ? (
        <StarSea3D
          halls={halls}
          camera={{ scale: state.scale, x: state.offset.x, y: state.offset.y }}
          onCameraChange={handleSceneCameraChange}
          onSelectHall={handleSelectHall}
          onEnterHall={handleEnterHall}
          matchedHallIds={matchedHallIds}
          focusedHallId={focusedHallId}
          inert={state.panel !== "list"}
          loading={loading}
          error={error}
          labels={labels}
          onRetry={retryLoad}
          overlay={<StarSeaDomOverlay halls={halls} />}
          onFatalError={handle3dFatalError}
        />
      ) : (
        <div className="starsea-scene-2d">
          <StarSeaScene
            halls={halls}
            state={state}
            matchedHallIds={matchedHallIds}
            focusedHallId={focusedHallId}
            placementHallId={placement.active ? placement.hallId : null}
            placementDraft={placement.active ? placementDraft : null}
            placementLocked={placementPhase === "sending"}
            loading={loading}
            error={error}
            labels={labels}
            onRetry={retryLoad}
            onSelectHall={handleSelectHall}
            onEnterHall={handleEnterHall}
            onPlacementDrag={handlePlacementDrag}
            onPlacementDrop={handlePlacementDrop}
            onCameraChange={handleSceneCameraChange}
          />
        </div>
      )}
      {fallback3dNotice && !scene3d && (
        <p className="starsea-fallback-notice" role="status">
          {labels.viewFallback}
        </p>
      )}
      {placement.active && (
        // 择位横幅（馆主专属；访客的 placement 永远 inactive，整块不渲染）。
        // 样式内联：globals.css 不在本任务改动清单内，token 归拢交后续任务。
        <div
          className="starsea-placement-bar"
          role="status"
          data-status={placementPhase}
          style={{
            position: "fixed",
            top: "calc(env(safe-area-inset-top, 0px) + 68px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 25,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px 12px",
            maxWidth: "min(92vw, 720px)",
            padding: "8px 14px",
            borderRadius: 12,
            border: "1px solid rgba(252, 211, 77, 0.35)",
            background: "rgba(10, 13, 26, 0.92)",
            backdropFilter: "blur(6px)",
            color: "#cdd5e5",
            fontSize: 13,
          }}
        >
          <p className="starsea-placement-hint" style={{ margin: 0, color: "#cdd5e5" }}>
            {labels.placementHint}
          </p>
          {placementPhase === "sending" && (
            <p style={{ margin: 0, color: "#8b94a8" }}>{labels.placementSending}</p>
          )}
          {placementPhase === "conflict" && (
            <div className="starsea-placement-conflict" role="alert" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#fcd34d" }}>{labels.placementConflict}</span>
              <button
                type="button"
                className="starsea-placement-suggest"
                onClick={confirmSuggested}
                style={{
                  border: "1px solid rgba(252, 211, 77, 0.9)",
                  background: "transparent",
                  color: "#fcd34d",
                  borderRadius: 8,
                  padding: "4px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {labels.placementSuggest}
              </button>
              <button
                type="button"
                className="starsea-placement-dismiss"
                onClick={() => setPlacementPhase("idle")}
                style={{
                  border: "1px solid rgba(205, 213, 229, 0.25)",
                  background: "transparent",
                  color: "#8b94a8",
                  borderRadius: 8,
                  padding: "4px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {labels.placementDismiss}
              </button>
            </div>
          )}
          {(placementPhase === "visibility" || placementPhase === "forbidden") && (
            <p role="alert" style={{ margin: 0, color: "#fcd34d" }}>
              {placementPhase === "visibility" ? labels.placementVisibility : labels.placementForbidden}
            </p>
          )}
          {placementPhase === "error" && (
            <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#fcd34d" }}>{labels.placementError}</span>
              <button
                type="button"
                className="starsea-placement-retry"
                disabled={!placementLastPoint}
                onClick={() => placementLastPoint && void commitPlacement(placementLastPoint)}
                style={{
                  border: "1px solid rgba(252, 211, 77, 0.9)",
                  background: "transparent",
                  color: "#fcd34d",
                  borderRadius: 8,
                  padding: "4px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {labels.placementRetry}
              </button>
            </div>
          )}
          <button
            type="button"
            className="starsea-placement-exit"
            onClick={exitPlacement}
            style={{
              border: "1px solid rgba(205, 213, 229, 0.25)",
              background: "transparent",
              color: "#8b94a8",
              borderRadius: 8,
              padding: "4px 12px",
              fontSize: 13,
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            {labels.placementExit}（Esc）
          </button>
        </div>
      )}
      {toast && (
        <div
          className="starsea-toast"
          role="status"
          style={{
            position: "fixed",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            padding: "10px 18px",
            borderRadius: 12,
            border: "1px solid rgba(252, 211, 77, 0.5)",
            background: "rgba(10, 13, 26, 0.94)",
            color: "#fcd34d",
            fontSize: 14,
            letterSpacing: "0.08em",
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
      <StarSeaControls
        state={state}
        totalHalls={halls.length}
        matchedCount={matchedCount}
        labels={labels}
        onQueryChange={(query) => send({ type: "setQuery", query })}
        onZoneChange={(zone) => send({ type: "setZone", zone: zone || null })}
        onViewChange={handleViewChange}
        onBack={() => send({ type: "back" })}
        onResetCamera={handleResetCamera}
      />
      <StarSeaDrawer
        lang={lang}
        state={state}
        halls={halls}
        selectedHall={selectedHall}
        matchedHallIds={matchedHallIds}
        members={members}
        membersLoading={membersLoading}
        membersError={membersError}
        offerStatus={offerStatus}
        offerNotice={offerNotice}
        offerItems={OFFER_ITEMS}
        itemLabel={(id) => itemNames[id] || id}
        labels={labels}
        onRetryMembers={retryMembers}
        onSelectHall={handleSelectHall}
        onOpenOffer={handleOpenOffer}
        onBack={() => send({ type: "back" })}
        onSubmitOffer={submitOffer}
      />
    </>
  );
}
