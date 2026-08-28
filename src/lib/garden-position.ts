import type Database from "better-sqlite3";

const MIN_DISTANCE = 0.04;
const MIN_X = 0.04;
const MAX_X = 0.96;
const MIN_Y = 0.08;
const MAX_Y = 0.92;

type GardenDb = Database.Database;
type GardenPoint = { x: number; y: number };

function occupiedPoints(db: GardenDb, excludeHallId?: string): GardenPoint[] {
  const where = excludeHallId ? "AND id != ?" : "";
  return db.prepare(
    `SELECT garden_x AS x, garden_y AS y FROM halls
     WHERE in_garden = 1 AND garden_x IS NOT NULL AND garden_y IS NOT NULL ${where}`
  ).all(...(excludeHallId ? [excludeHallId] : [])) as GardenPoint[];
}

function isFree(taken: GardenPoint[], x: number, y: number): boolean {
  return taken.every((point) => Math.hypot(point.x - x, point.y - y) >= MIN_DISTANCE);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function findAvailableGardenSpot(db: GardenDb, x: number, y: number, excludeHallId?: string): GardenPoint | null {
  const taken = occupiedPoints(db, excludeHallId);
  if (isFree(taken, x, y)) return { x, y };
  for (let ring = 1; ring <= 8; ring += 1) {
    const radius = MIN_DISTANCE * ring;
    for (let angle = 0; angle < 12; angle += 1) {
      const candidate = {
        x: Math.round(clamp(x + radius * Math.cos((angle * Math.PI) / 6), MIN_X, MAX_X) * 1000) / 1000,
        y: Math.round(clamp(y + radius * Math.sin((angle * Math.PI) / 6), MIN_Y, MAX_Y) * 1000) / 1000,
      };
      if (isFree(taken, candidate.x, candidate.y)) return candidate;
    }
  }
  return null;
}

export function setHallGardenPosition(db: GardenDb, hallId: string, x: number, y: number): void {
  db.prepare(
    "UPDATE halls SET in_garden = 1, garden_x = ?, garden_y = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(x, y, hallId);
}

export function removeHallFromGarden(db: GardenDb, hallId: string): void {
  db.prepare(
    "UPDATE halls SET in_garden = 0, garden_x = NULL, garden_y = NULL, updated_at = datetime('now') WHERE id = ?"
  ).run(hallId);
}

function hashHallId(hallId: string): number {
  let hash = 2166136261;
  for (const char of hallId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function ensureAutomaticHallPosition(
  db: GardenDb,
  hall: { id: string; garden_x: number | null; garden_y: number | null }
): GardenPoint | null {
  const hasSavedPosition = hall.garden_x !== null && hall.garden_x !== undefined
    && hall.garden_y !== null && hall.garden_y !== undefined;
  const existingX = hasSavedPosition ? Number(hall.garden_x) : Number.NaN;
  const existingY = hasSavedPosition ? Number(hall.garden_y) : Number.NaN;
  if (Number.isFinite(existingX) && Number.isFinite(existingY) && existingX >= 0 && existingX <= 1 && existingY >= 0 && existingY <= 1) {
    setHallGardenPosition(db, hall.id, existingX, existingY);
    return { x: existingX, y: existingY };
  }

  const hash = hashHallId(hall.id);
  const columns = 23;
  const rows = 19;
  const start = hash % (columns * rows);
  const taken = occupiedPoints(db, hall.id);
  for (let offset = 0; offset < columns * rows; offset += 1) {
    const index = (start + offset) % (columns * rows);
    const candidate = {
      x: Math.round((MIN_X + (index % columns) * ((MAX_X - MIN_X) / (columns - 1))) * 1000) / 1000,
      y: Math.round((MIN_Y + Math.floor(index / columns) * ((MAX_Y - MIN_Y) / (rows - 1))) * 1000) / 1000,
    };
    if (isFree(taken, candidate.x, candidate.y)) {
      setHallGardenPosition(db, hall.id, candidate.x, candidate.y);
      return candidate;
    }
  }
  return null;
}
