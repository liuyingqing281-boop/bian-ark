import Link from "next/link";
import Image from "next/image";
import { getDb } from "../../lib/db";
import { getSessionUser } from "../../lib/auth";
import { defaultLocale, getDictionary, hasLocale } from "./dictionaries";

interface Memorial {
  id: string;
  name: string;
  type: string;
  avatar_url: string;
  epitaph: string;
  birth_date: string;
  death_date: string;
  is_featured: number;
  visibility: string;
}

function getMemorials(typeFilter: string, userId: string | null): Memorial[] {
  const db = getDb();
  const params: string[] = [];
  let query: string;
  if (userId) {
    query = `SELECT DISTINCT m.* FROM memorials m
      LEFT JOIN memorial_groups mg ON mg.memorial_id = m.id
      LEFT JOIN group_members gm ON gm.group_id = mg.group_id AND gm.user_id = ?
      WHERE m.is_published = 1
        AND (m.visibility = 'public' OR m.user_id = ? OR (m.visibility = 'group' AND gm.user_id IS NOT NULL))`;
    params.push(userId, userId);
  } else {
    query = "SELECT * FROM memorials WHERE is_published = 1 AND visibility = 'public'";
  }
  if (typeFilter && typeFilter !== "all") {
    query += userId ? " AND m.type = ?" : " AND type = ?";
    params.push(typeFilter);
  }
  query += userId
    ? " ORDER BY m.is_featured DESC, m.created_at DESC"
    : " ORDER BY is_featured DESC, created_at DESC";
  return db.prepare(query).all(...params) as Memorial[];
}

