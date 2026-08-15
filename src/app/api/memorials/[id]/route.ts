import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";

const EDITABLE_FIELDS = [
  "name",
  "type",
  "birth_date",
  "death_date",
  "epitaph",
  "biography",
  "avatar_url",
  "cover_url",
] as const;
const VISIBILITIES = new Set(["private", "group", "public"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const memorial = db.prepare("SELECT id, user_id FROM memorials WHERE id = ?").get(id) as
    | { id: string; user_id: string }
    | undefined;
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      db.prepare(`UPDATE memorials SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`).run(
        String(body[field] ?? "").slice(0, field === "biography" ? 10000 : 500),
        id
      );
    }
  }
  if ("visibility" in body) {
    if (!VISIBILITIES.has(body.visibility)) {
      return NextResponse.json({ error: "invalid_visibility" }, { status: 400 });
    }
    db.prepare("UPDATE memorials SET visibility = ?, updated_at = datetime('now') WHERE id = ?").run(
      body.visibility,
      id
    );
  }
  if (Array.isArray(body.group_ids)) {
    const myGroups = new Set(
      (
        db.prepare("SELECT group_id FROM group_members WHERE user_id = ?").all(user.id) as {
          group_id: string;
        }[]
      ).map((row) => row.group_id)
    );
    db.prepare("DELETE FROM memorial_groups WHERE memorial_id = ?").run(id);
    const insert = db.prepare("INSERT OR IGNORE INTO memorial_groups (memorial_id, group_id) VALUES (?, ?)");
    for (const groupId of body.group_ids) {
      if (typeof groupId === "string" && myGroups.has(groupId)) insert.run(id, groupId);
    }
  }
  return NextResponse.json({ ok: true });
}