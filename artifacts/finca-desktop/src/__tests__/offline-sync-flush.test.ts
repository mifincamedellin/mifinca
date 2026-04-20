/**
 * Integration tests for offline sync queue flush behaviour.
 *
 * These tests use the REAL offline-db.ts functions (enqueueWrite, getPendingQueue,
 * removeFromQueue, markQueueError, cacheResponse, getCachedResponse, rewriteQueueIds,
 * storeIdMapping) backed by a real in-memory SQLite database (node:sqlite).
 *
 * A real Node.js HTTP server acts as the mock API endpoint so that the flush
 * path exercises actual queue reads, real HTTP requests, and real queue mutations
 * rather than in-memory stubs.
 *
 * The flush function mirrors main.ts:flushSyncQueue using production offline-db
 * helpers at every step. The only difference is `fetch` instead of Electron's
 * `net.request` — that is the one Electron-specific surface we cannot substitute
 * without a running Electron window.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import type Database from "better-sqlite3";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "http";
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
  rewriteQueueIds,
  storeIdMapping,
} from "../offline-db";

// ── DatabaseSyncAdapter (same as in offline-db.test.ts) ──────────────────────

class DatabaseSyncAdapter {
  private sqlDb: DatabaseSync;

  constructor() {
    this.sqlDb = new DatabaseSync(":memory:");
  }

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

// ── Real mock HTTP server ─────────────────────────────────────────────────────

interface ReceivedRequest {
  method: string;
  url: string;
  body: string;
}

interface MockServerControl {
  baseUrl: string;
  /** Set the response for the NEXT request. */
  setNextResponse(status: number, body: unknown): void;
  /** All requests received by the server since the last reset. */
  requests: ReceivedRequest[];
  /** Clear request history. */
  resetRequests(): void;
  server: Server;
}

let nextStatus = 200;
let nextBody: unknown = { id: "server-1" };
const receivedRequests: ReceivedRequest[] = [];

const mockServer: MockServerControl = await new Promise((resolve) => {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      receivedRequests.push({ method: req.method ?? "GET", url: req.url ?? "/", body });
      res.writeHead(nextStatus, { "Content-Type": "application/json" });
      res.end(JSON.stringify(nextBody));
    });
  });

  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address() as AddressInfo;
    resolve({
      baseUrl: `http://127.0.0.1:${port}`,
      setNextResponse(status: number, body: unknown) {
        nextStatus = status;
        nextBody = body;
      },
      get requests() { return receivedRequests; },
      resetRequests() { receivedRequests.length = 0; },
      server,
    });
  });
});

afterAll(() => {
  mockServer.server.close();
});

beforeEach(() => {
  setDatabaseForTesting(new DatabaseSyncAdapter() as unknown as Database.Database);
  mockServer.resetRequests();
  nextStatus = 200;
  nextBody = { id: "server-1" };
});

// ── Core flush implementation using real offline-db helpers ───────────────────
// Mirrors the structure of main.ts:flushSyncQueue without Electron-specific APIs.

