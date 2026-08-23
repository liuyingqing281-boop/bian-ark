import ShowreelPlayer from "../../components/showreel/ShowreelPlayer";

/**
 * /showreel —— 彼岸产品 Showreel
 * 默认 30s @ 30fps 完整版；?cut=秒数 为精剪版（分段非线性重映射，如 ?cut=10 / ?cut=12.5）
 * 独立于 [lang] 体系（proxy.ts 直通），沉浸式全暗舞台
 */
export default async function ShowreelPage({
  searchParams,
}: {
  searchParams: Promise<{ cut?: string }>;
}) {
  const { cut } = await searchParams;
  const secs = Number(cut);
  const outTotal = cut && Number.isFinite(secs) && secs > 0 ? Math.round(secs * 30) : 900;
  return <ShowreelPlayer outTotal={outTotal} />;
}
