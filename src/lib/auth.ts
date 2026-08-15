import { cookies } from "next/headers";
import { randomBytes, randomInt } from "crypto";
import { getDb } from "./db";

export interface SessionUser {
  id: string;
  email: string;
  phone: string;
  name: string;
  membership_tier: string;
  avatar_url: string;
}

const COOKIE_NAME = "bian_session";
const SESSION_TTL_SECONDS = 7 * 24 * 3600;

function parseSqliteUtc(datetime: string): number {
  return new Date(datetime.replace(" ", "T") + "Z").getTime();
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.expires_at AS expires_at, u.id, u.email, u.phone, u.name, u.membership_tier, u.avatar_url
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
    )
    .get(token) as
    | (SessionUser & { expires_at: string })
    | undefined;
  if (!row) return null;
  if (parseSqliteUtc(row.expires_at) < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  db.prepare("UPDATE sessions SET expires_at = datetime('now', '+7 days') WHERE token = ?").run(token);
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    name: row.name,
    membership_tier: row.membership_tier,
    avatar_url: row.avatar_url,
  };
}

export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))").run(
    token,
    userId
  );
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  store.delete(COOKIE_NAME);
}

export function generateLoginCode(): string {
  return randomInt(0, 1000000).toString().padStart(6, "0");
}

export function revokeUserSessions(userId: string): number {
  return getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId).changes;
}

export function cleanupExpiredSessions(): number {
  return getDb().prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run().changes;
}
