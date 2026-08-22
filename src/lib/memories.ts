import { v4 as uuid } from "uuid";
import { getDb } from "./db";
import type { MemorialAccessRow } from "./permissions";

export const MEMORY_SECTIONS = ["personality", "relation", "likes", "speech", "profile"] as const;
export type MemorySection = (typeof MEMORY_SECTIONS)[number];

export const MAX_MEMORY_LENGTH = 500;

export interface MemoryRow {
  id: string;
  memorial_id: string;
  user_id: string;
  section: string;
  content: string;
  source: string;
  review_status: string;
  review_reason: string;
  created_at: string;
  updated_at: string;
}

export function isMemorySection(value: unknown): value is MemorySection {
  return typeof value === "string" && (MEMORY_SECTIONS as readonly string[]).includes(value);
}

export function getMemorialForAccess(memorialId: string): MemorialAccessRow | undefined {
  return getDb()
    .prepare("SELECT id, user_id, visibility FROM memorials WHERE id = ? AND is_published = 1")
    .get(memorialId) as MemorialAccessRow | undefined;
}

// 馆主或亲友协作人（经 memorial_groups 关联的群组成员）
export function canManageMemorial(memorial: MemorialAccessRow, userId: string | null): boolean {
  if (!userId) return false;
  if (memorial.user_id === userId) return true;
  const row = getDb()
    .prepare(
      `SELECT 1 AS ok FROM memorial_groups mg
       JOIN group_members gm ON gm.group_id = mg.group_id
       WHERE mg.memorial_id = ? AND gm.user_id = ? LIMIT 1`
    )
    .get(memorial.id, userId);
  return !!row;
}

export function listMemories(memorialId: string): MemoryRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM memories
       WHERE memorial_id = ? AND review_status != 'rejected'
       ORDER BY created_at ASC, id ASC`
    )
    .all(memorialId) as MemoryRow[];
}

export function getMemory(id: string): MemoryRow | undefined {
  return getDb().prepare("SELECT * FROM memories WHERE id = ?").get(id) as MemoryRow | undefined;
}

export function createMemory(input: {
  memorial_id: string;
  user_id: string;
  section: MemorySection;
  content: string;
  source: string;
  review_status: string;
  review_reason: string;
}): string {
  const id = uuid();
  getDb()
    .prepare(
      `INSERT INTO memories (id, memorial_id, user_id, section, content, source, review_status, review_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.memorial_id,
      input.user_id,
      input.section,
      input.content,
      input.source,
      input.review_status,
      input.review_reason
    );
  return id;
}

export function updateMemory(id: string, content: string): void {
  getDb()
    .prepare("UPDATE memories SET content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(content, id);
}

export function deleteMemory(id: string): void {
  getDb().prepare("DELETE FROM memories WHERE id = ?").run(id);
}
