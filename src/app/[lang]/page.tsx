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
  const memorials = getMemorials(currentFilter, user?.id ?? null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
        {/* 装饰分隔 */}
        <div className="flex items-center justify-center gap-3 mb-6 opacity-60">
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-800/60" />
          <span className="text-2xl">🕯️</span>
          <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-800/60" />
        </div>
        <h1 className="text-4xl md:text-5xl tracking-widest text-amber-300 mb-4 drop-shadow-[0_0_20px_rgba(217,119,6,0.15)]">{dict.home.title}</h1>
        <p className="text-stone-500 text-sm tracking-[0.15em] max-w-xl mx-auto leading-relaxed">{dict.home.subtitle}</p>
      </div>

      <div className="flex justify-center gap-2 mb-12 flex-wrap">
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

      {memorials.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-6xl mb-6">🕯️</p>
          <p className="text-stone-500 text-lg">{dict.home.emptyTitle}</p>
          <Link
            href={user ? `/${lang}/me` : `/${lang}/login`}
            className="inline-block mt-6 px-6 py-2 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded-lg transition text-sm"
          >
            {dict.home.emptyCta}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {memorials.map((m) => (
            <Link
              key={m.id}
              href={`/${lang}/memorial/${m.id}`}
              className="group block bg-stone-900 border border-stone-800 rounded-xl p-6 hover:border-amber-700/50 hover:bg-stone-800/80 transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-stone-800 flex items-center justify-center text-2xl overflow-hidden group-hover:ring-2 relative ring-amber-600/50 transition">
                  {m.avatar_url?.startsWith("/uploads/") ? (
                    <Image src={m.avatar_url} alt={m.name} fill className="object-cover" />
                  ) : (
                    m.avatar_url || (m.type === "pet" ? "🐾" : "🕊️")
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg text-stone-200 group-hover:text-amber-300 transition truncate">
                    {m.name}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {m.birth_date || "?"} ~ {m.death_date || "?"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-stone-400 line-clamp-2 italic">
                {m.epitaph || dict.home.defaultEpitaph}
              </p>
              <div className="flex gap-2 mt-3">
                {m.is_featured === 1 && (
                  <span className="text-xs text-amber-600 bg-amber-950/50 px-2 py-0.5 rounded">
                    {dict.home.featured}
                  </span>
                )}
                {m.visibility && m.visibility !== "public" && (
                  <span className="text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded">
                    {dict.me[m.visibility === "group" ? "visGroup" : "visPrivate"]}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}