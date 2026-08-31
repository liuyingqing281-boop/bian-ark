"use client";

// 星群（馆级渲染单元，墓园规格 §8）：一座公共馆 = 一个星群。
// - lampCount 1 → 孤星；2–6 → starOffsets 确定性星阵（Task 3 冻结，无随机源）。
// - 外层 button 即热区：hotZoneCssPx 反向缩放保证镜头缩小后屏幕有效热区 ≥44px
//   （Task 8 携项 c：2.5D 按钮处于 camera transform 内，CSS 尺寸需按 1/scale 放大）。
// - candleLit 暖橙高亮 / 低亮冷白；zone=official 仅 brightness 一个 token 略亮。
// - 定位只用 left/top 百分比 + 场景 camera transform，绝不参与 flex/grid 重排。
// - 名牌只显示 nameMasked；全景下不逐灯渲染姓名。
// - 完整动效档星光微闪烁（Task 8 规格 §6；相位由索引/馆 id 长度确定性推导，
//   无随机源；简化/静态档由 .starsea-motion-root[data-motion] 关闭）。
// - memo：镜头平移/缩放只改场景层，星群 props 不变时跳过重渲染（Task 8 性能）。

import { memo } from "react";
import type { GardenSeaHall } from "../../lib/garden-sea";
import { starOffsets } from "../../lib/garden-sea";

// starOffsets 归一化偏移 → 热区内像素：±0.02 × 800 ≈ ±16px，收在 48px 热区内
const STAR_SPREAD_PX = 800;

// ---- Task 8 LOD 阈值与热区反向缩放（StarSeaScene 2.5D / StarSea3D overlay 共用） ----
/** 镜头缩放低于该值进入远景档：光晕粒子 + 聚合数量，不渲染星群按钮与名牌（规格 §8.5） */
export const LOD_FAR_SCALE = 0.6;
/**
 * 2.5D 星群热区 CSS 尺寸（处于 camera transform 内，屏幕有效尺寸 = css × scale）：
 * 下限保证屏幕 ≥44px（45/scale，多留 1px 吸收浏览器亚像素取整），上限与
 * 3D overlay 热区帽一致（屏幕 ≤96px），scale=1 时为默认 48px。
 * scale<0.92 时 48×scale<44，必须反向放大（Task 8 携项 c）。
 */
export function hotZoneCssPx(scale: number): number {
  return Math.min(96 / scale, Math.max(48, 45 / scale));
}

export interface StarClusterLabels {
  membersUnit: string; // "位亲人" / "family members"
}

interface StarClusterProps {
  hall: GardenSeaHall;
  matched: boolean;
  focused: boolean;
  /** 热区 CSS 尺寸（px）：2.5D 传入反向缩放值 hotZoneCssPx(scale)，缺省 48 */
  sizePx?: number;
  labels: StarClusterLabels;
  onSelect: (hallId: string) => void;
  onEnter: (hallId: string) => void;
}

const StarCluster = memo(function StarCluster({
  hall,
  matched,
  focused,
  sizePx = 48,
  labels,
  onSelect,
  onEnter,
}: StarClusterProps) {
  const offsets = starOffsets(hall.hallId, hall.lampCount);
  const classes = [
    "starsea-cluster",
    hall.candleLit ? "is-lit" : "is-cold",
    hall.zone === "official" ? "is-official" : "",
    matched ? "" : "is-dimmed",
    focused ? "is-focused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      data-hall-id={hall.hallId}
      data-zone={hall.zone}
      style={{ left: `${hall.x * 100}%`, top: `${hall.y * 100}%`, width: sizePx, height: sizePx }}
      aria-label={`${hall.nameMasked}，${hall.lampCount} ${labels.membersUnit}`}
      onClick={() => onSelect(hall.hallId)}
      onDoubleClick={() => onEnter(hall.hallId)}
      onKeyDown={(event) => {
        // Enter 直接进馆（须先完成可见聚焦，控制器负责时序）；Space 走详情
        if (event.key === "Enter") {
          event.preventDefault();
          onEnter(hall.hallId);
        }
      }}
    >
      <span className="starsea-starfield" aria-hidden="true">
        {offsets.map((point, index) => (
          <span
            key={index}
            className="starsea-dot"
            style={{
              left: `calc(50% + ${(point.x * STAR_SPREAD_PX).toFixed(1)}px)`,
              top: `calc(50% + ${(point.y * STAR_SPREAD_PX).toFixed(1)}px)`,
              animationDelay: `${(((index * 0.73 + hall.hallId.length * 0.11) % 2.8)).toFixed(2)}s`,
            }}
          />
        ))}
      </span>
      <span className="starsea-name">{hall.nameMasked}</span>
    </button>
  );
});
export default StarCluster;
