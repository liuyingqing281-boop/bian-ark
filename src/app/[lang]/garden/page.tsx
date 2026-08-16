import { getDb } from "../../../lib/db";
import { defaultLocale, getDictionary, hasLocale } from "../dictionaries";
import RandomWalk from "../../../components/RandomWalk";
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
      `SELECT id, name, type, avatar_url, birth_date, death_date, garden_section, garden_slot, created_at,
         CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END AS is_new
       FROM memorials
       WHERE is_published = 1 AND visibility = 'public' AND in_garden = 1 AND name LIKE ?
       ORDER BY garden_slot ASC`
    )
    .all(`%${keyword}%`) as GardenMemorial[];

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
    <div className="ui-page py-10 sm:py-14">
      <div className="text-center mb-8">
        <h1 className="mb-2 text-3xl font-semibold leading-tight text-amber-300 md:text-4xl">{dict.garden.title}</h1>
        <p className="text-stone-500 text-sm">{dict.garden.subtitle}</p>
      </div>

      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        <form action={`/${lang}/garden`} method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={keyword}
            placeholder={dict.garden.searchPlaceholder}
            className="ui-control min-w-0 px-4 py-2 text-sm placeholder-stone-600"
          />
          <button type="submit" className="ui-button ui-button-primary px-4 py-2">
            {dict.garden.search}
          </button>
        </form>
        <RandomWalk ids={memorials.map((m) => m.id)} label={dict.garden.randomWalk} />
      </div>

      {memorials.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-6xl mb-6">🕯️</p>
          <p className="text-stone-500">{dict.garden.empty}</p>
        </div>
      ) : (
        <GardenViewSwitch
          sections={sections}
          newTodayText={newCount > 0 ? `${dict.garden.newToday}: ${newCount}` : ""}
          lang={lang}
          labels={{
            view3d: dict.garden.view3d,
            view2d: dict.garden.view2d,
            hint3d: dict.garden.hint3d,
          }}
        />
      )}
    </div>
  );
}
