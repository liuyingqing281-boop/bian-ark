import type Database from "better-sqlite3";

export function mergeUsers(db: Database.Database, sourceUserId: string, targetUserId: string): void {
  if (sourceUserId === targetUserId) return;
  db.transaction(() => {
    db.prepare("UPDATE memorials SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE media SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE life_events SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE digital_humans SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE dh_redo_credits SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE customizations SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE items SET owner_user_id = ? WHERE owner_user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE groups SET owner_user_id = ? WHERE owner_user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) SELECT group_id, ?, role, joined_at FROM group_members WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("DELETE FROM group_members WHERE user_id = ?").run(sourceUserId);
    db.prepare("UPDATE orders SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE membership_history SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE ai_generation_jobs SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("UPDATE data_requests SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("DELETE FROM ai_quotas WHERE user_id = ? AND EXISTS (SELECT 1 FROM ai_quotas q WHERE q.user_id = ? AND q.month = ai_quotas.month)").run(sourceUserId, targetUserId);
    db.prepare("UPDATE ai_quotas SET user_id = ? WHERE user_id = ?").run(targetUserId, sourceUserId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(sourceUserId);
    db.prepare("DELETE FROM users WHERE id = ?").run(sourceUserId);
  })();
}
