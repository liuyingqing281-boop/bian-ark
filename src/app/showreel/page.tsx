import ShowreelPlayer from "../../components/showreel/ShowreelPlayer";
import Showreel10Player from "../../components/showreel/Showreel10Player";

/**
 * /showreel —— 彼岸产品 Showreel
 * 默认 30s @ 30fps 完整版；?cut=秒数 为精剪版（分段非线性重映射，如 ?cut=10 / ?cut=12.5）
 * ?v=10 为 10s 星海版（原生 300 帧新片：星海/灯阵/语音/合祭）
 * 独立于 [lang] 体系（proxy.ts 直通），沉浸式全暗舞台
 */
export default async function ShowreelPage({
  searchParams,
}: {
  searchParams: Promise<{ cut?: string; v?: string }>;
}) {
  const { cut, v } = await searchParams;
  if (v === "10") return <Showreel10Player />;
  const secs = Number(cut);
  const outTotal = cut && Number.isFinite(secs) && secs > 0 ? Math.round(secs * 30) : 900;
  return <ShowreelPlayer outTotal={outTotal} />;
}
