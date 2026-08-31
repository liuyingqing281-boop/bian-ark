// 星海空间数据（Task 3）：馆级数据契约类型 + 确定性星群布局。
// GardenSeaHall 逐字段对齐 GET /api/garden/starsea 响应（docs/08 §3.13 F8，Task 1 冻结）。
// 确定性红线：星阵形状只由 hallId/lampCount 推导（FNV-1a 哈希 → 固定预设取模），
// 不引入任何随机源 —— 同一馆在刷新、缩放、搜索后保持同一星形。
// 注：本模块须保持可擦除 TS 语法（无 enum/namespace/参数属性），供
// node --experimental-strip-types 直载（tools/test-starsea-formal.mjs）。

export type GardenZone = "public" | "family" | "official";

export interface GardenSeaHall {
  hallId: string;
  nameMasked: string;
  x: number;
  y: number;
  zone: GardenZone;
  lampCount: number;
  candleLit: boolean;
  avatarUrl: string;
  birthDate: string;
  deathDate: string;
  epitaph: string;
  constellationOf: string | null;
}

// 星群成员相对馆坐标的固定偏移预设（归一化坐标；|dx|,|dy| ≤ 0.02，
// 与相邻馆最小间距 0.04 的二半匹配，成员星不越入邻馆星域）。
// 6 套手定星形：环形 / 弧线 / 直线 / 三角 / 密簇 / 北斗。
const STAR_OFFSET_PRESETS: Array<Array<{ x: number; y: number }>> = [
  [
    { x: 0, y: 0 }, { x: 0.012, y: 0 }, { x: 0.006, y: 0.0104 },
    { x: -0.006, y: 0.0104 }, { x: -0.012, y: 0 }, { x: -0.006, y: -0.0104 },
  ],
  [
    { x: -0.015, y: 0.006 }, { x: -0.009, y: -0.002 }, { x: -0.003, y: -0.008 },
    { x: 0.003, y: -0.01 }, { x: 0.009, y: -0.008 }, { x: 0.015, y: -0.004 },
  ],
  [
    { x: -0.015, y: 0 }, { x: -0.009, y: 0 }, { x: -0.003, y: 0 },
    { x: 0.003, y: 0 }, { x: 0.009, y: 0 }, { x: 0.015, y: 0 },
  ],
  [
    { x: 0, y: -0.012 }, { x: -0.011, y: 0.007 }, { x: 0.011, y: 0.007 },
    { x: 0, y: -0.004 }, { x: -0.005, y: 0.003 }, { x: 0.005, y: 0.003 },
  ],
  [
    { x: 0, y: 0 }, { x: 0.005, y: 0.004 }, { x: -0.005, y: 0.004 },
    { x: 0.005, y: -0.004 }, { x: -0.005, y: -0.004 }, { x: 0, y: 0.008 },
  ],
  [
    { x: -0.014, y: -0.008 }, { x: -0.008, y: -0.004 }, { x: -0.002, y: -0.002 },
    { x: 0.004, y: 0 }, { x: 0.01, y: 0.004 }, { x: 0.014, y: 0.01 },
  ],
];

// FNV-1a 32 位哈希（无符号）
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 馆内成员（灯）的确定性星阵偏移：按 hallId 哈希取 6 套固定预设之一，
 * 再截取前 clamp(lampCount, 1, 6) 个点位。
 * 同 hallId + 同 lampCount 必得同形；lampCount 增减只做前缀增减，星形基座不变。
 */
export function starOffsets(hallId: string, lampCount: number): Array<{ x: number; y: number }> {
  const preset = STAR_OFFSET_PRESETS[fnv1a(hallId) % STAR_OFFSET_PRESETS.length];
  const count = Math.min(6, Math.max(1, Math.floor(lampCount) || 1));
  return preset.slice(0, count).map((point) => ({ x: point.x, y: point.y }));
}

/**
 * 星群稳定排序：馆间次序只依赖 hallId（与 API 的 ORDER BY h.id ASC 同序），
 * 客户端对分片/翻页结果合并后重排仍稳定，不因数据到达顺序抖动。
 */
export function stableHallOrder(halls: Array<GardenSeaHall>): Array<GardenSeaHall> {
  return [...halls].sort((a, b) => (a.hallId < b.hallId ? -1 : a.hallId > b.hallId ? 1 : 0));
}

// ---- 择位模式（Task 6，墓园规格 §8.3 馆主亲手择位 / 13 号方案风险 C） ----
// active=true 仅由「我的」页择位入口（?placing=馆id）显式激活：普通浏览
// pointer down/up 只处理点击，绝不拖动星群；访客永远看不到择位 UI。
// 写入安全边界在服务端（PATCH /api/halls/[id]/garden-pos 鉴权馆主 + public）。
export type PlacementState = { hallId: string; active: true } | { active: false };

/**
 * 择位坐标归一化：钳制到 0–1 并保留 3 位小数（拖拽实时显示与发送前统一走这里，
 * 与 halls.garden_x/garden_y 的存储精度一致；NaN 回落 0）。
 * 钳制在先、舍入在后：边界值四舍五入不会越界（0.9996 → 1 而非 1.001）。
 */
export function roundPlacementPoint(x: number, y: number): { x: number; y: number } {
  const clamp = (v: number) => (Number.isNaN(v) ? 0 : Math.min(1, Math.max(0, v)));
  return { x: Math.round(clamp(x) * 1000) / 1000, y: Math.round(clamp(y) * 1000) / 1000 };
}
