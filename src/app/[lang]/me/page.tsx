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

  // 我的纪念聚合（同 /api/me/memorials 口径：创建/协作/纪念过，去重取最高优先关系）
  const myMemorialRows = db
    .prepare(
      `SELECT id, name, avatar_url, relation, last_at FROM (
         SELECT m.id, m.name, m.avatar_url, 'created' AS relation, m.created_at AS last_at
           FROM memorials m WHERE m.user_id = @uid AND m.is_published = 1
         UNION ALL
         SELECT m.id, m.name, m.avatar_url, 'collaborating' AS relation, gm.joined_at AS last_at
           FROM memorials m
           JOIN memorial_groups mg ON mg.memorial_id = m.id
           JOIN group_members gm ON gm.group_id = mg.group_id
           WHERE gm.user_id = @uid AND m.user_id != @uid AND m.is_published = 1
         UNION ALL
         SELECT m.id, m.name, m.avatar_url, 'tributed' AS relation, MAX(t.created_at) AS last_at
           FROM tributes t JOIN memorials m ON m.id = t.memorial_id
           WHERE t.user_id = @uid AND m.user_id != @uid AND m.is_published = 1
           GROUP BY m.id
       ) ORDER BY last_at DESC`
    )
    .all({ uid: user.id }) as { id: string; name: string; avatar_url: string; relation: string; last_at: string }[];
  const priority: Record<string, number> = { created: 0, collaborating: 1, tributed: 2 };
  const byId = new Map<string, (typeof myMemorialRows)[number]>();
  for (const r of myMemorialRows) {
    const e = byId.get(r.id);
    if (!e) byId.set(r.id, { ...r });
    else {
      if (priority[r.relation] < priority[e.relation]) e.relation = r.relation;
      if (r.last_at > e.last_at) e.last_at = r.last_at;
    }
  }
  const myMemorials = [...byId.values()].sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
  const relationLabel = (r: string) =>
    lang === "en"
      ? { created: "Created", collaborating: "Collaborating", tributed: "Remembered" }[r] ?? r
      : { created: "我创建的", collaborating: "协作中", tributed: "纪念过" }[r] ?? r;

  // 订单记录（一口价流水）
  const orders = db
    .prepare("SELECT id, kind, status, amount_cents, currency, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
    .all(user.id) as { id: string; kind: string; status: string; amount_cents: number; currency: string; created_at: string }[];
  const orderStatusLabel = (s: string) =>
    lang === "en" ? s : ({ paid: "已支付", pending: "待支付", refunded: "已退款" }[s] ?? s);
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
        <h2 className="text-sm tracking-widest text-amber-500">{lang === "en" ? "My Memorials" : "我的纪念"}</h2>
        {myMemorials.length === 0 ? (
          <p className="text-stone-600 text-sm py-4">{lang === "en" ? "No memorials yet." : "还没有纪念记录，去看看想 TA 的纪念馆吧。"}</p>
        ) : (
          <ul className="space-y-3">
            {myMemorials.map((m) => (
              <li key={m.id}>
                <a
                  href={`/${lang}/hall/${m.id}`}
                  className="flex items-center gap-3 bg-stone-900/60 border border-stone-800 rounded-xl p-4 hover:border-amber-700/50 transition"
                >
                  <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-lg overflow-hidden relative">
                    {m.avatar_url?.startsWith("/uploads/") ? (
                      <Image src={m.avatar_url} alt={m.name} fill className="object-cover" />
                    ) : (
                      m.avatar_url || "🕊️"
                    )}
                  </div>
                  <span className="text-stone-200 flex-1">{m.name}</span>
                  <span className="text-xs text-amber-500/80 border border-amber-800/50 rounded-full px-3 py-1">
                    {relationLabel(m.relation)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm tracking-widest text-amber-500">{lang === "en" ? "Orders" : "订单记录"}</h2>
        {orders.length === 0 ? (
          <p className="text-stone-600 text-sm py-4">{lang === "en" ? "No orders yet." : "还没有订单。"}</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between bg-stone-900/60 border border-stone-800 rounded-xl px-4 py-3 text-sm">
                <span className="text-stone-300">{o.kind}</span>
                <span className="text-stone-400">
                  ¥{(o.amount_cents / 100).toFixed(2)}
                  <span className="ml-3 text-stone-500">{orderStatusLabel(o.status)}</span>
                  <span className="ml-3 text-stone-600">{o.created_at?.slice(0, 10)}</span>
                </span>
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