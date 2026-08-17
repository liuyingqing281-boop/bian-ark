import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/auth";
import { deleteUpload } from "../../../../lib/upload";
import { moderateText } from "../../../../lib/moderation";
import { trackEvent } from "../../../../lib/events";

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
const MEMORIAL_TYPES = new Set(["person", "pet"]);
const LIMITS: Record<(typeof EDITABLE_FIELDS)[number], number> = {
  name: 80,
  type: 20,
  birth_date: 20,
  death_date: 20,
  epitaph: 300,
  biography: 10000,
  avatar_url: 500,
  cover_url: 500,
};

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

  const changes: Record<string, string> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in body)) continue;
    const value = String(body[field] ?? "").trim();
    if (value.length > LIMITS[field]) {
      return NextResponse.json({ error: "field_too_long", field, limit: LIMITS[field] }, { status: 400 });
    }
    if (field === "name" && !value) return NextResponse.json({ error: "name_required" }, { status: 400 });
    if (field === "type" && !MEMORIAL_TYPES.has(value)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    changes[field] = value;
  }
  if ("visibility" in body) {
    if (!VISIBILITIES.has(body.visibility)) {
      return NextResponse.json({ error: "invalid_visibility" }, { status: 400 });
    }
    changes.visibility = body.visibility;
  }
  const moderation = await moderateText(
    [changes.name, changes.epitaph, changes.biography].filter(Boolean).join(" ")
  );
  if (!moderation.pass) return NextResponse.json({ error: "content_blocked" }, { status: 400 });

  const auditDetail: Record<string, unknown> = { fields: Object.keys(changes) };
  const update = db.transaction(() => {
    for (const [field, value] of Object.entries(changes)) {
      db.prepare(`UPDATE memorials SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`).run(value, id);
    }
    if (Array.isArray(body.group_ids)) {
      const myGroups = new Set(
        (db.prepare("SELECT group_id FROM group_members WHERE user_id = ?").all(user.id) as { group_id: string }[])
          .map((row) => row.group_id)
      );
      const requested = body.group_ids.filter((groupId: unknown): groupId is string => typeof groupId === "string");
      if (requested.some((groupId: string) => !myGroups.has(groupId))) throw new Error("invalid_group");
      db.prepare("DELETE FROM memorial_groups WHERE memorial_id = ?").run(id);
      const insert = db.prepare("INSERT OR IGNORE INTO memorial_groups (memorial_id, group_id) VALUES (?, ?)");
      for (const groupId of requested) insert.run(id, groupId);
      auditDetail.group_ids = requested;
    }
    db.prepare(
      "INSERT INTO memorial_audit_logs (memorial_id, actor_user_id, action, detail) VALUES (?, ?, 'update', ?)"
    ).run(id, user.id, JSON.stringify(auditDetail));
  });
  try {
    update();
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_group") {
      return NextResponse.json({ error: "invalid_group" }, { status: 400 });
    }
    throw error;
  }
  // 馆主把纪念馆授权给群组 = 漏斗第二环「发起邀请/共享」
  if (Array.isArray(body.group_ids)) {
    trackEvent("memorial_shared", { memorial_id: id, groups: (auditDetail.group_ids as string[]).length }, user.id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getDb();
  const memorial = db.prepare("SELECT user_id, avatar_url, cover_url FROM memorials WHERE id = ?").get(id) as
    | { user_id: string; avatar_url: string; cover_url: string }
    | undefined;
  if (!memorial) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (memorial.user_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const media = db.prepare("SELECT url, thumb_url FROM media WHERE memorial_id = ?").all(id) as Array<{ url: string; thumb_url: string }>;
  const humans = db.prepare(
    "SELECT photo_url, audio_url, video_url, result_video_url FROM digital_humans WHERE memorial_id = ?"
  ).all(id) as Array<{ photo_url: string; audio_url: string; video_url: string; result_video_url: string }>;
  const remove = db.transaction(() => {
    db.prepare("DELETE FROM dh_redo_credits WHERE memorial_id = ?").run(id);
    db.prepare("DELETE FROM digital_humans WHERE memorial_id = ?").run(id);
    db.prepare("DELETE FROM tributes WHERE memorial_id = ?").run(id);
    db.prepare("DELETE FROM media WHERE memorial_id = ?").run(id);
    db.prepare("DELETE FROM life_events WHERE memorial_id = ?").run(id);
    db.prepare("DELETE FROM memorial_groups WHERE memorial_id = ?").run(id);
    db.prepare("DELETE FROM customizations WHERE memorial_id = ?").run(id);
    db.prepare("DELETE FROM memorials WHERE id = ?").run(id);
    db.prepare(
      "INSERT INTO memorial_audit_logs (memorial_id, actor_user_id, action, detail) VALUES (?, ?, 'delete', '{}')"
    ).run(id, user.id);
  });
  remove();
  const urls = new Set([memorial.avatar_url, memorial.cover_url]);
  for (const item of media) { urls.add(item.url); urls.add(item.thumb_url); }
  for (const task of humans) Object.values(task).forEach((url) => urls.add(url));
  for (const url of urls) deleteUpload(url);
  return NextResponse.json({ ok: true });
}
