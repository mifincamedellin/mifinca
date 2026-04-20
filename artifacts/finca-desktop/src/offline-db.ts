import type Database from "better-sqlite3";

let db: Database.Database;

export function openDatabase(dbPath: string): void {
  // Dynamic require so TypeScript types resolve but the native module is loaded at runtime
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
    -- base_updated_at: the entity's updated_at when the write was queued — used for
    --   server-wins conflict resolution (server newer → skip write).
    CREATE TABLE IF NOT EXISTS sync_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      method          TEXT NOT NULL,
      url_path        TEXT NOT NULL,
      body            TEXT,
      base_updated_at TEXT,
      queued_at       TEXT NOT NULL DEFAULT (datetime('now')),
      retries         INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT
    );

    -- Mapping from synthetic offline IDs to real server IDs.
    -- Written after a successful POST flush so subsequent offline writes targeting
    -- the offline ID can be rewritten to the real server ID before replay.
    CREATE TABLE IF NOT EXISTS id_mapping (
      offline_id TEXT PRIMARY KEY,
      server_id  TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Idempotent migrations: add columns introduced after the initial schema
  const cols = (
    db.prepare("PRAGMA table_info(sync_queue)").all() as { name: string }[]
  ).map((c) => c.name);
  if (!cols.includes("base_updated_at")) {
    db.exec("ALTER TABLE sync_queue ADD COLUMN base_updated_at TEXT");
  }
  if (!cols.includes("client_temp_id")) {
    db.exec("ALTER TABLE sync_queue ADD COLUMN client_temp_id TEXT");
  }
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
      farm_id    = excluded.farm_id,
      data       = excluded.data,
      updated_at = excluded.updated_at,
      cached_at  = excluded.cached_at
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

/** Upsert a single entity into the fine-grained entity cache. */
export function upsertSingleEntity(
  entityType: string,
  entity: Record<string, unknown>,
): void {
  upsertEntities(entityType, [entity]);
}

/** Remove a single entity from the fine-grained entity cache. */
export function removeEntity(entityType: string, id: string): void {
  db.prepare("DELETE FROM entity_cache WHERE entity_type = ? AND id = ?").run(entityType, id);
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

// ── ID mapping (synthetic → server) ──────────────────────────────────────────

/**
 * Store a mapping from an offline synthetic ID to the real server-assigned ID.
 * Called after a successful POST flush so subsequent writes can be rewritten.
 */
export function storeIdMapping(offlineId: string, serverId: string): void {
  db.prepare(`
    INSERT INTO id_mapping (offline_id, server_id)
    VALUES (?, ?)
    ON CONFLICT(offline_id) DO UPDATE SET server_id = excluded.server_id
  `).run(offlineId, serverId);
}

/**
 * Return the real server ID for a given offline synthetic ID, or null if not found.
 */
export function getServerIdForOfflineId(offlineId: string): string | null {
  const row = db.prepare("SELECT server_id FROM id_mapping WHERE offline_id = ?").get(offlineId) as
    | { server_id: string }
    | undefined;
  return row?.server_id ?? null;
}

// ── Entity lookup by ID ───────────────────────────────────────────────────────

/**
 * Fetch a single entity from entity_cache by (entityType, id).
 * Returns null if not found. Used as a fallback when response_cache misses
 * for baseUpdatedAt resolution during conflict checks.
 */
export function getEntityById(
  entityType: string,
  id: string,
): Record<string, unknown> | null {
  const row = db
    .prepare("SELECT data FROM entity_cache WHERE entity_type = ? AND id = ?")
    .get(entityType, id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Record<string, unknown>) : null;
}

// ── Sync queue ────────────────────────────────────────────────────────────────

export interface QueueEntry {
  id: number;
  method: string;
  urlPath: string;
  body: string | null;
  baseUpdatedAt: string | null;
  /**
   * For POST writes: the synthetic offline_* ID assigned by the client.
   * Used after a successful flush to reconcile the real server ID with
   * any subsequent queue entries that reference the temp ID.
   */
  clientTempId: string | null;
  queuedAt: string;
  retries: number;
  lastError: string | null;
}

export function enqueueWrite(
  method: string,
  urlPath: string,
  body: string | null,
  baseUpdatedAt?: string | null,
  clientTempId?: string | null,
): number {
  const result = db
    .prepare(
      "INSERT INTO sync_queue (method, url_path, body, base_updated_at, client_temp_id) VALUES (?, ?, ?, ?, ?)",
    )
    .run(method, urlPath, body, baseUpdatedAt ?? null, clientTempId ?? null);
  return result.lastInsertRowid as number;
}

export function getPendingQueue(): QueueEntry[] {
  return db
    .prepare(
      `SELECT id, method, url_path as urlPath, body,
              base_updated_at as baseUpdatedAt,
              client_temp_id as clientTempId,
              queued_at as queuedAt, retries, last_error as lastError
       FROM sync_queue ORDER BY id ASC`,
    )
    .all() as QueueEntry[];
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

/**
 * Rewrite every queued entry: replace occurrences of offlineId in url_path and body
 * with the real server ID. Called after a successful POST flush to reconcile IDs.
 */
export function rewriteQueueIds(offlineId: string, serverId: string): void {
  const entries = getPendingQueue();
  const update = db.prepare(
    "UPDATE sync_queue SET url_path = ?, body = ? WHERE id = ?",
  );
  const run = db.transaction(() => {
    for (const entry of entries) {
      const newUrl = entry.urlPath.split(offlineId).join(serverId);
      const newBody = entry.body ? entry.body.split(offlineId).join(serverId) : null;
      if (newUrl !== entry.urlPath || newBody !== entry.body) {
        update.run(newUrl, newBody, entry.id);
      }
    }
  });
  run();
}
