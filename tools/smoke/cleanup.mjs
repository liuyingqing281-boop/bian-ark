import fs from "node:fs";
import path from "node:path";

const UPLOAD_ROOT = path.resolve(process.cwd(), "data", "uploads");

export function createResourceRegistry(suite, runId) {
  return {
    suite,
    runId,
    userIds: new Set(),
    userEmails: new Set(),
    memorialIds: new Set(),
    groupIds: new Set(),
    itemIds: new Set(),
    taskIds: new Set(),
    uploadUrls: new Set(),
    register(type, value) {
      if (value !== undefined && value !== null && value !== "") this[type]?.add(String(value));
      return value;
    },
    registerUser(email, id) {
      if (email) this.userEmails.add(String(email));
      if (id) this.userIds.add(String(id));
      return id;
    },
  };
}

export function registerUpload(resources, ...urls) {
  for (const url of urls) resources.register("uploadUrls", url);
}

function ids(set) {
  return [...set];
}

function placeholders(values) {
  return values.map(() => "?").join(", ");
}

function deleteWhere(db, table, column, values) {
  const list = ids(values);
  if (!list.length) return;
  db.prepare(`DELETE FROM ${table} WHERE ${column} IN (${placeholders(list)})`).run(...list);
}

function safeUploadPath(url) {
  if (typeof url !== "string" || !url.startsWith("/uploads/") || url.includes("\\")) return null;
  let pathname;
  try {
    const parsed = new URL(url, "http://smoke.local");
    pathname = decodeURIComponent(parsed.pathname);
    if (parsed.origin !== "http://smoke.local" || parsed.search || parsed.hash || !pathname.startsWith("/uploads/")) return null;
  } catch {
    return null;
  }
  if (pathname.split("/").includes("..")) return null;
  const resolved = path.resolve(process.cwd(), "data", pathname.replace(/^\/+/, ""));
  const relative = path.relative(UPLOAD_ROOT, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

function cleanupDatabase(db, resources) {
  const emails = ids(resources.userEmails);

  const transaction = db.transaction(() => {
    const errors = [];
    const step = (name, operation) => {
      try { operation(); } catch (error) { errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`); }
    };
    step("digital humans", () => deleteWhere(db, "digital_humans", "id", resources.taskIds));
    step("redo credits", () => deleteWhere(db, "dh_redo_credits", "memorial_id", resources.memorialIds));
    step("tributes", () => deleteWhere(db, "tributes", "memorial_id", resources.memorialIds));
    step("media", () => deleteWhere(db, "media", "memorial_id", resources.memorialIds));
    step("life events", () => deleteWhere(db, "life_events", "memorial_id", resources.memorialIds));
    step("memorial groups", () => deleteWhere(db, "memorial_groups", "memorial_id", resources.memorialIds));
    step("memorials", () => deleteWhere(db, "memorials", "id", resources.memorialIds));
    step("group members by group", () => deleteWhere(db, "group_members", "group_id", resources.groupIds));
    step("group members by user", () => deleteWhere(db, "group_members", "user_id", resources.userIds));
    step("groups", () => deleteWhere(db, "groups", "id", resources.groupIds));
    step("AI quotas", () => deleteWhere(db, "ai_quotas", "user_id", resources.userIds));
    step("custom items", () => deleteWhere(db, "items", "id", resources.itemIds));
    step("events", () => deleteWhere(db, "events", "user_id", resources.userIds));
    step("sessions", () => deleteWhere(db, "sessions", "user_id", resources.userIds));
    step("login codes", () => {
      if (emails.length) db.prepare(`DELETE FROM login_codes WHERE target IN (${placeholders(emails)})`).run(...emails);
    });
    step("users", () => deleteWhere(db, "users", "id", resources.userIds));
    if (errors.length) throw new AggregateError(errors, errors.join(" | "));
  });
  transaction();
}

function collectUploadUrls(db, resources) {
  const queries = [
    ["SELECT url, thumb_url FROM media WHERE memorial_id IN", resources.memorialIds, ["url", "thumb_url"]],
    ["SELECT image_url FROM items WHERE id IN", resources.itemIds, ["image_url"]],
    ["SELECT photo_url, audio_url, video_url, result_video_url FROM digital_humans WHERE id IN", resources.taskIds, ["photo_url", "audio_url", "video_url", "result_video_url"]],
  ];
  for (const [prefix, values, columns] of queries) {
    const list = ids(values);
    if (!list.length) continue;
    try {
      const rows = db.prepare(`${prefix} (${placeholders(list)})`).all(...list);
      for (const row of rows) for (const column of columns) registerUpload(resources, row[column]);
    } catch {
      // Explicitly registered URLs remain available even if schema inspection fails.
    }
  }
}

export function cleanupResources(db, resources) {
  const warnings = [];
  collectUploadUrls(db, resources);
  try {
    cleanupDatabase(db, resources);
  } catch (error) {
    warnings.push(`database transaction rolled back: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const url of resources.uploadUrls) {
    const filePath = safeUploadPath(url);
    if (!filePath) {
      warnings.push(`rejected upload path: ${String(url)}`);
      continue;
    }
    try {
      fs.rmSync(filePath, { force: true });
    } catch (error) {
      warnings.push(`upload cleanup failed ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (warnings.length) console.warn(`[${resources.suite} ${resources.runId}] cleanup warning: ${warnings.join(" | ")}`);
  else console.log(`[${resources.suite} ${resources.runId}] cleanup done`);
  return warnings;
}
