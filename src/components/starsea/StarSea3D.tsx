"use client";

// 星海 3D 渐进增强层（Task 7，墓园规格 §5）：
// - 职责边界：3D 只负责「渲染与镜头」——选馆/进馆/键盘导航/44px 热区/焦点环全部
//   走独立 DOM overlay（StarSeaDomOverlay，本文件导出）；overlay 按钮与 canvas
//   共享同一份 GardenSeaHall[] 与同一份镜头状态（GardenSeaState.scale/offset）。
// - 镜头同构：3D 相机是共享镜头（scale/offset + 视口）的纯函数（deriveCamera3D），
//   不持有自有状态 —— 2.5D/3D 双向切换保留同一镜头快照；canvas 上的拖拽/滚轮/
//   双指捏合与 2.5D 场景（StarSeaScene）同一套像素数学，经 onCameraChange 回流。
// - 渐进加载：three 只在本组件挂载后 await import("three")——2.5D 路径（默认视图）
//   永不支付 three 的包体；顶部 import type 仅类型引用，编译期擦除。
// - 降级：WebGL 探测失败 / three 导入失败 / WebGLRenderer 创建失败 /
//   webglcontextlost（preventDefault 后）→ onFatalError → 控制器 fallback2d：
//   只替换场景渲染器，抽屉与控制条不动。
// - 渲染节奏：按需渲染。镜头/数据/尺寸变化补一帧（reduced-motion 同步渲染，
//   否则单发 rAF）；页面隐藏取消待渲染帧、恢复可见补一帧；任何情况下都不跑
//   连续 rAF 循环（规格 §6 reduced-motion 红线）。
// - 择位模式（Task 6）不进 3D：择位拖拽是 2D DOM 交互，控制器在 placement.active
//   时强制渲染 2.5D 并忽略 3D 视图切换（本组件不感知择位）。
// - 资源回收：卸载时释放 geometry/material/renderer、断开 ResizeObserver、取消
//   rAF、移除全部监听。未使用 OrbitControls——镜头由共享状态驱动，无 controls
//   实例需要 dispose。

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { PerspectiveCamera, Points, PointsMaterial, Scene, WebGLRenderer } from "three";
import type { GardenSeaHall } from "../../lib/garden-sea";
import { starOffsets } from "../../lib/garden-sea";

// ---- 共享镜头 ↔ 3D 相机（纯函数，overlay 投影与 three 相机同源） ----

export interface StarSea3DCamera {
  scale: number;
  x: number;
  y: number;
}

export interface StarSea3DLabels {
  scene: string;
  loading: string;
  empty: string;
  errorTitle: string;
  retry: string;
  membersUnit: string;
  candidatesTitle: string;
}

const FOV_DEG = 55;
const TAN_HALF_FOV = Math.tan((FOV_DEG * Math.PI) / 180 / 2);
/** 海域世界高度：scale=1、offset=0 时视口恰好框住整片海（与 2.5D 语义一致） */
const WORLD_HEIGHT = 100;
/** 星点（灯）相对馆锚点的 z 向浮动幅度（世界单位）：透视缩放的深度线索 */
const LAMP_DEPTH = 6;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

export interface DerivedCamera3D {
  worldW: number;
  worldH: number;
  dist: number;
  tx: number;
  ty: number;
}

/**
 * 共享镜头 → 3D 相机参数。2.5D 的屏幕映射是 sx = hall.x*vw*scale + offset.x
 * （transform-origin 0 0），本函数推导出与之一致的透视相机：相机垂直俯视 z=0
 * 海面，位置 (tx, ty, dist)，使 z=0 平面上的投影与 2.5D 的 camera transform
 * 逐像素对齐（zoom 锚定视口左上角语义由 tx/ty 的 scale 项还原）。
 */
