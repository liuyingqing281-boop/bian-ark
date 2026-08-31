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

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { GardenSeaAction, GardenSeaState } from "../../lib/garden-sea-state";
import { stableHallOrder } from "../../lib/garden-sea";
import type { GardenSeaHall, GardenZone } from "../../lib/garden-sea";
import StarSeaScene from "./StarSeaScene";
import StarSeaControls from "./StarSeaControls";
import StarSeaDrawer from "./StarSeaDrawer";
import type { HallMember, OfferItemOption, OfferStatus } from "./StarSeaDrawer";

interface GardenSeaProps {
  lang: string;
  /** 服务端合法化后的初始搜索词（trim + 截 40），SSR 兜底用；客户端以 URL 为准 */
  initialQuery: string;
}

type Bbox = [number, number, number, number];

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

  const cameraKey = gardenCameraStorageKey(lang);

  function send(action: GardenSeaAction) {
    if (PUSH_ACTIONS.has(action.type)) pushIntentRef.current = true;
    setState((prev) => gardenSeaReducer(prev, action));
  }

  // ---- 挂载：URL 水合 + popstate 监听 ----
  useEffect(() => {
    setState(parseGardenUrl(new URLSearchParams(window.location.search)));
    setUrlReady(true);
    function onPopState() {
      const next = parseGardenUrl(new URLSearchParams(window.location.search));
      skipUrlWriteRef.current = true;
      setState((prev) => ({ ...next, scale: prev.scale, offset: prev.offset }));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ---- URL 同步：状态 → 规范查询串；push 意图决定 pushState/replaceState ----
  useEffect(() => {
    if (!urlReady) return;
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }
    const search = serializeGardenUrl(state).toString();
    const current = window.location.search.replace(/^\?/, "");
    if (search === current) return;
    const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
    if (pushIntentRef.current) {
      window.history.pushState(window.history.state, "", url);
      pushIntentRef.current = false;
    } else {
      window.history.replaceState(window.history.state, "", url);
    }
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
    focusThen(hallId, () => send({ type: "selectHall", hallId }));
  }

  function handleEnterHall(hallId: string) {
    focusThen(hallId, () => router.push(`/${lang}/hall/${hallId}`));
  }

  function handleResetCamera() {
    // 复位只改镜头，不清浏览状态（墓园规格 §5）
    setState((prev) =>
      gardenSeaReducer(gardenSeaReducer(prev, { type: "zoom", scale: 1 }), { type: "pan", x: 0, y: 0 })
    );
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
          send({ type: "back" });
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

  function handleOpenOffer() {
    setOfferStatus("idle");
    setOfferNotice("");
    send({ type: "openOffer" });
  }

  // ---- 搜索匹配（只影响降亮与抽屉轨道，不改坐标/节点） ----
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

  return (
    <>
      <StarSeaScene
        halls={halls}
        state={state}
        matchedHallIds={matchedHallIds}
        focusedHallId={focusedHallId}
        loading={loading}
        error={error}
        labels={labels}
        onRetry={retryLoad}
        onSelectHall={handleSelectHall}
        onEnterHall={handleEnterHall}
        onCameraChange={(camera) =>
          setState((prev) =>
            gardenSeaReducer(gardenSeaReducer(prev, { type: "zoom", scale: camera.scale }), {
              type: "pan",
              x: camera.x,
              y: camera.y,
            })
          )
        }
      />
      <StarSeaControls
        state={state}
        totalHalls={halls.length}
        matchedCount={matchedCount}
        labels={labels}
        onQueryChange={(query) => send({ type: "setQuery", query })}
        onZoneChange={(zone) => send({ type: "setZone", zone: zone || null })}
        onViewChange={(view) => send({ type: "setView", view })}
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
