"use client";

// 星海 3D 渐进增强层（Task 7，墓园规格 §5；2026-09-02 增环绕旋转与 D 档星光）：
// - 职责边界：3D 只负责「渲染与镜头」——选馆/进馆/键盘导航/44px 热区/焦点环全部
//   走独立 DOM overlay（StarSeaDomOverlay，本文件导出）；overlay 按钮与 canvas
//   共享同一份 GardenSeaHall[]，投影直接取 three 相机的真实投影矩阵——
//   旋转到任何角度热区都钉在星点上。
// - 镜头：共享镜头（scale/offset）仍由 deriveCamera3D 纯函数放置（与 2.5D 逐像素
//   对齐，双向切换保留快照）；3D 额外持有「环绕旋转」自由度（轨迹球四元数，
//   2026-09-02 用户拍板+反馈迭代：拖拽向量直接给轴，内容跟手，无天顶极点退化，
//   视点仰角护栏防翻底）——只活在组件内存：不进 URL/sessionStorage 白名单，
//   切回 2.5D / 卸载即归零；复位按钮经 cameraResetNonce 一并归零。
//   手势：单指/左键拖拽 = 旋转，Shift+拖拽 = 平移，双指 = 捏合缩放 + 中点平移，
//   滚轮 = 光标锚定缩放（平移/缩放经 onCameraChange 回流共享镜头）。
//   背景为全天球星场（远星两层 + 银河带 + 星座团簇连线，确定性生成）：
//   旋转到任何角度天空都有内容。
// - 渐进加载：three 只在本组件挂载后 await import("three")——2.5D 路径（默认视图）
//   永不支付 three 的包体；顶部 import type 仅类型引用，编译期擦除。
// - 降级：WebGL 探测失败 / three 导入失败 / WebGLRenderer 创建失败 /
//   webglcontextlost（preventDefault 后）→ onFatalError → 控制器 fallback2d：
//   只替换场景渲染器，抽屉与控制条不动。
// - 渲染节奏：按需渲染。镜头/数据/尺寸/旋转变化补一帧（reduced-motion 同步渲染，
//   否则单发 rAF）；页面隐藏取消待渲染帧、恢复可见补一帧；任何情况下都不跑
//   连续 rAF 循环（规格 §6 reduced-motion 红线）。
// - 择位模式（Task 6）不进 3D：择位拖拽是 2D DOM 交互，控制器在 placement.active
//   时强制渲染 2.5D 并忽略 3D 视图切换（本组件不感知择位）。
// - 资源回收：卸载时释放 geometry/material/texture/renderer、断开 ResizeObserver、
//   取消 rAF、移除全部监听。未使用 OrbitControls——旋转/平移/缩放手势与共享
//   镜头回流一体实现，无 controls 实例需要 dispose。

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
  BufferGeometry,
  CanvasTexture,
  Material,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from "three";
import type { GardenSeaHall } from "../../lib/garden-sea";
import { starOffsets } from "../../lib/garden-sea";
import { LOD_FAR_SCALE } from "./StarCluster";

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
  /** 远景档聚合数量（读屏可达；Task 8 LOD，与 2.5D 同文案） */
  lodSummary: (n: number) => string;
}

const FOV_DEG = 55;
const TAN_HALF_FOV = Math.tan((FOV_DEG * Math.PI) / 180 / 2);
/** 海域世界高度：scale=1、offset=0 时视口恰好框住整片海（与 2.5D 语义一致） */
const WORLD_HEIGHT = 100;
/** 星点（灯）相对馆锚点的 z 向浮动幅度（世界单位）：透视缩放的深度线索 */
const LAMP_DEPTH = 6;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
/** 环绕（轨迹球）灵敏度（弧度/像素）：200px 拖拽 ≈ 57°，与地图应用同族 */
const ORBIT_K = 0.005;
/** 相机高度护栏：视点到海面的 z 不低于 0.12×dist（≈7° 仰角）——可贴近地平线看星海，
 *  但不钻到海面下方/不翻底；被拦截的增量减半重试一次，避免硬粘滞 */
const MIN_ELEV_RATIO = 0.12;

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