export function deriveCamera3D(camera: StarSea3DCamera, vw: number, vh: number): DerivedCamera3D {
  const worldH = WORLD_HEIGHT;
  const worldW = WORLD_HEIGHT * (vw / vh);
  const s = camera.scale;
  const dist = worldH / (2 * TAN_HALF_FOV * s);
  const tx = (worldW * (0.5 * vw - camera.x - 0.5 * vw * s)) / (vw * s);
  const ty = (worldH * (0.5 * vh * s - 0.5 * vh + camera.y)) / (vh * s);
  return { worldW, worldH, dist, tx, ty };
}

/** 馆归一化坐标 → overlay 屏幕坐标（容器 px；与 three 相机投影同源同果） */
export function projectHallToScreen(
  hall: Pick<GardenSeaHall, "x" | "y">,
  camera: StarSea3DCamera,
  vw: number,
  vh: number
): { x: number; y: number } {
  const d = deriveCamera3D(camera, vw, vh);
  const wx = (hall.x - 0.5) * d.worldW;
  const wy = (0.5 - hall.y) * d.worldH;
  const ndcX = ((wx - d.tx) * 2 * camera.scale) / d.worldW;
  const ndcY = ((wy - d.ty) * 2 * camera.scale) / d.worldH;
  return { x: ((ndcX + 1) / 2) * vw, y: ((1 - ndcY) / 2) * vh };
}

