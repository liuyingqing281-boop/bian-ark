import { redirect } from "next/navigation";
import Image from "next/image";
import { getSessionUser } from "../../../lib/auth";
import { getDb } from "../../../lib/db";
import { defaultLocale, getDictionary, hasLocale } from "../dictionaries";
import {
  LogoutButton,
  CreateMemorialForm,
  MemorialSettings,
  GroupsPanel,
  GroupInfo,
  MemorialInfo,
} from "../../../components/MePanels";

interface GrantRow {
  memorial_id: string;
  group_id: string;
}

export default async function MePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const dict = getDictionary(lang);
  const user = await getSessionUser();
  if (!user) redirect(`/${lang}/login`);

  const db = getDb();
  const memorials = db
    .prepare(
      "SELECT id, name, visibility, avatar_url, in_garden FROM memorials WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(user.id) as MemorialInfo[];
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.invite_code, gm.role,
         (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
       FROM groups g JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = ? ORDER BY g.created_at DESC`
    )
    .all(user.id) as GroupInfo[];
  const grants = db
    .prepare(
      "SELECT memorial_id, group_id FROM memorial_groups WHERE memorial_id IN (SELECT id FROM memorials WHERE user_id = ?)"
    )
    .all(user.id) as GrantRow[];
  const memorialTypes = Object.fromEntries(
    Object.entries(dict.types).filter(([key]) => key !== "all")
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl tracking-widest text-amber-300">{dict.me.title}</h1>
          <p className="text-stone-500 text-sm mt-1">
            {user.name || "—"}
            <span className="ml-3 text-stone-600">{user.email || user.phone || ""}</span>
          </p>
        </div>
        <LogoutButton labels={dict.me} />
      </div>

      <section className="space-y-4">
        <h2 className="text-sm tracking-widest text-amber-500">{dict.me.myMemorials}</h2>
        <CreateMemorialForm labels={dict.me} types={memorialTypes} />
        {memorials.length === 0 ? (
          <p className="text-stone-600 text-sm py-4">{dict.me.noMemorials}</p>
        ) : (
          <ul className="space-y-3">
            {memorials.map((memorial) => (
              <li key={memorial.id} className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-lg overflow-hidden relative">
                    {memorial.avatar_url?.startsWith("/uploads/") ? (
                      <Image src={memorial.avatar_url} alt={memorial.name} fill className="object-cover" />
                    ) : (
                      memorial.avatar_url || "🕊️"
                    )}
                  </div>
                  <span className="text-stone-200">{memorial.name}</span>
                </div>
                <MemorialSettings
                  lang={lang}
                  memorial={memorial}
                  groups={groups}
                  granted={grants.filter((g) => g.memorial_id === memorial.id).map((g) => g.group_id)}
                  labels={dict.me}
                  gardenLabels={{ place: dict.garden.place, remove: dict.garden.remove, needPublic: dict.garden.needPublic }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm tracking-widest text-amber-500">{dict.me.myGroups}</h2>
        <GroupsPanel lang={lang} groups={groups} labels={dict.me} />
      </section>
    </div>
  );
}