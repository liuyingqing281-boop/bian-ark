"use client";

// 星群（馆级渲染单元，墓园规格 §8）：一座公共馆 = 一个星群。
// - lampCount 1 → 孤星；2–6 → starOffsets 确定性星阵（Task 3 冻结，无随机源）。
// - 外层 button 即热区（CSS 保证 ≥44×44px），aria-label = 脱敏馆名 + 人数。
// - candleLit 暖橙高亮 / 低亮冷白；zone=official 仅 brightness 一个 token 略亮。
// - 定位只用 left/top 百分比 + 场景 camera transform，绝不参与 flex/grid 重排。
// - 名牌只显示 nameMasked；全景下不逐灯渲染姓名。

import type { GardenSeaHall } from "../../lib/garden-sea";
import { starOffsets } from "../../lib/garden-sea";

// starOffsets 归一化偏移 → 热区内像素：±0.02 × 800 ≈ ±16px，收在 48px 热区内
const STAR_SPREAD_PX = 800;

export interface StarClusterLabels {
  membersUnit: string; // "位亲人" / "family members"
}

interface StarClusterProps {
  hall: GardenSeaHall;
  matched: boolean;
  focused: boolean;
  labels: StarClusterLabels;
  onSelect: (hallId: string) => void;
  onEnter: (hallId: string) => void;
}

export default function StarCluster({ hall, matched, focused, labels, onSelect, onEnter }: StarClusterProps) {
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
      style={{ left: `${hall.x * 100}%`, top: `${hall.y * 100}%` }}
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
            }}
          />
        ))}
      </span>
      <span className="starsea-name">{hall.nameMasked}</span>
    </button>
  );
}