function MemorialCard({ m, lang, dict }: { m: Memorial; lang: string; dict: ReturnType<typeof getDictionary> }) {
  return (
    <Link
      href={`/${lang}/memorial/${m.id}`}
      className="ui-panel group block min-w-0 p-5 transition-colors hover:border-amber-700/60 hover:bg-stone-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      <div className="mb-4 flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-stone-800 ring-1 ring-stone-700 transition group-hover:ring-2 group-hover:ring-amber-600/60">
          {m.avatar_url?.startsWith("/uploads/") ? (
            <Image src={m.avatar_url} alt={m.name} fill sizes="56px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-2xl" aria-hidden>
              {m.avatar_url || (m.type === "pet" ? "🐾" : "🕊️")}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-lg text-stone-200 transition group-hover:text-amber-300">{m.name}</h3>
          <p className="text-xs text-stone-500">{m.birth_date || "?"} ~ {m.death_date || "?"}</p>
        </div>
      </div>
      <p className="line-clamp-2 min-h-11 text-sm italic leading-6 text-stone-400">{m.epitaph || dict.home.defaultEpitaph}</p>
      <div className="mt-3 flex min-h-5 flex-wrap gap-2">
        {m.is_featured === 1 && <span className="rounded bg-amber-950/60 px-2 py-0.5 text-xs text-amber-500">{dict.home.featured}</span>}
        {m.visibility && m.visibility !== "public" && <span className="rounded bg-stone-800 px-2 py-0.5 text-xs text-stone-500">{dict.me[m.visibility === "group" ? "visGroup" : "visPrivate"]}</span>}
      </div>
    </Link>
  );
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const dict = getDictionary(lang);
  const { filter } = await searchParams;
  const currentFilter = filter || "all";
  const user = await getSessionUser();
  let memorials: Memorial[] = [];
  let loadFailed = false;
  try {
    memorials = getMemorials(currentFilter, user?.id ?? null);
  } catch {
    loadFailed = true;
  }
  const featured = memorials.filter((m) => m.is_featured === 1).slice(0, 3);
  const recent = memorials.filter((m) => !featured.some((item) => item.id === m.id)).slice(0, 6);
  const display = featured.length ? featured : memorials.slice(0, 3);

  return (
    <div className="ui-page pb-16 pt-10 sm:pb-24 sm:pt-14">
      <section className="relative z-10 mx-auto max-w-3xl pb-12 text-center sm:pb-16">
        <div className="mb-5 flex items-center justify-center gap-3 opacity-70">
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-800/60" />
          <span className="text-2xl">🕯️</span>
          <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-800/60" />
        </div>
        <h1 className="mx-auto mb-4 max-w-3xl text-4xl font-semibold leading-tight text-amber-300 md:text-5xl">{dict.home.title}</h1>
        <p className="mx-auto mb-3 max-w-xl text-base leading-7 text-stone-300">{dict.home.subtitle}</p>
        <p className="mx-auto max-w-2xl text-sm leading-7 text-stone-500">{dict.home.intro}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href={`/${lang}/garden`} className="ui-button ui-button-primary px-5 py-2.5">{dict.home.exploreGarden}</Link>
          <Link href={user ? `/${lang}/me` : `/${lang}/login`} className="ui-button border border-stone-700 bg-stone-900/70 px-5 py-2.5 text-stone-200 hover:border-amber-700 hover:text-amber-300">{dict.home.createMemorial}</Link>
        </div>
      </section>

      <div className="relative z-10 mb-12 flex flex-wrap justify-center gap-2">
        {Object.entries(dict.types).map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? `/${lang}` : `/${lang}?filter=${key}`}
            className={`px-5 py-2 rounded-full text-sm transition ${
              currentFilter === key
                ? "bg-amber-700 text-amber-100"
                : "bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {loadFailed ? (
        <div className="ui-panel relative z-10 mx-auto max-w-xl py-16 text-center">
          <p className="mb-3 text-4xl">🕯️</p>
          <p className="text-lg text-stone-200">{dict.home.errorTitle}</p>
          <p className="mt-2 text-sm text-stone-500">{dict.home.errorDesc}</p>
          <Link href={`/${lang}`} className="ui-button ui-button-primary mt-6 inline-flex px-5 py-2">{dict.home.retry}</Link>
        </div>
      ) : memorials.length === 0 ? (
        <div className="ui-panel relative z-10 mx-auto max-w-xl py-16 text-center">
          <p className="text-6xl mb-6">🕯️</p>
          <p className="text-stone-500 text-lg">{dict.home.emptyTitle}</p>
          <Link
            href={user ? `/${lang}/me` : `/${lang}/login`}
            className="ui-button ui-button-primary mt-6 inline-flex px-6 py-2"
          >
            {dict.home.emptyCta}
          </Link>
        </div>
      ) : (
        <>
          <section className="relative z-10 ui-section" aria-labelledby="featured-title">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div><h2 id="featured-title" className="text-2xl font-semibold text-stone-100">{dict.home.featuredTitle}</h2><p className="mt-1 text-sm text-stone-500">{dict.home.featuredDesc}</p></div>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">{display.map((m) => <MemorialCard key={m.id} m={m} lang={lang} dict={dict} />)}</div>
          </section>
          {recent.length > 0 && <section className="relative z-10 ui-section" aria-labelledby="recent-title">
            <div className="mb-5"><h2 id="recent-title" className="text-2xl font-semibold text-stone-100">{dict.home.recentTitle}</h2><p className="mt-1 text-sm text-stone-500">{dict.home.recentDesc}</p></div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{recent.map((m) => <MemorialCard key={m.id} m={m} lang={lang} dict={dict} />)}</div>
          </section>}
        </>
      )}

      <section className="ui-panel relative z-10 mt-14 flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <div><p className="ui-section-title">{dict.garden.title}</p><h2 className="mt-2 text-2xl font-semibold text-stone-100">{dict.garden.subtitle}</h2></div>
        <Link href={`/${lang}/garden`} className="ui-button ui-button-primary shrink-0 px-5 py-2.5">{dict.home.exploreGarden}</Link>
      </section>
    </div>
  );
}
