import { getDb } from "./db";

export interface MemorialAccessRow {
  id: string;
  user_id: string;
  visibility: string;
}

export function canViewMemorial(memorial: MemorialAccessRow, userId: string | null): boolean {
  const visibility = memorial.visibility || "public";
  if (visibility === "public") return true;
  if (!userId) return false;
  if (memorial.user_id === userId) return true;
  if (visibility === "group") {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT 1 AS ok FROM memorial_groups mg
         JOIN group_members gm ON gm.group_id = mg.group_id
         WHERE mg.memorial_id = ? AND gm.user_id = ? LIMIT 1`
      )
      .get(memorial.id, userId);
    return !!row;
  }
  return false;
}

export function canTributeMemorial(memorial: MemorialAccessRow, userId: string | null): boolean {
  const visibility = memorial.visibility || "public";
  if (visibility === "public") return true;
  if (!userId) return false;
  return canViewMemorial(memorial, userId);
}

export function ownsMemorial(memorial: MemorialAccessRow, userId: string | null): boolean {
  return !!userId && memorial.user_id === userId;
}

export function groupRole(groupId: string, userId: string): "owner" | "member" | null {
  const row = getDb().prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?").get(groupId, userId) as
    | { role: "owner" | "member" }
    | undefined;
  return row?.role || null;
}

export function ownsGroup(groupId: string, userId: string): boolean {
  return groupRole(groupId, userId) === "owner";
}
