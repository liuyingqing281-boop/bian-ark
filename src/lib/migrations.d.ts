import type Database from "better-sqlite3";

export interface MigrationOptions {
  migrationDir?: string;
}

export function migrateUp(db: Database.Database, options?: MigrationOptions): string[];
export function migrationStatus(db: Database.Database, options?: MigrationOptions): Array<{
  version: number;
  name: string;
  checksum: string;
  state: "pending" | "applied" | "checksum_mismatch";
  appliedAt: string | null;
}>;
export function verifyDatabase(db: Database.Database, options?: MigrationOptions): {
  ok: boolean;
  errors: string[];
  migrations: number;
};
