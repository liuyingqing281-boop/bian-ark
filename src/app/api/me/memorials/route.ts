import { NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";

// 我的纪念聚合（G8，P2）：我创建的 / 协作的 / 纪念过的纪念馆，去重后按最近动态倒序
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const items = db
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
       )
       ORDER BY last_at DESC`
    )
    .all({ uid: user.id });

  // 同一纪念馆可能同时命中多种关系，合并为一条（保留最高优先：created > collaborating > tributed）
  const priority = { created: 0, collaborating: 1, tributed: 2 } as const;
  const merged = new Map<string, { id: string; name: string; avatar_url: string; relation: string; relations: string[]; last_at: string }>();
  for (const row of items as { id: string; name: string; avatar_url: string; relation: keyof typeof priority; last_at: string }[]) {
    const existing = merged.get(row.id);
    if (!existing) {
      merged.set(row.id, { ...row, relations: [row.relation] });
    } else {
      existing.relations.push(row.relation);
      if (priority[row.relation] < priority[existing.relation as keyof typeof priority]) existing.relation = row.relation;
      if (row.last_at > existing.last_at) existing.last_at = row.last_at;
    }
  }

  const list = [...merged.values()].sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
  return NextResponse.json({ total: list.length, items: list });
}
