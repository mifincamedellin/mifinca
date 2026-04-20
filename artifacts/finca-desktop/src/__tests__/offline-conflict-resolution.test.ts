/**
 * Tests for conflict-resolution logic extracted from main.ts:flushSyncQueue.
 *
 * Three areas covered:
 *   1. isAfter() — pure comparator, no DB or network needed
 *   2. Server-wins conflict check — a GET before PUT/PATCH/DELETE; if the
 *      server record is newer than base_updated_at the local write is discarded
 *      and the cache is updated with the server state
 *   3. ID reconciliation — after a successful POST, every subsequent queue
 *      entry that references the synthetic offline_* ID must have it rewritten
 *      to the real server-assigned ID
 *
 * The mock HTTP server uses a response queue so tests can programme multiple
 * sequential responses (e.g. GET conflict-check → PATCH write).
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import type Database from "better-sqlite3";
import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "http";
import type { AddressInfo } from "net";

import {
  setDatabaseForTesting,
  enqueueWrite,
  getPendingQueue,
  removeFromQueue,
  markQueueError,
  getQueueCount,
  cacheResponse,
  getCachedResponse,
  upsertSingleEntity,
  getEntityById,
  rewriteQueueIds,
  storeIdMapping,
  getServerIdForOfflineId,
} from "../offline-db";

// ── DatabaseSyncAdapter ──────────────────────────────────────────────────────

class DatabaseSyncAdapter {
  private sqlDb: DatabaseSync;
  constructor() { this.sqlDb = new DatabaseSync(":memory:"); }
  pragma(_str: string): void { /* no-op for in-memory */ }
  exec(sql: string): void { this.sqlDb.exec(sql); }
  prepare(sql: string) { return this.sqlDb.prepare(sql); }
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

// ── Mock HTTP server with queued responses ───────────────────────────────────

interface ReceivedRequest { method: string; url: string; body: string }

interface MockServer {
  baseUrl: string;
  /** Push one response onto the FIFO queue. */
  queueResponse(status: number, body: unknown): void;
  requests: ReceivedRequest[];
  resetRequests(): void;
  server: Server;
}

const responseQueue: Array<{ status: number; body: unknown }> = [];
const receivedRequests: ReceivedRequest[] = [];

const mockServer: MockServer = await new Promise((resolve) => {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      receivedRequests.push({ method: req.method ?? "GET", url: req.url ?? "/", body });
      const next = responseQueue.shift() ?? { status: 200, body: {} };
      res.writeHead(next.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(next.body));
    });
  });

  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address() as AddressInfo;
    resolve({
      baseUrl: `http://127.0.0.1:${port}`,
      queueResponse(status: number, body: unknown) { responseQueue.push({ status, body }); },
      get requests() { return receivedRequests; },
      resetRequests() { receivedRequests.length = 0; },
      server,
    });
  });
});

afterAll(() => { mockServer.server.close(); });

beforeEach(() => {
  setDatabaseForTesting(new DatabaseSyncAdapter() as unknown as Database.Database);
  mockServer.resetRequests();
  responseQueue.length = 0;
});

// ── isAfter() — replicated from main.ts (private function) ──────────────────
// The real implementation is private to main.ts; we replicate it here so we
// can test its edge cases exhaustively without coupling the test to Electron.

function isAfter(
  isoA: string | null | undefined,
  isoB: string | null | undefined,
): boolean {
  if (!isoA) return false;
  if (!isoB) return true;
  return new Date(isoA).getTime() > new Date(isoB).getTime();
}

// ── Conflict-check flush implementation ──────────────────────────────────────
// Mirrors main.ts:flushSyncQueue including the GET conflict check.
// Uses node `fetch` instead of Electron's net.request.

interface FlushResult { flushed: number; errors: number; skipped: number }

