/**
 * Unit tests for offline-db.ts
 *
 * Uses Node.js 22+ built-in `node:sqlite` (DatabaseSync) as a synchronous
 * in-memory SQLite backend instead of the native better-sqlite3 binary.
 *
 * A thin adapter wraps DatabaseSync to add the `transaction()` helper that
 * better-sqlite3 provides but node:sqlite omits.  The cast to Database.Database
 * is safe because the full API surface used by offline-db.ts is satisfied.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import type Database from "better-sqlite3";

import {
  setDatabaseForTesting,
  cacheResponse,
  getCachedResponse,
  upsertEntities,
  upsertSingleEntity,
  removeEntity,
  getEntities,
  getEntityById,
  enqueueWrite,
  getPendingQueue,
  removeFromQueue,
  markQueueError,
  getQueueCount,
  rewriteQueueIds,
  storeIdMapping,
  getServerIdForOfflineId,
} from "../offline-db";

// ── Adapter: adds transaction() to DatabaseSync ───────────────────────────────

class DatabaseSyncAdapter {
  private sqlDb: DatabaseSync;

  constructor() {
    this.sqlDb = new DatabaseSync(":memory:");
  }

  pragma(str: string): void {
    try {
      this.sqlDb.exec(`PRAGMA ${str}`);
    } catch {
      // WAL and foreign_keys pragmas are no-ops for in-memory databases — ignore.
    }
  }

  exec(sql: string): void {
    this.sqlDb.exec(sql);
  }

  prepare(sql: string): StatementSync {
    return this.sqlDb.prepare(sql);
  }

  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T {
    return (...args: unknown[]): T => {
      this.sqlDb.exec("BEGIN");
      try {
        const result = fn(...args);
        this.sqlDb.exec("COMMIT");
        return result;
      } catch (err) {
        this.sqlDb.exec("ROLLBACK");
        throw err;
      }
    };
  }
}

// Fresh in-memory database before each test
beforeEach(() => {
  setDatabaseForTesting(new DatabaseSyncAdapter() as unknown as Database.Database);
});

// ─────────────────────────────────────────────────────────────────────────────
// Response cache
// ─────────────────────────────────────────────────────────────────────────────

describe("cacheResponse / getCachedResponse", () => {
  it("stores and retrieves a JSON value by URL path", () => {
    const data = [{ id: "1", name: "Bessie" }];
    cacheResponse("/api/farms/f1/animals", data);
    const result = getCachedResponse("/api/farms/f1/animals");
    expect(result).toEqual(data);
  });

  it("returns null for an uncached URL", () => {
    expect(getCachedResponse("/api/farms/missing")).toBeNull();
  });

  it("overwrites an existing cached entry (upsert)", () => {
    cacheResponse("/api/farms/f1/animals", [{ id: "1" }]);
    cacheResponse("/api/farms/f1/animals", [{ id: "2" }]);
    const result = getCachedResponse("/api/farms/f1/animals");
    expect(result).toEqual([{ id: "2" }]);
  });

  it("caches complex nested objects without data loss", () => {
    const complex = { id: "x", nested: { a: 1, b: [true, "str"] } };
    cacheResponse("/api/farms/f1/events/x", complex);
    expect(getCachedResponse("/api/farms/f1/events/x")).toEqual(complex);
  });

  it("stores null as a value (used to invalidate detail caches)", () => {
    cacheResponse("/api/farms/f1/animals/dead-one", null);
    expect(getCachedResponse("/api/farms/f1/animals/dead-one")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Entity cache
// ─────────────────────────────────────────────────────────────────────────────

describe("upsertEntities / getEntities / getEntityById / removeEntity", () => {
  const FARM_ID = "farm-abc";

  it("inserts and retrieves entities by type", () => {
    upsertEntities("animals", [
      { id: "a1", name: "Lola", farmId: FARM_ID },
      { id: "a2", name: "Mula", farmId: FARM_ID },
    ]);
    const rows = getEntities("animals");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual(["a1", "a2"]);
  });

  it("filters entities by farmId", () => {
    upsertEntities("animals", [
      { id: "a1", farmId: "farm-1" },
      { id: "a2", farmId: "farm-2" },
    ]);
    expect(getEntities("animals", "farm-1")).toHaveLength(1);
    expect(getEntities("animals", "farm-1")[0].id).toBe("a1");
  });

  it("upserts (updates) an existing entity", () => {
    upsertEntities("animals", [{ id: "a1", farmId: FARM_ID, name: "Old" }]);
    upsertEntities("animals", [{ id: "a1", farmId: FARM_ID, name: "New" }]);
    const rows = getEntities("animals");
    expect(rows).toHaveLength(1);
    expect((rows[0] as { name: string }).name).toBe("New");
  });

  it("upsertSingleEntity inserts one entity", () => {
    upsertSingleEntity("contacts", { id: "c1", farmId: FARM_ID, phone: "+57" });
    expect(getEntities("contacts")).toHaveLength(1);
  });

  it("getEntityById returns the correct entity", () => {
    upsertEntities("animals", [{ id: "a1", farmId: FARM_ID, name: "Bessie" }]);
    const entity = getEntityById("animals", "a1");
    expect(entity).not.toBeNull();
    expect((entity as { name: string }).name).toBe("Bessie");
  });

  it("getEntityById returns null when entity does not exist", () => {
    expect(getEntityById("animals", "does-not-exist")).toBeNull();
  });

  it("removeEntity deletes only the targeted entity", () => {
    upsertEntities("animals", [
      { id: "a1", farmId: FARM_ID },
      { id: "a2", farmId: FARM_ID },
    ]);
    removeEntity("animals", "a1");
    const rows = getEntities("animals");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("a2");
  });

  it("getEntities returns empty array when none exist", () => {
    expect(getEntities("inventory_items")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sync queue
// ─────────────────────────────────────────────────────────────────────────────

describe("enqueueWrite / getPendingQueue / getQueueCount", () => {
  it("enqueues a write and returns its row ID", () => {
    const id = enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "Nena" }));
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("queued entry appears in getPendingQueue", () => {
    enqueueWrite("POST", "/api/farms/f1/animals", '{"name":"Nena"}', null, "offline_123");
    const queue = getPendingQueue();
    expect(queue).toHaveLength(1);
    const entry = queue[0];
    expect(entry.method).toBe("POST");
    expect(entry.urlPath).toBe("/api/farms/f1/animals");
    expect(entry.body).toBe('{"name":"Nena"}');
    expect(entry.clientTempId).toBe("offline_123");
    expect(entry.retries).toBe(0);
    expect(entry.lastError).toBeNull();
  });

  it("maintains FIFO order in the queue", () => {
    enqueueWrite("POST", "/api/farms/f1/animals", null);
    enqueueWrite("PUT", "/api/farms/f1/animals/a1", null);
    enqueueWrite("DELETE", "/api/farms/f1/animals/a2", null);

    const queue = getPendingQueue();
    expect(queue.map((e) => e.method)).toEqual(["POST", "PUT", "DELETE"]);
  });

  it("getQueueCount returns the correct count", () => {
    expect(getQueueCount()).toBe(0);
    enqueueWrite("POST", "/api/farms/f1/animals", null);
    enqueueWrite("PATCH", "/api/farms/f1/animals/a1", null);
    expect(getQueueCount()).toBe(2);
  });

  it("stores baseUpdatedAt for conflict checks", () => {
    enqueueWrite("PUT", "/api/farms/f1/animals/a1", '{"name":"X"}', "2024-01-01T00:00:00Z");
    const [entry] = getPendingQueue();
    expect(entry.baseUpdatedAt).toBe("2024-01-01T00:00:00Z");
  });
});

describe("removeFromQueue", () => {
  it("removes the targeted entry", () => {
    const id = enqueueWrite("POST", "/api/farms/f1/animals", null);
    enqueueWrite("PUT", "/api/farms/f1/animals/a1", null);
    removeFromQueue(id);
    const queue = getPendingQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].method).toBe("PUT");
  });

  it("is a no-op for a non-existent ID", () => {
    enqueueWrite("POST", "/api/farms/f1/animals", null);
    removeFromQueue(99999);
    expect(getQueueCount()).toBe(1);
  });
});

describe("markQueueError", () => {
  it("increments retries and records the error message", () => {
    const id = enqueueWrite("POST", "/api/farms/f1/animals", null);
    markQueueError(id, "network timeout");
    const [entry] = getPendingQueue();
    expect(entry.retries).toBe(1);
    expect(entry.lastError).toBe("network timeout");
  });

  it("accumulates retries on repeated errors", () => {
    const id = enqueueWrite("POST", "/api/farms/f1/animals", null);
    markQueueError(id, "err1");
    markQueueError(id, "err2");
    const [entry] = getPendingQueue();
    expect(entry.retries).toBe(2);
    expect(entry.lastError).toBe("err2");
  });
});

describe("rewriteQueueIds", () => {
  it("replaces offline ID with server ID in urlPath and body", () => {
    enqueueWrite(
      "PUT",
      "/api/farms/f1/animals/offline_abc123",
      JSON.stringify({ parentId: "offline_abc123" }),
    );
    rewriteQueueIds("offline_abc123", "server-real-id");
    const [entry] = getPendingQueue();
    expect(entry.urlPath).toBe("/api/farms/f1/animals/server-real-id");
    expect(entry.body).toContain("server-real-id");
    expect(entry.body).not.toContain("offline_abc123");
  });

  it("leaves entries unchanged when the offline ID is not present", () => {
    enqueueWrite("PUT", "/api/farms/f1/animals/a1", '{"name":"Bessie"}');
    rewriteQueueIds("offline_xyz", "server-real-id");
    const [entry] = getPendingQueue();
    expect(entry.urlPath).toBe("/api/farms/f1/animals/a1");
    expect(entry.body).toBe('{"name":"Bessie"}');
  });

  it("rewrites multiple occurrences in a single body", () => {
    enqueueWrite(
      "POST",
      "/api/farms/f1/finances",
      JSON.stringify({ animalId: "offline_OOO", refId: "offline_OOO" }),
    );
    rewriteQueueIds("offline_OOO", "srv-99");
    const [entry] = getPendingQueue();
    const parsed = JSON.parse(entry.body ?? "{}") as Record<string, string>;
    expect(parsed.animalId).toBe("srv-99");
    expect(parsed.refId).toBe("srv-99");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ID mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("storeIdMapping / getServerIdForOfflineId", () => {
  it("stores a mapping and retrieves the server ID", () => {
    storeIdMapping("offline_001", "srv-001");
    expect(getServerIdForOfflineId("offline_001")).toBe("srv-001");
  });

  it("returns null for an unknown offline ID", () => {
    expect(getServerIdForOfflineId("offline_missing")).toBeNull();
  });

  it("updates an existing mapping (upsert)", () => {
    storeIdMapping("offline_001", "srv-old");
    storeIdMapping("offline_001", "srv-new");
    expect(getServerIdForOfflineId("offline_001")).toBe("srv-new");
  });
});
