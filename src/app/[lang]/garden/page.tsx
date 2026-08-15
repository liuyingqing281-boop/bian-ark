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
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl tracking-widest text-amber-300 mb-2">{dict.garden.title}</h1>
        <p className="text-stone-500 text-sm">{dict.garden.subtitle}</p>
      </div>

      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        <form action={`/${lang}/garden`} method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={keyword}
            placeholder={dict.garden.searchPlaceholder}
            className="bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-sm text-stone-300 placeholder-stone-600 focus:outline-none focus:border-amber-700"
          />
          <button type="submit" className="px-4 py-2 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded-lg transition text-sm">
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