// 确定性哈希（与 lib/garden-sea 的 fnv1a 同构；该模块未导出且不在本任务改动清单，
// 本地实现仅用于 3D 深度/背景星点——同样不引入任何随机源）
function fnv1aLocal(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const DOME_COUNT = 260;
function domePositions(): Float32Array {
  const out = new Float32Array(DOME_COUNT * 3);
  for (let i = 0; i < DOME_COUNT; i += 1) {
    const h1 = fnv1aLocal(`starsea-dome:${i}:a`);
    const h2 = fnv1aLocal(`starsea-dome:${i}:b`);
    const theta = ((h1 % 4096) / 4096) * Math.PI * 2;
    const phi = ((h2 % 1000) / 1000) * (Math.PI / 2) * 0.94;
    const r = 880 + (h1 % 220);
    out[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = r * Math.cos(phi);
    out[i * 3 + 2] = -Math.abs(r * Math.sin(phi) * Math.sin(theta)); // 只留镜头前方（z < 0）
  }
  return out;
}

function webglSupported(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

// ---- overlay 投影上下文：StarSea3D 每次渲染（镜头/数据/视口变化）重算投影，
// StarSeaDomOverlay 消费同一份数据渲染热区按钮 —— 按钮与 canvas 永不各算各的
export interface StarSeaOverlayEntry {
  hall: GardenSeaHall;
  x: number;
  y: number;
}

interface StarSeaProjection {
  onscreen: Array<StarSeaOverlayEntry>;
  camera: StarSea3DCamera;
  buttonSize: number;
  focusedHallId: string | null;
  matchedHallIds: Set<string> | null;
  onSelectHall: (hallId: string) => void;
  onEnterHall: (hallId: string) => void;
  labels: StarSea3DLabels;
}

const StarSeaProjectionContext = createContext<StarSeaProjection | null>(null);

// ---- 方向键导航：按当前屏幕距离取「上下左右」最近星群；目标热区与其它星群
// 重叠时不随机选择，打开候选菜单（墓园规格 §5「无法判断时显示候选菜单」）
const ARROW_DIRS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

function nearestInDirection(
  from: StarSeaOverlayEntry,
  dir: { dx: number; dy: number },
  list: Array<StarSeaOverlayEntry>
): StarSeaOverlayEntry | null {
  let best: StarSeaOverlayEntry | null = null;
  let bestScore = Infinity;
  for (const c of list) {
    if (c.hall.hallId === from.hall.hallId) continue;
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    const primary = dx * dir.dx + dy * dir.dy;
    if (primary < 12) continue; // 必须在该方向上明显前进（越过亚像素/重叠抖动）
    const ortho = Math.abs(dx * dir.dy) + Math.abs(dy * dir.dx);
    const score = primary + ortho * 2; // 主方向优先，横向偏差加倍惩罚
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/**
 * 独立 DOM overlay（墓园规格 §5：墓位热区、标签和键盘焦点使用独立 2D 交互层）。
 * 每座可见星群一个投影后的 <button>（≥44×44 热区、脱敏 aria-label、2px 烛金
 * 焦点环复用 .starsea-cluster 样式）；Enter 走与 2.5D 完全相同的聚焦→详情链路。
 */
export function StarSeaDomOverlay({ halls }: { halls: Array<GardenSeaHall> }) {
  const ctx = useContext(StarSeaProjectionContext);
  if (!ctx) return null;
  return <StarSeaOverlayBody ctx={ctx} halls={halls} />;
}

function StarSeaOverlayBody({ ctx, halls }: { ctx: StarSeaProjection; halls: Array<GardenSeaHall> }) {
  const [candidates, setCandidates] = useState<{ originId: string; ids: Array<string> } | null>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuFirstRef = useRef<HTMLButtonElement | null>(null);

  const hallIds = useMemo(() => new Set(halls.map((hall) => hall.hallId)), [halls]);

  // 候选菜单打开即聚焦首项（键盘可达）
  useEffect(() => {
    if (candidates) menuFirstRef.current?.focus();
  }, [candidates]);

  const visible = useMemo(
    () => ctx.onscreen.filter((entry) => hallIds.has(entry.hall.hallId)),
    [ctx.onscreen, hallIds]
  );

  function closeCandidates(returnFocus: boolean) {
    const originId = candidates?.originId;
    setCandidates(null);
    if (returnFocus && originId) buttonRefs.current.get(originId)?.focus();
  }

  function handleClusterKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, entry: StarSeaOverlayEntry) {
    if (candidates) return; // 菜单开着：菜单内自行处理键盘
    const dir = ARROW_DIRS[event.key];
    if (!dir) return;
    event.preventDefault();
    const target = nearestInDirection(entry, dir, visible);
    if (!target) return;
    const size = ctx.buttonSize;
    const overlappers = visible.filter(
      (other) =>
        other.hall.hallId !== target.hall.hallId &&
        Math.abs(other.x - target.x) < size &&
        Math.abs(other.y - target.y) < size
    );
    if (overlappers.length > 0) {
      const ids = [target, ...overlappers]
        .map((item) => item.hall.hallId)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      setCandidates({ originId: entry.hall.hallId, ids });
    } else {
      buttonRefs.current.get(target.hall.hallId)?.focus();
    }
  }

  const menuAnchor = candidates
    ? visible.find((entry) => entry.hall.hallId === candidates.ids[0]) || null
    : null;

  return (
    <div className="starsea-3d-overlay">
      {visible.map(({ hall, x, y }) => {
        const matched = !ctx.matchedHallIds || ctx.matchedHallIds.has(hall.hallId);
        const classes = [
          "starsea-cluster",
          "starsea-3d-cluster",
          hall.candleLit ? "is-lit" : "is-cold",
          hall.zone === "official" ? "is-official" : "",
          matched ? "" : "is-dimmed",
          ctx.focusedHallId === hall.hallId ? "is-focused" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={hall.hallId}
            ref={(el) => {
              if (el) buttonRefs.current.set(hall.hallId, el);
              else buttonRefs.current.delete(hall.hallId);
            }}
            type="button"
            className={classes}
            data-hall-id={hall.hallId}
            data-zone={hall.zone}
            style={{ left: `${x}px`, top: `${y}px`, width: ctx.buttonSize, height: ctx.buttonSize }}
            aria-label={`${hall.nameMasked}，${hall.lampCount} ${ctx.labels.membersUnit}`}
            onClick={() => ctx.onSelectHall(hall.hallId)}
            onDoubleClick={() => ctx.onEnterHall(hall.hallId)}
            onKeyDown={(event) => handleClusterKeyDown(event, { hall, x, y })}
          >
            <span className="starsea-name">{hall.nameMasked}</span>
          </button>
        );
      })}
      {candidates && (
        <div
          className="starsea-3d-candidates"
          role="menu"
          aria-label={ctx.labels.candidatesTitle}
          style={
            menuAnchor
              ? { left: `${menuAnchor.x}px`, top: `${menuAnchor.y + ctx.buttonSize / 2 + 8}px` }
              : undefined
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation(); // 只关菜单，不连带抽屉层级回退
              closeCandidates(true);
            }
          }}
        >
          {candidates.ids.map((hallId) => {
            const entry = visible.find((item) => item.hall.hallId === hallId);
            if (!entry) return null;
            return (
              <button
                key={hallId}
                ref={hallId === candidates.ids[0] ? (el) => { menuFirstRef.current = el; } : undefined}
                type="button"
                role="menuitem"
                data-hall-id={hallId}
                aria-label={`${entry.hall.nameMasked}，${entry.hall.lampCount} ${ctx.labels.membersUnit}`}
                onClick={() => {
                  ctx.onSelectHall(hallId);
                  setCandidates(null);
                }}
              >
                {entry.hall.nameMasked} · {entry.hall.lampCount} {ctx.labels.membersUnit}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- 3D 主组件 ----

type ThreeNS = typeof import("three");

interface ThreeStack {
  THREE: ThreeNS;
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  lampPoints: Points;
  lampMat: PointsMaterial;
}

interface StarSea3DProps {
  halls: Array<GardenSeaHall>;
  camera: StarSea3DCamera;
  onCameraChange: (camera: StarSea3DCamera) => void;
  onSelectHall: (hallId: string) => void;
  onEnterHall: (hallId: string) => void;
  matchedHallIds: Set<string> | null;
  focusedHallId: string | null;
  /** panel 非 list 时场景 inert（焦点限制在抽屉/控件内，与 2.5D 同规） */
  inert: boolean;
  loading: boolean;
  error: string | null;
  labels: StarSea3DLabels;
  onRetry: () => void;
  /** 独立 DOM overlay（本文件导出的 StarSeaDomOverlay；交互经 context 注入） */
  overlay: ReactNode;
  /** WebGL 不可用 / three 加载失败 / 上下文丢失 → 控制器 fallback2d */
  onFatalError: () => void;
}

export default function StarSea3D({
  halls,
  camera,
  onCameraChange,
  onSelectHall,
  onEnterHall,
  matchedHallIds,
  focusedHallId,
  inert,
  loading,
  error,
  labels,
  onRetry,
  overlay,
  onFatalError,
}: StarSea3DProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<ThreeStack | null>(null);
  const rafRef = useRef(0);
  const frameCountRef = useRef(0);
  const [phase, setPhase] = useState<"boot" | "ready">("boot");
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  // 最新 props 镜像（效应/手势读 ref，避免闭包过期；与 StarSeaScene 同模式）
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const hallsRef = useRef(halls);
  hallsRef.current = halls;
  const matchedRef = useRef(matchedHallIds);
  matchedRef.current = matchedHallIds;
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  const onFatalErrorRef = useRef(onFatalError);
  onFatalErrorRef.current = onFatalError;

  // ---- 按需渲染：reduced-motion 同步渲染单帧；否则单发 rAF；隐藏时不渲染 ----
  function reducedMotion(): boolean {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function renderOnce() {
    rafRef.current = 0;
    const stack = threeRef.current;
    const root = rootRef.current;
    if (!stack || !root) return;
    stack.renderer.render(stack.scene, stack.camera);
    frameCountRef.current += 1;
    root.dataset.frames = String(frameCountRef.current);
    root.dataset.ready = "1";
  }

  function scheduleFrame() {
    if (!threeRef.current) return;
    if (document.hidden) return; // 页面隐藏：不排帧（恢复可见时 visibilitychange 补帧）
    if (viewportRef.current.w <= 0 || viewportRef.current.h <= 0) return; // 视口未测得：不渲染（防 NaN 几何）
    if (reducedMotion()) {
      renderOnce(); // 静态帧：不经 rAF，镜头变化时同步渲染一帧
      return;
    }
    if (rafRef.current) return; // 合并到同一帧
    rafRef.current = requestAnimationFrame(renderOnce);
  }

  function cancelFrame() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }

  // ---- three 生命周期：动态导入 + WebGL 探测 + 全量回收 ----
  useEffect(() => {
    let disposed = false;
    let lateCleanup: (() => void) | null = null;
    void (async () => {
      try {
        if (!webglSupported()) throw new Error("webgl_unavailable");
        const THREE = await import("three");
        const holder = holderRef.current;
        if (disposed || !holder) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // dpr 上限 2
        renderer.setClearColor(0x000000, 0); // 透明：透出 CSS 星空底图（与 2.5D 同底）
        renderer.domElement.setAttribute("aria-hidden", "true"); // 语义交互全在 DOM overlay
        holder.appendChild(renderer.domElement);
        const canvas = renderer.domElement;

        const scene = new THREE.Scene();
        const camera3 = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 3000);

        // 背景星穹（确定性位置，无随机源）
        const domeGeo = new THREE.BufferGeometry();
        domeGeo.setAttribute("position", new THREE.BufferAttribute(domePositions(), 3));
        const domeMat = new THREE.PointsMaterial({
          color: 0xc5d0e5,
          size: 1.6,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        });
        scene.add(new THREE.Points(domeGeo, domeMat));

        // 星点（灯）：位置/颜色与 2.5D 同数据同语义（candleLit 暖橙、official 只提亮、
        // 搜索不匹配只降亮），z 向浮动提供透视深度
        const lampMat = new THREE.PointsMaterial({
          size: 4,
          sizeAttenuation: true,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const lampPoints = new THREE.Points(new THREE.BufferGeometry(), lampMat);
        scene.add(lampPoints);

        const onContextLost = (event: Event) => {
          event.preventDefault();
          if (!disposed) onFatalErrorRef.current();
        };
        canvas.addEventListener("webglcontextlost", onContextLost);

        const applyViewport = () => {
          const el = rootRef.current;
          if (!el) return;
          const w = el.clientWidth;
          const h = el.clientHeight;
          if (w <= 0 || h <= 0) return;
          renderer.setSize(w, h, false); // CSS 尺寸由样式 100% 承担
          setViewport((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        };
        const observer = new ResizeObserver(applyViewport);
        if (rootRef.current) observer.observe(rootRef.current);

        const onVisibility = () => {
          if (document.hidden) cancelFrame();
          else scheduleFrame();
        };
        document.addEventListener("visibilitychange", onVisibility);

        threeRef.current = { THREE, scene, camera: camera3, renderer, lampPoints, lampMat };
        setPhase("ready");
        applyViewport();
        applyCameraRef.current();
        rebuildLampsRef.current();
        scheduleFrame();

        lateCleanup = () => {
          disposed = true;
          observer.disconnect();
          document.removeEventListener("visibilitychange", onVisibility);
          canvas.removeEventListener("webglcontextlost", onContextLost);
          cancelFrame();
          lampPoints.geometry.dispose();
          lampMat.dispose();
          domeGeo.dispose();
          domeMat.dispose();
          renderer.dispose();
          if (canvas.parentElement === holder) holder.removeChild(canvas);
          threeRef.current = null;
        };
      } catch {
        // WebGL 不可用 / three 导入失败 / 渲染器创建失败：交给控制器 fallback2d
        if (!disposed) onFatalErrorRef.current();
      }
    })();
    return () => {
      lateCleanup?.();
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 共享镜头 → three 相机 + 单帧 ----
  const applyCameraRef = useRef(() => {});
  applyCameraRef.current = () => {
    const stack = threeRef.current;
    if (!stack) return;
    const cam = cameraRef.current;
    const { w, h } = viewportRef.current;
    if (w <= 0 || h <= 0) return;
    const d = deriveCamera3D(cam, w, h);
    stack.camera.aspect = d.worldW / d.worldH;
    stack.camera.position.set(d.tx, d.ty, d.dist);
    stack.camera.lookAt(d.tx, d.ty, 0);
    stack.camera.near = Math.max(d.dist * 0.02, 0.05);
    stack.camera.far = d.dist + 2400; // 覆盖星穹半径（880–1100）
    stack.camera.updateProjectionMatrix();
    // 星点世界尺寸：7px CSS（与 2.5D .starsea-dot 同观感）在当前镜头下换算
    stack.lampMat.size = (7 * d.worldH) / (cam.scale * h);
  };

  // ---- 数据 → 重建星点缓冲 + 单帧 ----
  const rebuildLampsRef = useRef(() => {});
  rebuildLampsRef.current = () => {
    const stack = threeRef.current;
    if (!stack) return;
    const { w, h } = viewportRef.current;
    if (w <= 0 || h <= 0) return; // 视口未测得（worldW=∞/NaN）——待 ResizeObserver 首报后重建
    const { worldW, worldH } = deriveCamera3D(cameraRef.current, w, h);
    const list = hallsRef.current;
    const count = list.reduce(
      (n, hall) => n + Math.min(6, Math.max(1, Math.floor(hall.lampCount) || 1)),
      0
    );
    // 空海域不参与渲染（空几何的包围球为 NaN，three 会告警）
    stack.lampPoints.visible = count > 0;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let k = 0;
    for (const hall of list) {
      const offsets = starOffsets(hall.hallId, hall.lampCount); // 与 2.5D 同源确定性星阵
      const matched = !matchedRef.current || matchedRef.current.has(hall.hallId);
      // 语义与 2.5D 一致：candleLit=暖橙，冷白按 0.55 预乘到底色；official 仅提亮；
      // 搜索不匹配仅降亮（不改位置/排序，无热度文案）
      let r: number;
      let g: number;
      let b: number;
      if (hall.candleLit) {
        r = 251 / 255;
        g = 191 / 255;
        b = 36 / 255;
      } else {
        r = (197 * 0.55) / 255;
        g = (208 * 0.55) / 255;
        b = (229 * 0.55) / 255;
      }
      if (hall.zone === "official") {
        r *= 1.3;
        g *= 1.3;
        b *= 1.3;
      }
      if (!matched) {
        r *= 0.22;
        g *= 0.22;
        b *= 0.22;
      }
      const cx = (hall.x - 0.5) * worldW;
      const cy = (0.5 - hall.y) * worldH;
      offsets.forEach((off, i) => {
        positions[k * 3] = cx + off.x * worldW;
        positions[k * 3 + 1] = cy - off.y * worldH;
        positions[k * 3 + 2] = ((fnv1aLocal(`${hall.hallId}#${i}`) % 1000) / 1000 - 0.5) * LAMP_DEPTH;
        colors[k * 3] = Math.min(1, r);
        colors[k * 3 + 1] = Math.min(1, g);
        colors[k * 3 + 2] = Math.min(1, b);
        k += 1;
      });
    }
    const geo = new stack.THREE.BufferGeometry();
    geo.setAttribute("position", new stack.THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new stack.THREE.BufferAttribute(colors, 3));
    stack.lampPoints.geometry.dispose();
    stack.lampPoints.geometry = geo;
  };

  useEffect(() => {
    if (phase !== "ready") return;
    applyCameraRef.current();
    scheduleFrame();
  }, [phase, camera.scale, camera.x, camera.y, viewport.w, viewport.h]);

  useEffect(() => {
    if (phase !== "ready") return;
    rebuildLampsRef.current();
    scheduleFrame();
  }, [phase, halls, matchedHallIds, viewport.w, viewport.h]);

  // ---- 手势：与 2.5D（StarSeaScene）同一套像素数学，回流共享镜头 ----
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  function commit(next: { scale: number; x: number; y: number }) {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    onCameraChangeRef.current({ scale, x: next.x, y: next.y });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // overlay 按钮/候选菜单在场景之上：它们的指针不触发镜头（点击语义归 overlay）
    if ((event.target as HTMLElement).closest(".starsea-cluster, .starsea-3d-candidates")) return;
    rootRef.current?.setPointerCapture(event.pointerId);
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lastRef.current = { x: event.clientX, y: event.clientY };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: cameraRef.current.scale };
    } else {
      pinchRef.current = null;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinchRef.current) {
      // 双指捏合：围绕两指中点缩放（移动端，规格 §5）
      const [a, b] = [...pointers.values()];
      const base = pinchRef.current;
      if (base.distance <= 0) return;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, base.scale * (Math.hypot(a.x - b.x, a.y - b.y) / base.distance)));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const current = cameraRef.current;
      const px = (mid.x - current.x) / current.scale;
      const py = (mid.y - current.y) / current.scale;
      commit({ scale, x: mid.x - px * scale, y: mid.y - py * scale });
      return;
    }
    const last = lastRef.current;
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    lastRef.current = { x: event.clientX, y: event.clientY };
    commit({ scale: cameraRef.current.scale, x: cameraRef.current.x + dx, y: cameraRef.current.y + dy });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) {
      lastRef.current = null;
      pinchRef.current = null;
    }
  }

  // React 根节点把 wheel 注册为 passive，preventDefault 需原生非 passive 监听
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    function onWheelNative(event: WheelEvent) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      const current = cameraRef.current;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      // 光标锚定缩放（与 2.5D 同式）
      const px = (event.clientX - current.x) / current.scale;
      const py = (event.clientY - current.y) / current.scale;
      commit({ scale, x: event.clientX - px * scale, y: event.clientY - py * scale });
    }
    node.addEventListener("wheel", onWheelNative, { passive: false });
    return () => node.removeEventListener("wheel", onWheelNative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- overlay 投影（与 three 相机同源纯函数） ----
  const buttonSize = Math.min(96, Math.max(44, 48 * camera.scale));
  const onscreen = useMemo(() => {
    if (viewport.w <= 0 || viewport.h <= 0) return [];
    const margin = buttonSize;
    const out: Array<StarSeaOverlayEntry> = [];
    for (const hall of halls) {
      const p = projectHallToScreen(hall, camera, viewport.w, viewport.h);
      if (p.x < -margin || p.x > viewport.w + margin || p.y < -margin || p.y > viewport.h + margin) continue;
      out.push({ hall, x: p.x, y: p.y });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halls, camera.scale, camera.x, camera.y, viewport.w, viewport.h, buttonSize]);

  const ctxValue = useMemo<StarSeaProjection>(
    () => ({
      onscreen,
      camera,
      buttonSize,
      focusedHallId,
      matchedHallIds,
      onSelectHall,
      onEnterHall,
      labels,
    }),
    [onscreen, camera, buttonSize, focusedHallId, matchedHallIds, onSelectHall, onEnterHall, labels]
  );

  return (
    <div
      className="garden-sea starsea-scene-3d"
      aria-label={labels.scene}
      ref={rootRef}
      inert={inert}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="starsea-3d-canvas-holder" ref={holderRef} />
      <StarSeaProjectionContext.Provider value={ctxValue}>{overlay}</StarSeaProjectionContext.Provider>
      {loading && halls.length === 0 && <div className="garden-sea-skeleton" aria-hidden="true" />}
      {!loading && !error && halls.length === 0 && <p className="starsea-empty">{labels.empty}</p>}
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
