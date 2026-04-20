import type Database from "better-sqlite3";

let db: Database.Database;

export function openDatabase(dbPath: string): void {
  // Dynamic import so TypeScript types resolve but the module is only loaded at runtime
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BetterSQLite = require("better-sqlite3") as typeof import("better-sqlite3");
  db = new BetterSQLite(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    -- URL-keyed response cache: stores the last successful GET response for each API path.
    CREATE TABLE IF NOT EXISTS response_cache (
      url_path  TEXT PRIMARY KEY,
      data      TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Fine-grained entity cache: individual records keyed by (entity_type, id).
    -- Used for seeding, conflict resolution, and targeted invalidation.
    CREATE TABLE IF NOT EXISTS entity_cache (
      entity_type  TEXT NOT NULL,
      id           TEXT NOT NULL,
      farm_id      TEXT,
      data         TEXT NOT NULL,
      updated_at   TEXT,
      cached_at    TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (entity_type, id)
    );
    CREATE INDEX IF NOT EXISTS idx_entity_farm ON entity_cache (entity_type, farm_id);

    -- Pending outbound operations queued while offline.
    -- Replayed against the live API in FIFO order on reconnect.
    CREATE TABLE IF NOT EXISTS sync_queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      method     TEXT NOT NULL,
      url_path   TEXT NOT NULL,
      body       TEXT,
      queued_at  TEXT NOT NULL DEFAULT (datetime('now')),
      retries    INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);
}

// ── Response cache (URL-keyed) ────────────────────────────────────────────────

export function cacheResponse(urlPath: string, data: unknown): void {
  db.prepare(`
    INSERT INTO response_cache (url_path, data, cached_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(url_path) DO UPDATE SET data = excluded.data, cached_at = excluded.cached_at
  `).run(urlPath, JSON.stringify(data));
}

export function getCachedResponse(urlPath: string): unknown | null {
  const row = db.prepare("SELECT data FROM response_cache WHERE url_path = ?").get(urlPath) as
    | { data: string }
    | undefined;
  return row ? JSON.parse(row.data) : null;
}

// ── Entity cache (type + id keyed) ───────────────────────────────────────────

export function upsertEntities(
  entityType: string,
  entities: Record<string, unknown>[],
): void {
  const stmt = db.prepare(`
    INSERT INTO entity_cache (entity_type, id, farm_id, data, updated_at, cached_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(entity_type, id) DO UPDATE SET
      farm_id   = excluded.farm_id,
      data      = excluded.data,
      updated_at= excluded.updated_at,
      cached_at = excluded.cached_at
  `);
  const runMany = db.transaction((rows: Record<string, unknown>[]) => {
    for (const e of rows) {
      stmt.run(
        entityType,
        e.id as string,
        (e.farmId ?? e.farm_id ?? null) as string | null,
        JSON.stringify(e),
        (e.updatedAt ?? e.updated_at ?? e.createdAt ?? e.created_at ?? null) as string | null,
      );
    }
  });
  runMany(entities);
}

export function getEntities(entityType: string, farmId?: string): Record<string, unknown>[] {
  const rows = farmId
    ? (db
        .prepare("SELECT data FROM entity_cache WHERE entity_type = ? AND farm_id = ?")
        .all(entityType, farmId) as { data: string }[])
    : (db
        .prepare("SELECT data FROM entity_cache WHERE entity_type = ?")
        .all(entityType) as { data: string }[]);
  return rows.map((r) => JSON.parse(r.data));
}

// ── Sync queue ────────────────────────────────────────────────────────────────

export interface QueueEntry {
  id: number;
  method: string;
  urlPath: string;
  body: string | null;
  queuedAt: string;
  retries: number;
  lastError: string | null;
}

export function enqueueWrite(method: string, urlPath: string, body: string | null): number {
  const result = db
    .prepare("INSERT INTO sync_queue (method, url_path, body) VALUES (?, ?, ?)")
    .run(method, urlPath, body);
  return result.lastInsertRowid as number;
}

export function getPendingQueue(): QueueEntry[] {
  return (
    db.prepare("SELECT id, method, url_path as urlPath, body, queued_at as queuedAt, retries, last_error as lastError FROM sync_queue ORDER BY id ASC").all() as QueueEntry[]
  );
}

export function removeFromQueue(id: number): void {
  db.prepare("DELETE FROM sync_queue WHERE id = ?").run(id);
}

export function markQueueError(id: number, error: string): void {
  db.prepare("UPDATE sync_queue SET retries = retries + 1, last_error = ? WHERE id = ?").run(
    error,
    id,
  );
}

export function getQueueCount(): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM sync_queue").get() as { count: number };
  return row.count;
}