async function flushQueue(
  authToken: string,
  baseUrl: string,
): Promise<{ flushed: number; errors: number }> {
  const entries = getPendingQueue();
  let flushed = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
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

        // After a successful POST: store ID mapping and rewrite subsequent entries
        if (entry.method === "POST" && entry.clientTempId) {
          const serverEntity = (await res.clone().json()) as Record<string, unknown>;
          const realId = serverEntity.id as string | undefined;
          if (realId && realId !== entry.clientTempId) {
            storeIdMapping(entry.clientTempId, realId);
            rewriteQueueIds(entry.clientTempId, realId);
          }
          const url = entry.urlPath;
          const current = (getCachedResponse(url) as unknown[] | null) ?? [];
          cacheResponse(url, [
            ...(current as Record<string, unknown>[]).filter(
              (e) => e.id !== entry.clientTempId,
            ),
            serverEntity,
          ]);
        }
      } else {
        markQueueError(entry.id, `HTTP ${res.status}`);
        errors++;
      }
    } catch (err) {
      markQueueError(entry.id, err instanceof Error ? err.message : String(err));
      errors++;
    }
  }

  return { flushed, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Queue flush using real offline-db + mock HTTP server", () => {
  it("flushes a single POST and removes it from the queue on 200", async () => {
    const serverEntity = { id: "srv-001", name: "Pancita", species: "cow" };
    mockServer.setNextResponse(200, serverEntity);

    const offlineId = "offline_test_aaa";
    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "Pancita" }), null, offlineId);
    expect(getQueueCount()).toBe(1);

    const { flushed, errors } = await flushQueue("token-xyz", mockServer.baseUrl);

    // Queue is empty after flush
    expect(getQueueCount()).toBe(0);
    expect(flushed).toBe(1);
    expect(errors).toBe(0);

    // The real HTTP server received exactly one request with the correct method and URL
    expect(mockServer.requests).toHaveLength(1);
    const req = mockServer.requests[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/api/farms/f1/animals");
    expect((JSON.parse(req.body) as { name: string }).name).toBe("Pancita");
  });

  it("replays multiple queued writes in FIFO order, verified by server request history", async () => {
    mockServer.setNextResponse(200, { id: "srv-result" });

    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "A" }), null, "offline_aaa");
    enqueueWrite("PATCH", "/api/farms/f1/animals/a1", JSON.stringify({ name: "B" }));
    enqueueWrite("DELETE", "/api/farms/f1/animals/a2", null);

    const { flushed, errors } = await flushQueue("tok", mockServer.baseUrl);

    expect(flushed).toBe(3);
    expect(errors).toBe(0);
    expect(getQueueCount()).toBe(0);

    // Server received exactly three requests in FIFO order
    const methods = mockServer.requests.map((r) => r.method);
    expect(methods).toEqual(["POST", "PATCH", "DELETE"]);

    // Each request hit the correct URL
    expect(mockServer.requests[0].url).toBe("/api/farms/f1/animals");
    expect(mockServer.requests[1].url).toBe("/api/farms/f1/animals/a1");
    expect(mockServer.requests[2].url).toBe("/api/farms/f1/animals/a2");
  });

  it("marks failed entries with error and leaves them in the queue", async () => {
    mockServer.setNextResponse(500, { error: "Internal Server Error" });

    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "Fail" }));
    const { flushed, errors } = await flushQueue("tok", mockServer.baseUrl);

    expect(flushed).toBe(0);
    expect(errors).toBe(1);
    expect(getQueueCount()).toBe(1); // still in queue

    const [entry] = getPendingQueue();
    expect(entry.retries).toBe(1);
    expect(entry.lastError).toBe("HTTP 500");

    // Server still received the real request
    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0].method).toBe("POST");
  });

  it("stores id mapping and rewrites subsequent queue entries after successful POST", async () => {
    const offlineId = "offline_ABC";
    const serverRealId = "srv-REAL";

    mockServer.setNextResponse(200, { id: serverRealId, name: "Nena" });

    // Enqueue a POST and a dependent PATCH that references the offline ID
    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "Nena" }), null, offlineId);
    enqueueWrite("PATCH", `/api/farms/f1/animals/${offlineId}`, JSON.stringify({ name: "Updated" }));

    // Flush only the POST entry
    const [postEntry] = getPendingQueue();
    const res = await fetch(`${mockServer.baseUrl}${postEntry.urlPath}`, {
      method: postEntry.method,
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
      body: postEntry.body ?? undefined,
    });
    expect(res.status).toBe(200);
    removeFromQueue(postEntry.id);

    // ID reconciliation (mirrors main.ts post-flush logic)
    storeIdMapping(offlineId, serverRealId);
    rewriteQueueIds(offlineId, serverRealId);

    // The remaining PATCH entry must now reference the real server ID
    const remaining = getPendingQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].urlPath).toBe(`/api/farms/f1/animals/${serverRealId}`);
    expect(remaining[0].urlPath).not.toContain(offlineId);
  });

  it("full offline→online round-trip: cache seeds → POST queued → flush → cache updated with real ID", async () => {
    // Phase 1: Seed the cache as the fetch-interceptor's write-through would
    cacheResponse("/api/farms/f1/animals", []);

    // Phase 2: Simulate an offline POST (as fetch-interceptor.ts enqueues)
    const offlineId = "offline_ROUND";
    enqueueWrite("POST", "/api/farms/f1/animals", JSON.stringify({ name: "Roundup", species: "cattle" }), null, offlineId);

    // Phase 3: Optimistic write applied to cache (mirrors applyOptimisticMutation)
    const existingList = (getCachedResponse("/api/farms/f1/animals") as unknown[]) ?? [];
    cacheResponse("/api/farms/f1/animals", [
      ...existingList,
      { id: offlineId, name: "Roundup", _offline: true },
    ]);

    // Phase 4: Reconnect — server accepts the POST and assigns a real ID
    const serverEntity = { id: "srv-FINAL", name: "Roundup", species: "cattle", createdAt: new Date().toISOString() };
    mockServer.setNextResponse(200, serverEntity);

    const { flushed, errors } = await flushQueue("tok", mockServer.baseUrl);
    expect(flushed).toBe(1);
    expect(errors).toBe(0);

    // Real HTTP request was made to the server
    expect(mockServer.requests).toHaveLength(1);
    expect(mockServer.requests[0].method).toBe("POST");

    // Queue cleared
    expect(getQueueCount()).toBe(0);

    // Cache updated in real SQLite: offline entry replaced with real server entity
    const animals = getCachedResponse("/api/farms/f1/animals") as Record<string, unknown>[];
    expect(animals.some((a) => a.id === "srv-FINAL")).toBe(true);
    expect(animals.every((a) => a.id !== offlineId)).toBe(true);
  });
});