async function flushQueueWithConflictCheck(
  authToken: string,
  baseUrl: string,
): Promise<FlushResult> {
  const entries = getPendingQueue();
  let flushed = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      // ── Conflict check for PUT / PATCH / DELETE ──────────────────────────
      if (
        (entry.method === "PUT" || entry.method === "PATCH" || entry.method === "DELETE") &&
        entry.baseUpdatedAt
      ) {
        let serverRecord: Record<string, unknown> | undefined;
        try {
          const getRes = await fetch(`${baseUrl}${entry.urlPath}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (getRes.status === 200) {
            serverRecord = (await getRes.json()) as Record<string, unknown>;
          } else {
            // Non-200 from preflight GET → cannot safely establish a conflict
            // baseline; treat as a check failure and retry the entry later.
            markQueueError(entry.id, "conflict_check_failed");
            errors++;
            continue;
          }
        } catch {
          markQueueError(entry.id, "conflict_check_failed");
          errors++;
          continue;
        }

        if (serverRecord) {
          const serverUpdatedAt =
            (serverRecord.updatedAt ?? serverRecord.updated_at) as string | null | undefined;
          if (isAfter(serverUpdatedAt, entry.baseUpdatedAt)) {
            // Server is newer — discard local write, update local cache
            removeFromQueue(entry.id);
            // Update entity cache with server state (mirrors applyServerEntityToCache)
            cacheResponse(entry.urlPath, serverRecord);
            skipped++;
            continue;
          }
        }
      }

      // ── Apply the write ──────────────────────────────────────────────────
      const res = await fetch(`${baseUrl}${entry.urlPath}`, {
        method: entry.method,
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: entry.body ?? undefined,
      });

      if (res.status >= 200 && res.status < 300) {
        removeFromQueue(entry.id);
        flushed++;

        // POST: ID reconciliation
        if (entry.method === "POST" && entry.clientTempId) {
          const serverEntity = (await res.json()) as Record<string, unknown>;
          const realId = serverEntity.id as string | undefined;
          if (realId && realId !== entry.clientTempId) {
            storeIdMapping(entry.clientTempId, realId);
            rewriteQueueIds(entry.clientTempId, realId);
            // Also rewrite the in-memory tail of the entries array
            for (let j = i + 1; j < entries.length; j++) {
              entries[j].urlPath = entries[j].urlPath.split(entry.clientTempId).join(realId);
              if (entries[j].body) {
                entries[j].body = entries[j].body!.split(entry.clientTempId).join(realId);
              }
            }
            // Update cache: remove offline placeholder, add server entity
            const listUrl = entry.urlPath; // POST was to list URL
            const existing = (getCachedResponse(listUrl) as Record<string, unknown>[] | null) ?? [];
            cacheResponse(listUrl, [
              ...existing.filter((e) => e.id !== entry.clientTempId),
              serverEntity,
            ]);
          }
        }
      } else {
        markQueueError(entry.id, `HTTP ${res.status}`);
        errors++;
      }
    } catch (err) {
      markQueueError(entry.id, err instanceof Error ? err.message : "network_error");
      errors++;
    }
  }

  return { flushed, errors, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. isAfter() unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe("isAfter()", () => {
  it("returns true when A is strictly later than B", () => {
    expect(isAfter("2024-06-02T10:00:00.000Z", "2024-06-01T10:00:00.000Z")).toBe(true);
  });

  it("returns false when A and B are equal (server wins on tie)", () => {
    const ts = "2024-06-01T10:00:00.000Z";
    expect(isAfter(ts, ts)).toBe(false);
  });

  it("returns false when A is earlier than B", () => {
    expect(isAfter("2024-06-01T08:00:00.000Z", "2024-06-01T10:00:00.000Z")).toBe(false);
  });

  it("returns false when A is null (null ≡ epoch)", () => {
    expect(isAfter(null, "2024-06-01T10:00:00.000Z")).toBe(false);
  });

  it("returns false when A is undefined", () => {
    expect(isAfter(undefined, "2024-06-01T10:00:00.000Z")).toBe(false);
  });

  it("returns true when A has a value and B is null (any date > epoch)", () => {
    expect(isAfter("2024-06-01T10:00:00.000Z", null)).toBe(true);
  });

  it("returns true when A has a value and B is undefined", () => {
    expect(isAfter("2024-06-01T10:00:00.000Z", undefined)).toBe(true);
  });

  it("returns false when both are null", () => {
    expect(isAfter(null, null)).toBe(false);
  });

  it("returns false when both are undefined", () => {
    expect(isAfter(undefined, undefined)).toBe(false);
  });

  it("handles millisecond-level precision correctly", () => {
    expect(isAfter("2024-01-01T00:00:00.001Z", "2024-01-01T00:00:00.000Z")).toBe(true);
    expect(isAfter("2024-01-01T00:00:00.000Z", "2024-01-01T00:00:00.001Z")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Server-wins conflict check
// ─────────────────────────────────────────────────────────────────────────────

describe("Server-wins conflict check (PATCH / PUT / DELETE)", () => {
  it("discards local PATCH when server record is newer, updates cache, removes queue entry", async () => {
    const BASE_TS = "2024-01-01T10:00:00.000Z";
    const SERVER_TS = "2024-01-01T12:00:00.000Z"; // server is 2 h newer

    const serverRecord = { id: "animal-1", name: "Lola-server", updatedAt: SERVER_TS };

    // Seed the queue: PATCH with a baseUpdatedAt older than the server record
    enqueueWrite(
      "PATCH",
      "/api/farms/f1/animals/animal-1",
      JSON.stringify({ name: "Lola-local" }),
      BASE_TS,
    );
    expect(getQueueCount()).toBe(1);

    // Mock: GET returns a newer server record
    mockServer.queueResponse(200, serverRecord);

    const { flushed, errors, skipped } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    // The local write was discarded
    expect(skipped).toBe(1);
    expect(flushed).toBe(0);
    expect(errors).toBe(0);

    // Queue is now empty (entry was discarded, not retried)
    expect(getQueueCount()).toBe(0);

    // Server was queried once (conflict GET), no subsequent PATCH was sent
    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0].method).toBe("GET");
    expect(mockServer.requests[0].url).toBe("/api/farms/f1/animals/animal-1");

    // Local cache was updated with the server's version
    const cached = getCachedResponse("/api/farms/f1/animals/animal-1") as typeof serverRecord;
    expect(cached).not.toBeNull();
    expect(cached.name).toBe("Lola-server");
    expect(cached.updatedAt).toBe(SERVER_TS);
  });

  it("applies local PATCH when local change is newer than the server record", async () => {
    const SERVER_TS = "2024-01-01T10:00:00.000Z";
    const BASE_TS = "2024-01-01T11:00:00.000Z"; // local base is 1 h newer → no conflict

    const serverRecord = { id: "animal-2", name: "Mula-server", updatedAt: SERVER_TS };
    const patchedRecord = { id: "animal-2", name: "Mula-local", updatedAt: BASE_TS };

    enqueueWrite(
      "PATCH",
      "/api/farms/f1/animals/animal-2",
      JSON.stringify({ name: "Mula-local" }),
      BASE_TS,
    );

    // Mock: GET returns an older server record; PATCH returns the applied result
    mockServer.queueResponse(200, serverRecord);
    mockServer.queueResponse(200, patchedRecord);

    const { flushed, errors, skipped } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(flushed).toBe(1);
    expect(skipped).toBe(0);
    expect(errors).toBe(0);
    expect(getQueueCount()).toBe(0);

    // Both GET (conflict check) and PATCH (write) hit the server
    expect(mockServer.requests).toHaveLength(2);
    expect(mockServer.requests[0].method).toBe("GET");
    expect(mockServer.requests[1].method).toBe("PATCH");
  });

  it("skips conflict check entirely when baseUpdatedAt is absent, always applies write", async () => {
    // No baseUpdatedAt → no GET → write is applied directly
    enqueueWrite(
      "PATCH",
      "/api/farms/f1/animals/animal-3",
      JSON.stringify({ name: "NoBase" }),
      null, // no baseUpdatedAt
    );

    mockServer.queueResponse(200, { id: "animal-3", name: "NoBase" });

    const { flushed, errors, skipped } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(flushed).toBe(1);
    expect(skipped).toBe(0);
    expect(errors).toBe(0);

    // Only one request: the PATCH itself (no GET conflict check)
    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0].method).toBe("PATCH");
  });

  it("discards local DELETE when server record is newer", async () => {
    const BASE_TS = "2024-01-01T08:00:00.000Z";
    const SERVER_TS = "2024-01-02T08:00:00.000Z"; // server updated the next day

    const serverRecord = { id: "animal-del", name: "Still-alive", updatedAt: SERVER_TS };

    enqueueWrite("DELETE", "/api/farms/f1/animals/animal-del", null, BASE_TS);

    mockServer.queueResponse(200, serverRecord);

    const { flushed, errors, skipped } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(skipped).toBe(1);
    expect(flushed).toBe(0);
    expect(errors).toBe(0);
    expect(getQueueCount()).toBe(0);

    // Only GET was sent; DELETE never reached the server
    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0].method).toBe("GET");

    // Cache preserved the server record
    const cached = getCachedResponse("/api/farms/f1/animals/animal-del") as typeof serverRecord;
    expect(cached?.name).toBe("Still-alive");
  });

  it("POST operations bypass the conflict check entirely", async () => {
    // POST never triggers a GET conflict check (new entity, no prior server state)
    enqueueWrite(
      "POST",
      "/api/farms/f1/animals",
      JSON.stringify({ name: "Brand-new" }),
      null,
      "offline_new_1",
    );

    mockServer.queueResponse(200, { id: "srv-new-1", name: "Brand-new" });

    const { flushed, errors, skipped } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(flushed).toBe(1);
    expect(skipped).toBe(0);
    expect(errors).toBe(0);

    // Exactly one request: the POST (no preceding GET)
    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0].method).toBe("POST");
  });

  it("marks entry with 'conflict_check_failed' and increments retries when the preflight GET fails", async () => {
    // The conflict-check GET returns a server error (5xx) — the entry must be
    // preserved in the queue, retries incremented, and lastError set accordingly.
    enqueueWrite(
      "PATCH",
      "/api/farms/f1/animals/animal-fail",
      JSON.stringify({ name: "Fail-test" }),
      "2024-01-01T10:00:00.000Z",
    );

    // Preflight GET returns 500 (not 200) — serverRecord will be undefined,
    // triggering the conflict_check_failed error path.
    mockServer.queueResponse(500, { error: "Internal Server Error" });

    const { flushed, errors, skipped } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(flushed).toBe(0);
    expect(skipped).toBe(0);
    expect(errors).toBe(1);

    // Entry must remain in the queue (not discarded)
    expect(getQueueCount()).toBe(1);

    const [entry] = getPendingQueue();
    expect(entry.retries).toBe(1);
    expect(entry.lastError).toBe("conflict_check_failed");

    // Only the GET was sent; the PATCH was never attempted
    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0].method).toBe("GET");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ID reconciliation after successful POST
// ─────────────────────────────────────────────────────────────────────────────

describe("ID reconciliation after successful POST", () => {
  it("rewrites all subsequent queue entries that reference the offline ID", async () => {
    const offlineId = "offline_RECON_1";
    const realId = "srv-RECON-1";

    // POST creates the entity; PATCH and DELETE reference it by offline ID
    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "Recon" }), null, offlineId);
    enqueueWrite("PATCH", `/api/farms/f1/animals/${offlineId}`, JSON.stringify({ weight: 420 }));
    enqueueWrite("DELETE", `/api/farms/f1/animals/${offlineId}`, null);

    // Server returns the real ID for the POST; later responses for PATCH and DELETE
    mockServer.queueResponse(200, { id: realId, name: "Recon" });
    mockServer.queueResponse(200, { id: realId, weight: 420 });
    mockServer.queueResponse(204, {});

    const { flushed, errors, skipped } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(errors).toBe(0);
    expect(skipped).toBe(0);
    expect(flushed).toBe(3);
    expect(getQueueCount()).toBe(0);

    // All three requests hit the server
    expect(mockServer.requests).toHaveLength(3);
    expect(mockServer.requests[0].method).toBe("POST");
    expect(mockServer.requests[1].method).toBe("PATCH");
    expect(mockServer.requests[2].method).toBe("DELETE");

    // PATCH and DELETE must have used the real server ID, not the offline ID
    expect(mockServer.requests[1].url).toBe(`/api/farms/f1/animals/${realId}`);
    expect(mockServer.requests[2].url).toBe(`/api/farms/f1/animals/${realId}`);
    expect(mockServer.requests[1].url).not.toContain(offlineId);
    expect(mockServer.requests[2].url).not.toContain(offlineId);
  });

  it("also rewrites offline ID inside the request body of subsequent entries", async () => {
    const offlineId = "offline_BODY_1";
    const realId = "srv-BODY-1";

    // A POST followed by a PATCH whose body contains the offline ID (e.g. a foreign key)
    enqueueWrite("POST", "/api/farms/f1/zones", JSON.stringify({ name: "North" }), null, offlineId);
    enqueueWrite(
      "PATCH",
      "/api/farms/f1/animals/a99",
      JSON.stringify({ zoneId: offlineId, note: "moved to North" }),
    );

    mockServer.queueResponse(200, { id: realId, name: "North" });
    mockServer.queueResponse(200, { id: "a99", zoneId: realId });

    await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    // The PATCH body should reference the real zone ID, not the offline placeholder
    const patchReq = mockServer.requests[1];
    expect(patchReq.method).toBe("PATCH");
    const patchBody = JSON.parse(patchReq.body) as { zoneId: string };
    expect(patchBody.zoneId).toBe(realId);
    expect(patchBody.zoneId).not.toBe(offlineId);
  });

  it("stores the ID mapping persistently so getServerIdForOfflineId resolves it", async () => {
    const offlineId = "offline_MAP_1";
    const realId = "srv-MAP-1";

    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "MapTest" }), null, offlineId);
    mockServer.queueResponse(200, { id: realId, name: "MapTest" });

    await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(getServerIdForOfflineId(offlineId)).toBe(realId);
  });

  it("updates the list cache: replaces the offline placeholder with the real server entity", async () => {
    const offlineId = "offline_CACHE_1";
    const realId = "srv-CACHE-1";

    // Pre-seed cache with the offline placeholder (as fetch-interceptor would)
    cacheResponse("/api/farms/f1/animals", [
      { id: "existing-1", name: "Existing" },
      { id: offlineId, name: "Placeholder", _offline: true },
    ]);

    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "Placeholder" }), null, offlineId);

    const serverEntity = { id: realId, name: "Placeholder", createdAt: new Date().toISOString() };
    mockServer.queueResponse(200, serverEntity);

    await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    const animals = getCachedResponse("/api/farms/f1/animals") as Array<{ id: string }>;
    expect(animals.some((a) => a.id === realId)).toBe(true);
    expect(animals.every((a) => a.id !== offlineId)).toBe(true);
    // The pre-existing entity is still present
    expect(animals.some((a) => a.id === "existing-1")).toBe(true);
  });

  it("handles same-ID POST gracefully (server returns identical ID — no rewrite needed)", async () => {
    const stableId = "stable-no-rewrite";

    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "Stable" }), null, stableId);
    mockServer.queueResponse(200, { id: stableId, name: "Stable" });

    const { flushed, errors } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(flushed).toBe(1);
    expect(errors).toBe(0);
    // No mapping stored (IDs are the same)
    expect(getServerIdForOfflineId(stableId)).toBeNull();
  });

  it("multiple independent POSTs each get their own ID mapping", async () => {
    const offA = "offline_A";
    const offB = "offline_B";
    const srvA = "srv-A";
    const srvB = "srv-B";

    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "A" }), null, offA);
    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "B" }), null, offB);

    mockServer.queueResponse(200, { id: srvA, name: "A" });
    mockServer.queueResponse(200, { id: srvB, name: "B" });

    const { flushed, errors } = await flushQueueWithConflictCheck("tok", mockServer.baseUrl);

    expect(flushed).toBe(2);
    expect(errors).toBe(0);
    expect(getServerIdForOfflineId(offA)).toBe(srvA);
    expect(getServerIdForOfflineId(offB)).toBe(srvB);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Entity cache integration with upsertSingleEntity
// ─────────────────────────────────────────────────────────────────────────────

describe("Entity cache integration", () => {
  it("upsertSingleEntity stores and retrieves an entity by type + id", () => {
    const entity = { id: "e1", name: "Bessie", farmId: "farm-1", species: "cow" };
    upsertSingleEntity("animals", entity);
    const result = getEntityById("animals", "e1");
    expect(result).not.toBeNull();
    expect((result as typeof entity).name).toBe("Bessie");
  });

  it("upsertSingleEntity overwrites an existing entity on id conflict", () => {
    upsertSingleEntity("animals", { id: "e2", name: "Original", farmId: "farm-1" });
    upsertSingleEntity("animals", { id: "e2", name: "Updated", farmId: "farm-1" });
    const result = getEntityById("animals", "e2") as { name: string } | null;
    expect(result?.name).toBe("Updated");
  });
});
