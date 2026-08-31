import { defaultLocale, hasLocale } from "../dictionaries";
import GardenSea from "../../../components/starsea/GardenSea";

// 星海页（Task 3 输入切换）：不再服务端查询 memorials/garden_slot 渲染墓园卡片，
// 只合法化初始搜索词（trim + 截 40）并注入 GardenSea 客户端控制器；
// 星海数据由客户端按视口调用 /api/garden/starsea（Task 4 实现）。
// 沉浸壳（starsea-shell > starsea-scene）保留在本服务端组件：
// Task 2 的壳层契约（tests/e2e/starsea.spec.ts）以此边界为准，场景内容归 GardenSea。
export default async function GardenPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const { q } = await searchParams;
  const keyword = (q || "").trim().slice(0, 40);

  return (
    <div className="starsea-shell">
      <div className="starsea-scene">
        <GardenSea lang={lang} initialQuery={keyword} />
      </div>
    </div>
  );
}
