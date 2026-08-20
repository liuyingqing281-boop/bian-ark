import { getDb } from "../../../lib/db";
import { defaultLocale, getDictionary, hasLocale } from "../dictionaries";
import GardenViewSwitch from "../../../components/GardenViewSwitch";
import type { GardenRow, GardenSectionData } from "../../../components/GardenScene";

interface GardenMemorial extends GardenRow {
  garden_section: string;
  garden_slot: number;
  created_at: string;
}

export default async function GardenPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const dict = getDictionary(lang);
  const { q } = await searchParams;
  const keyword = (q || "").trim().slice(0, 40);

  const db = getDb();
  const memorials = db
    .prepare(
       `SELECT id, name, type, avatar_url, birth_date, death_date, epitaph, garden_section, garden_slot, created_at,
         CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END AS is_new
       FROM memorials
       WHERE is_published = 1 AND visibility = 'public' AND in_garden = 1
       ORDER BY garden_slot ASC`
    )
    .all() as GardenMemorial[];

  const sectionNames = dict.garden.sections;
  const sectionLabel = (key: string) =>
    sectionNames[Number(key)] ?? sectionNames[sectionNames.length - 1] ?? key;

  const grouped = new Map<string, GardenRow[]>();
  for (const memorial of memorials) {
    const key = memorial.garden_section || "0";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(memorial);
  }
  const sections: GardenSectionData[] = [...grouped.entries()].map(([key, rows]) => ({
    key,
    label: sectionLabel(key),
    rows,
  }));
  const newCount = memorials.filter((m) => m.is_new === 1).length;

  return (
    <div className="garden-page">

      <GardenViewSwitch
          sections={sections}
          initialQuery={keyword}
          newTodayText={newCount > 0 ? `${dict.garden.newToday}: ${newCount}` : ""}
          lang={lang}
          labels={{
            view3d: dict.garden.view3d,
            view2d: dict.garden.view2d,
            hint3d: dict.garden.hint3d,
            search: dict.garden.search,
            searchPlaceholder: dict.garden.searchPlaceholder,
            subtitle: dict.garden.subtitle,
            title: dict.garden.title,
            randomWalk: dict.garden.randomWalk,
            detail: "查看详情",
            offer: "供奉",
            back: "返回列表",
            noResult: dict.garden.empty,
          }}
        />
    </div>
  );
}
