import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * SQLite connection + schema migrations.
 *
 * One household's calendar is a few thousand rows at most, so a single embedded
 * SQLite file is the right amount of database: no server to run, no connection
 * pool, and the whole thing backs up by copying one file.
 */

export type DB = Database.Database;

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "001_initial",
    sql: `
      CREATE TABLE households (
        id             TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        pin_hash       TEXT NOT NULL,
        pin_salt       TEXT NOT NULL,
        week_starts_on INTEGER NOT NULL DEFAULT 1,
        time_zone      TEXT NOT NULL DEFAULT 'Europe/London',
        created_at     TEXT NOT NULL
      );

      CREATE TABLE members (
        id           TEXT PRIMARY KEY,
        household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        colour       TEXT NOT NULL,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        archived     INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL
      );
      CREATE INDEX idx_members_household ON members(household_id, archived, sort_order);

      CREATE TABLE events (
        id               TEXT PRIMARY KEY,
        household_id     TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        title            TEXT NOT NULL,
        location         TEXT,
        notes            TEXT,
        start_date       TEXT NOT NULL,
        end_date         TEXT NOT NULL,
        all_day          INTEGER NOT NULL DEFAULT 0,
        start_time       TEXT,
        end_time         TEXT,
        recurrence       TEXT,
        -- Denormalised last possible date, so range queries can skip finished
        -- series in SQL. NULL means open-ended (or bounded by a count).
        recurrence_until TEXT,
        created_by       TEXT REFERENCES members(id) ON DELETE SET NULL,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      );
      CREATE INDEX idx_events_range ON events(household_id, start_date, end_date);

      CREATE TABLE event_members (
        event_id  TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        PRIMARY KEY (event_id, member_id)
      );
      CREATE INDEX idx_event_members_member ON event_members(member_id);

      -- One row per "just this one" edit or deletion within a repeating series.
      CREATE TABLE event_overrides (
        event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        occurrence_date TEXT NOT NULL,
        cancelled       INTEGER NOT NULL DEFAULT 0,
        title           TEXT,
        location        TEXT,
        notes           TEXT,
        start_date      TEXT,
        end_date        TEXT,
        all_day         INTEGER,
        start_time      TEXT,
        end_time        TEXT,
        -- JSON array of member ids, or NULL to inherit the series' members.
        -- Covers "Mum takes them to swimming just this week".
        member_ids      TEXT,
        PRIMARY KEY (event_id, occurrence_date)
      );

      CREATE TABLE app_settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE login_attempts (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        client  TEXT NOT NULL,
        at      TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_login_attempts ON login_attempts(client, at);
    `,
  },
];

function runMigrations(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = new Set(
    db.prepare<[], { name: string }>("SELECT name FROM _migrations").all().map((r) => r.name),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
        migration.name,
        new Date().toISOString(),
      );
    })();
  }
}

/**
 * Where the family's data lives. Relative paths are resolved against the
 * working directory, so `DATABASE_PATH=/data/family.db` works for a mounted
 * volume while the default keeps everything inside the project.
 */
function databasePath(): string {
  const configured = process.env.DATABASE_PATH ?? "data/family-organiser.db";
  // The database is opened when the server runs, not when it is built, so the
  // bundler must not try to trace this path into the deployment output.
  return isAbsolute(configured)
    ? configured
    : join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function connect(): DB {
  const path = databasePath();
  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  // WAL keeps reads from blocking the writer — the whole family hits this at 8am.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  runMigrations(db);
  return db;
}

// Next.js recreates modules on hot reload; without this we would leak handles.
const globalForDb = globalThis as unknown as { __familyDb?: DB };

export function getDb(): DB {
  if (!globalForDb.__familyDb) globalForDb.__familyDb = connect();
  return globalForDb.__familyDb;
}

/** Create an isolated in-memory database — used by the test suite. */
export function createTestDb(): DB {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Small key/value store, used for the auto-generated session secret
// ---------------------------------------------------------------------------

export function getSetting(db: DB, key: string): string | null {
  const row = db
    .prepare<[string], { value: string }>("SELECT value FROM app_settings WHERE key = ?")
    .get(key);
  return row?.value ?? null;
}

export function setSetting(db: DB, key: string, value: string): void {
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}