// ---- 全天球星场（2026-09-02 用户拍板：360° 各角度都有星系/星座背景）----
// 全部由 fnv1aLocal 确定性生成，无随机源；位置为完整球面（不再只留镜头前方）。

/** 球面上确定性取点：黄金角螺旋（近似均匀）+ 确定性抖动 */
function spherePoint(i: number, total: number, jitter: number, radius: number): [number, number, number] {
  const h1 = fnv1aLocal(`sky:${i}:${total}:a`);
  const h2 = fnv1aLocal(`sky:${i}:${total}:b`);
  const h3 = fnv1aLocal(`sky:${i}:${total}:c`);
  // 斐波那契球分布
  const y = 1 - (2 * (i + ((h1 % 1000) / 1000) * jitter)) / total;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * 2.399963229728653 + ((h2 % 1000) / 1000) * jitter * Math.PI; // 黄金角
  const rr = radius * (1 + ((h3 % 1000) / 1000 - 0.5) * 0.22);
  return [rr * r * Math.cos(theta), y * rr, rr * r * Math.sin(theta)];
}

/** 基础远星：两层（暗层量大 / 亮层量少带冷暖色偏） */
export interface SkyfarLayers {
  dimPositions: Float32Array;
  brightPositions: Float32Array;
  brightColors: Float32Array;
  bandPositions: Float32Array;
  bandColors: Float32Array;
  clumpPositions: Float32Array;
  clumpColors: Float32Array;
  linePositions: Float32Array;
}
const SKY_RADIUS = 950;
const BAND_TILT = (60 * Math.PI) / 180; // 银河带倾角：与海面成 60°，旋转时更有空间感
function buildSkyfield(): SkyfarLayers {
  // 暗层 340 + 亮层 120（黄金角全球）
  const dimPositions = new Float32Array(340 * 3);
  for (let i = 0; i < 340; i += 1) {
    const [x, y, z] = spherePoint(i, 340, 0.6, SKY_RADIUS);
    dimPositions.set([x, y, z], i * 3);
  }
  const brightPositions = new Float32Array(120 * 3);
  const brightColors = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i += 1) {
    const [x, y, z] = spherePoint(i, 120, 0.8, SKY_RADIUS);
    brightPositions.set([x, y, z], i * 3);
    const t = (fnv1aLocal(`sky-bright:${i}`) % 1000) / 1000;
    const warm = t > 0.72; // 少量暖星（暖白偏金），其余冷白偏蓝
    brightColors.set(warm ? [1, 0.92, 0.78] : [0.82, 0.88, 1], i * 3);
  }
  // 银河带：260 点集中于一条倾斜大圆 ±14° 纬带（暖蓝渐变，旋转到任何角度都可见）
  const bandPositions = new Float32Array(260 * 3);
  const bandColors = new Float32Array(260 * 3);
  const cosT = Math.cos(BAND_TILT);
  const sinT = Math.sin(BAND_TILT);
  for (let i = 0; i < 260; i += 1) {
    const h1 = fnv1aLocal(`band:${i}:a`);
    const h2 = fnv1aLocal(`band:${i}:b`);
    const lon = ((h1 % 4096) / 4096) * Math.PI * 2;
    const lat = (((h2 % 1000) / 1000 - 0.5) * 28 * Math.PI) / 180; // ±14°
    const r = SKY_RADIUS * 1.06;
    // 大圆坐标（赤道系）→ 绕 x 轴倾斜 BAND_TILT
    const bx = r * Math.cos(lat) * Math.cos(lon);
    const by0 = r * Math.sin(lat);
    const bz0 = r * Math.cos(lat) * Math.sin(lon);
    bandPositions.set([bx, by0 * cosT - bz0 * sinT, by0 * sinT + bz0 * cosT], i * 3);
    const warm = Math.cos(lon) > 0.3; // 沿带渐变：半圈偏暖、半圈偏冷蓝
    bandColors.set(warm ? [0.95, 0.9, 0.82] : [0.78, 0.84, 1], i * 3);
  }
  // 星座团簇：7 组，每组 16 星围绕簇心小角度散布；组内按序连线（折线星座感）
  const clumpCenters: Array<[number, number, number]> = [];
  for (let c = 0; c < 7; c += 1) {
    const [x, y, z] = spherePoint(500 + c, 507, 0.9, SKY_RADIUS * 0.98);
    clumpCenters.push([x, y, z]);
  }
  const clumpPositions = new Float32Array(7 * 16 * 3);
  const clumpColors = new Float32Array(7 * 16 * 3);
  const linePositions: number[] = [];
  for (let c = 0; c < 7; c += 1) {
    const [cx, cy, cz] = clumpCenters[c];
    const spread = SKY_RADIUS * 0.055;
    const prev: Array<[number, number, number]> = [];
    for (let s = 0; s < 16; s += 1) {
      const h1 = fnv1aLocal(`clump:${c}:${s}:a`);
      const h2 = fnv1aLocal(`clump:${c}:${s}:b`);
      const h3 = fnv1aLocal(`clump:${c}:${s}:c`);
      const p: [number, number, number] = [
        cx + (((h1 % 1000) / 1000 - 0.5) * 2 - 0) * spread,
        cy + (((h2 % 1000) / 1000 - 0.5) * 2) * spread,
        cz + (((h3 % 1000) / 1000 - 0.5) * 2) * spread,
      ];
      clumpPositions.set(p, (c * 16 + s) * 3);
      clumpColors.set([0.92, 0.94, 1], (c * 16 + s) * 3);
      // 连线：每 2 星连一条折线（s 偶数位与前一星相连）——稀疏的星座连线感
      if (s > 0 && s % 2 === 0 && prev[s - 1]) {
        linePositions.push(...prev[s - 1], ...p);
      }
      prev[s] = p;
    }
  }
  return {
    dimPositions,
    brightPositions,
    brightColors,
    bandPositions,
    bandColors,
    clumpPositions,
    clumpColors,
    linePositions: new Float32Array(linePositions),
  };
}

