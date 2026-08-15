import { getDb } from "./db";

// Lightweight event tracking (PRD §6): login channel split, upload success rate,
// AI generation success/cost, digital human job success rate.
export function trackEvent(type: string, meta: Record<string, unknown> = {}, userId = ""): void {
  try {
    getDb()
      .prepare("INSERT INTO events (type, meta, user_id) VALUES (?, ?, ?)")
      .run(type, JSON.stringify(meta), userId);
  } catch (err) {
    console.error("[events] track failed", err);
  }
}