function webglSupported(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

// ---- D 档星光贴图（2026-09-02，与 2.5D 星点同观感；canvas 确定性绘制，无随机） ----

/** 光晕精灵：白核 + 多层衰减光晕（白色，由顶点色/材质色着色；叠加混合）。
 *  2026-09-02 二次拍板：撤「星尘环」，与 2.5D C 档同观感。 */
function makeAuraTexture(THREE: ThreeNS) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.14, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.32, "rgba(255,255,255,0.38)");
    grad.addColorStop(0.62, "rgba(255,255,255,0.12)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

/** 十字光芒精灵：中心横向 + 纵向柔条（仅 24h 明灭暖星渲染，暖白色） */
function makeGlintTexture(THREE: ThreeNS) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const h = ctx.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, "rgba(255,255,255,0)");
    h.addColorStop(0.5, "rgba(255,255,255,0.9)");
    h.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = h;
    ctx.fillRect(0, 31, 64, 2);
    const v = ctx.createLinearGradient(0, 0, 0, 64);
    v.addColorStop(0, "rgba(255,255,255,0)");
    v.addColorStop(0.5, "rgba(255,255,255,0.9)");
    v.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = v;
    ctx.fillRect(31, 0, 2, 64);
  }
  return new THREE.CanvasTexture(canvas);
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

  // 菜单外点击（含 canvas 手势/其他星群/控件）关闭陈旧菜单；capture 层先于场景
  // 手势触发，只做关闭，不改焦点/不吞事件——Esc/Enter 既有流程不受影响
  useEffect(() => {
    if (!candidates) return;
    function onOutsidePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".starsea-3d-candidates")) return; // 菜单内点击交给菜单按钮
      setCandidates(null);
    }
    document.addEventListener("pointerdown", onOutsidePointerDown, true);
    return () => document.removeEventListener("pointerdown", onOutsidePointerDown, true);
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

  // 远景档（Task 8 LOD，规格 §8.5）：canvas 星点继续渲染（GPU 侧廉价），
  // overlay 只渲染投影光晕 + 读屏聚合数量，不挂按钮/名牌/方向键导航；
  // 找馆通道 = 搜索 + 抽屉卡片流（§8.5 不变）。
  if (ctx.camera.scale < LOD_FAR_SCALE) {
    return (
      <div className="starsea-3d-overlay">
        {visible.map(({ hall, x, y }) => (
          <span
            key={hall.hallId}
            className={`starsea-halo ${hall.candleLit ? "is-lit" : "is-cold"}${
              ctx.matchedHallIds && !ctx.matchedHallIds.has(hall.hallId) ? " is-dimmed" : ""
            }`}
            data-hall-id={hall.hallId}
            aria-hidden="true"
            style={{ left: `${x}px`, top: `${y}px` }}
          />
        ))}
        <p className="starsea-lod-summary">{ctx.labels.lodSummary(halls.length)}</p>
      </div>
    );
  }

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
          onBlur={(event) => {
            // Task 9：焦点移出菜单（Tab 到别处/点到菜单外）即关闭陈旧菜单，
            // 不回焦——焦点是用户主动移走的（Esc 才回焦到触发星群）
            const next = event.relatedTarget as HTMLElement | null;
            if (next && next.closest(".starsea-3d-candidates")) return;
            setCandidates(null);
          }}
        >
          {candidates.ids.map((hallId) => {
            // Task 9：菜单项数据源用全量 halls 而非 onscreen 派生的 visible——
            // overlay 投影在视口测量/镜头收敛期可能瞬时剔除目标馆，菜单项 return null
            // 会把「已聚焦的 menuitem」从 DOM 移除（焦点静默落到 body，Pixel 7 实测）。
            // 菜单只在打开期间存在（≤ 数项），用全量数据源保证项不卸载；定位仍走 menuAnchor。
            const entry = visible.find((item) => item.hall.hallId === hallId);
            const hall = entry?.hall || halls.find((item) => item.hallId === hallId);
            if (!hall) return null;
            return (
              <button
                key={hallId}
                ref={hallId === candidates.ids[0] ? (el) => { menuFirstRef.current = el; } : undefined}
                type="button"
                role="menuitem"
                data-hall-id={hallId}
                aria-label={`${hall.nameMasked}，${hall.lampCount} ${ctx.labels.membersUnit}`}
                onClick={() => {
                  ctx.onSelectHall(hallId);
                  setCandidates(null);
                }}
              >
                {hall.nameMasked} · {hall.lampCount} {ctx.labels.membersUnit}
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
  glintPoints: Points;
  glintMat: PointsMaterial;
  auraTex: CanvasTexture;
  glintTex: CanvasTexture;
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
  /** 当前投影在屏的星群数 → 控制器调试指标（Task 8 Step 5） */
  onVisibleCountChange?: (count: number) => void;
  /** 复位信号（随共享镜头复位递增）：3D 环绕旋转一并归零 */
  cameraResetNonce?: number;
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
  onVisibleCountChange,
  cameraResetNonce = 0,
}: StarSea3DProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<ThreeStack | null>(null);
  const rafRef = useRef(0);
  const frameCountRef = useRef(0);
  const [phase, setPhase] = useState<"boot" | "ready">("boot");
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  // 环绕旋转（仅 3D 层内存，2026-09-02）：arcball 四元数（x,y,z,w，单位化）；
  // reset 归零 / 卸载即失。不用「yaw/pitch 球坐标」——正俯视是天顶极点，
  // 水平旋转恒等无视觉效果（实测踩坑）；arcball 绕相机屏幕轴累积，无极点退化。
  const [orbit, setOrbit] = useState({ x: 0, y: 0, z: 0, w: 1 });
  const orbitRef = useRef(orbit);
  orbitRef.current = orbit;
  // overlay 投影结果（相机直投，由下方 effect 在相机/旋转/数据变化后回填）
  const [onscreen, setOnscreen] = useState<Array<StarSeaOverlayEntry>>([]);

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
    let contextLost = false; // onContextLost 置位：上下文已丢，无需再强制释放
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

        // 全天球背景星场（2026-09-02 用户拍板，确定性生成，无随机源）：
        // 远星两层 + 银河带（倾斜大圆 ±14° 纬带）+ 7 组星座团簇（含极淡连线）。
        // 旋转到任何角度背景都有内容；点/线全部静态（无动画，reduced-motion 天然合规）。
        const sky = buildSkyfield();
        const skyLayers: Array<{ geo: BufferGeometry; mat: Material }> = [];
        const addSkyLayer = (
          positions: Float32Array,
          mat: Material,
          colors?: Float32Array
        ): BufferGeometry => {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          if (colors) geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          scene.add(new THREE.Points(geo, mat));
          skyLayers.push({ geo, mat });
          return geo;
        };
        addSkyLayer(
          sky.dimPositions,
          new THREE.PointsMaterial({
            color: 0xc5d0e5,
            size: 1.5,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
          })
        );
        addSkyLayer(
          sky.brightPositions,
          new THREE.PointsMaterial({
            size: 2.2,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
          }),
          sky.brightColors
        );
        addSkyLayer(
          sky.bandPositions,
          new THREE.PointsMaterial({
            size: 1.3,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          }),
          sky.bandColors
        );
        addSkyLayer(
          sky.clumpPositions,
          new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
          }),
          sky.clumpColors
        );
        // 星座连线：极淡折线（ additive 感由透明度控制）
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute("position", new THREE.BufferAttribute(sky.linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xaebadd,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        });
        scene.add(new THREE.LineSegments(lineGeo, lineMat));
        skyLayers.push({ geo: lineGeo, mat: lineMat });

        // 星点（灯）：位置/颜色与 2.5D 同数据同语义（candleLit 暖橙、official 只提亮、
        // 搜索不匹配只降亮），z 向浮动提供透视深度。D 档贴图（2026-09-02）：
        // 光晕精灵（白核+多层光晕）由顶点色着色、叠加混合——与 2.5D 星点同观感
        const auraTex = makeAuraTexture(THREE);
        const lampMat = new THREE.PointsMaterial({
          size: 4,
          sizeAttenuation: true,
          vertexColors: true,
          map: auraTex,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const lampPoints = new THREE.Points(new THREE.BufferGeometry(), lampMat);
        scene.add(lampPoints);

        // 十字光芒层（D 档）：仅 24h 明灭暖星，馆锚点一枚、暖白柔条叠加混合
        const glintTex = makeGlintTexture(THREE);
        const glintMat = new THREE.PointsMaterial({
          size: 4,
          sizeAttenuation: true,
          color: 0xffe2a0,
          map: glintTex,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const glintPoints = new THREE.Points(new THREE.BufferGeometry(), glintMat);
        scene.add(glintPoints);

        const onContextLost = (event: Event) => {
          event.preventDefault();
          contextLost = true;
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

        threeRef.current = {
          THREE,
          scene,
          camera: camera3,
          renderer,
          lampPoints,
          lampMat,
          glintPoints,
          glintMat,
          auraTex,
          glintTex,
        };
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
          glintPoints.geometry.dispose();
          glintMat.dispose();
          auraTex.dispose();
          glintTex.dispose();
          for (const layer of skyLayers) {
            layer.geo.dispose();
            layer.mat.dispose();
          }
          // 显式释放 WebGL 上下文：2D↔3D 每次切换都新建上下文，浏览器对活跃
          // 上下文有上限（Chrome ~16 个）——只 dispose 的话，脱离文档的旧 canvas
          // 在 GC 前仍占名额，密集切换可能把活上下文挤掉导致误降级。上下文已
          // 丢失（onFatalError 已触发）时不再强制。监听已先移除，强制丢失不会
          // 再触发 onFatalError。
          if (!contextLost) renderer.forceContextLoss();
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

  // ---- 共享镜头 + 环绕旋转 → three 相机 + 单帧 ----
  const applyCameraRef = useRef(() => {});
  applyCameraRef.current = () => {
    const stack = threeRef.current;
    if (!stack) return;
    const cam = cameraRef.current;
    const { w, h } = viewportRef.current;
    if (w <= 0 || h <= 0) return;
    const d = deriveCamera3D(cam, w, h);
    stack.camera.aspect = d.worldW / d.worldH;
    // 环绕（arcball，2026-09-02）：基础偏移 (0,0,dist)（正俯视）经四元数旋转后
    // 加到视心 (tx,ty,0)；up 随四元数同旋。单位四元数时与旧版逐像素对齐
    // （投影 parity 保持：位置/朝向/up 与天顶参数化完全一致）。
    const o = orbitRef.current;
    const q = new stack.THREE.Quaternion(o.x, o.y, o.z, o.w).normalize();
    const offset = new stack.THREE.Vector3(0, 0, d.dist).applyQuaternion(q);
    stack.camera.position.set(d.tx + offset.x, d.ty + offset.y, offset.z);
    stack.camera.up.set(0, 1, 0).applyQuaternion(q);
    stack.camera.lookAt(d.tx, d.ty, 0);
    stack.camera.near = Math.max(d.dist * 0.02, 0.05);
    stack.camera.far = d.dist + 2400; // 覆盖星穹半径（880–1100）
    stack.camera.updateProjectionMatrix();
    stack.camera.updateMatrixWorld(true); // 投影前更新（overlay 用 camera.project 同帧取值）
    // 星点世界尺寸：three 的 sizeAttenuation 是 gl_PointSize = size × (vh/2) / dist
    // （注意分母没有 tan(fov/2) 因子），因此要与 2.5D 的 C 档星光观感对齐
    // （2026-09-02 二次拍板：光晕精灵盘约 18px 视觉外径），需 size = 18 × worldH / (tanHalf × scale × vh)；
    // 十字光芒层 ≈ 2.4 倍。
    const lampPx = (18 * d.worldH) / (TAN_HALF_FOV * cam.scale * h);
    stack.lampMat.size = lampPx;
    stack.glintMat.size = lampPx * 2.4;
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

    // 十字光芒缓冲（C 档）：仅 candleLit 暖星的馆锚点（z=0）
    const litHalls = list.filter((hall) => hall.candleLit);
    stack.glintPoints.visible = litHalls.length > 0;
    const litPos = new Float32Array(litHalls.length * 3);
    litHalls.forEach((hall, i) => {
      litPos[i * 3] = (hall.x - 0.5) * worldW;
      litPos[i * 3 + 1] = (0.5 - hall.y) * worldH;
      litPos[i * 3 + 2] = 0;
    });
    const glintGeo = new stack.THREE.BufferGeometry();
    glintGeo.setAttribute("position", new stack.THREE.BufferAttribute(litPos, 3));
    stack.glintPoints.geometry.dispose();
    stack.glintPoints.geometry = glintGeo;
  };

  // ---- 相机放置 + overlay 投影（camera.project：旋转/平移/缩放同源同果） ----
  useEffect(() => {
    if (phase !== "ready") return;
    const stack = threeRef.current;
    const { w, h } = viewport;
    if (!stack || w <= 0 || h <= 0) return;
    applyCameraRef.current(); // 含 updateMatrixWorld（投影同帧可用）
    const cam = cameraRef.current;
    const { worldW, worldH } = deriveCamera3D(cam, w, h);
    const margin = Math.min(96, Math.max(44, 48 * cam.scale));
    const v = new stack.THREE.Vector3();
    const out: Array<StarSeaOverlayEntry> = [];
    for (const hall of hallsRef.current) {
      v.set((hall.x - 0.5) * worldW, (0.5 - hall.y) * worldH, 0);
      v.project(stack.camera);
      if (v.z > 1) continue; // 裁剪面外（安全兜底；pitch ≤60° 时海面不会到相机身后）
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      if (x < -margin || x > w + margin || y < -margin || y > h + margin) continue;
      out.push({ hall, x, y });
    }
    setOnscreen(out);
    scheduleFrame();
    // orbit 变化 = 旋转自由度；halls 身份变化 = 数据/匹配态更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, camera.scale, camera.x, camera.y, orbit.x, orbit.y, orbit.z, orbit.w, viewport.w, viewport.h, halls]);

  // 复位信号：共享镜头复位时，3D 环绕旋转一并归零（规格 §5 复位只改镜头——镜头含旋转自由度）
  useEffect(() => {
    orbitRef.current = { x: 0, y: 0, z: 0, w: 1 };
    setOrbit({ x: 0, y: 0, z: 0, w: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraResetNonce]);

  useEffect(() => {
    if (phase !== "ready") return;
    rebuildLampsRef.current();
    scheduleFrame();
  }, [phase, halls, matchedHallIds, viewport.w, viewport.h]);

  // ---- 手势：与 2.5D（StarSeaScene）同一套像素数学，回流共享镜头 ----
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number; lastMid?: { x: number; y: number } } | null>(null);

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
      pinchRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: cameraRef.current.scale,
        lastMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    } else {
      pinchRef.current = null;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinchRef.current) {
      // 双指：捏合缩放（围绕中点）+ 中点平移（移动端地图习惯；规格 §5 缩放/拖拽）
      const [a, b] = [...pointers.values()];
      const base = pinchRef.current;
      if (base.distance <= 0) return;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, base.scale * (Math.hypot(a.x - b.x, a.y - b.y) / base.distance)));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const current = cameraRef.current;
      const px = (mid.x - current.x) / current.scale;
      const py = (mid.y - current.y) / current.scale;
      const panDx = mid.x - (base.lastMid?.x ?? mid.x);
      const panDy = mid.y - (base.lastMid?.y ?? mid.y);
      pinchRef.current = { ...base, lastMid: mid };
      commit({ scale, x: mid.x - px * scale + panDx, y: mid.y - py * scale + panDy });
      return;
    }
    const last = lastRef.current;
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    lastRef.current = { x: event.clientX, y: event.clientY };
    if (event.shiftKey) {
      // Shift+拖拽 = 平移（回流共享镜头，与 2.5D 同像素数学）
      commit({ scale: cameraRef.current.scale, x: cameraRef.current.x + dx, y: cameraRef.current.y + dy });
      return;
    }
    // 单指/左键拖拽 = 环绕旋转（轨迹球，2026-09-02 用户反馈迭代：拖拽向量直接给出
    // 旋转轴，「抓住场景拖」——内容跟随光标；仅 3D 层内存，不进 URL/sessionStorage/共享镜头）。
    // 轴（相机系→世界系）= 屏幕右轴×(-dy) + 屏幕上轴×(-dx)，角 = K×拖拽距离；
    // 护栏 MIN_ELEV_RATIO：低于仰角时减半重试一次再放弃（防「拖不动」的粘滞感）。
    const stack = threeRef.current;
    if (!stack) return;
    const { w: vw, h: vh } = viewportRef.current;
    if (vw <= 0 || vh <= 0) return;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    stack.camera.updateMatrixWorld(true);
    const right = new stack.THREE.Vector3().setFromMatrixColumn(stack.camera.matrixWorld, 0).normalize();
    const up = new stack.THREE.Vector3().setFromMatrixColumn(stack.camera.matrixWorld, 1).normalize();
    const axis = right
      .clone()
      .multiplyScalar(-dy)
      .add(up.clone().multiplyScalar(-dx))
      .normalize();
    const q = new stack.THREE.Quaternion(orbitRef.current.x, orbitRef.current.y, orbitRef.current.z, orbitRef.current.w);
    const dist = deriveCamera3D(cameraRef.current, vw, vh).dist;
    const attempt = (angle: number): boolean => {
      const candidate = q.clone().premultiply(new stack.THREE.Quaternion().setFromAxisAngle(axis, angle));
      const oz = new stack.THREE.Vector3(0, 0, dist).applyQuaternion(candidate).z;
      if (oz < MIN_ELEV_RATIO * dist) return false;
      q.copy(candidate);
      return true;
    };
    const angle = ORBIT_K * len;
    if (!attempt(angle)) attempt(angle / 2);
    q.normalize();
    orbitRef.current = { x: q.x, y: q.y, z: q.z, w: q.w };
    setOrbit(orbitRef.current);
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

  // ---- overlay 投影结果（相机直投，见上方 effect）----
  const buttonSize = Math.min(96, Math.max(44, 48 * camera.scale));

  useEffect(() => {
    onVisibleCountChange?.(onscreen.length);
  }, [onscreen.length, onVisibleCountChange]);

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
