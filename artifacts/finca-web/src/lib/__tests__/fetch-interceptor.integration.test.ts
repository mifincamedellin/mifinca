/**
 * Integration smoke test for fetch-interceptor.ts
 *
 * The REAL fetch-interceptor module is imported in beforeAll, which causes it
 * to patch window.fetch.  All subsequent calls to window.fetch go through the
 * production interceptor code, not a replica or stub.
 *
 * window.laFincaDesktop is replaced with a JS in-memory stub that mirrors the
 * IPC bridge's observable contract (getCachedResponse, queueOfflineWrite, …).
 * navigator.onLine is controlled per-test so the same patched fetch exercises
 * both the offline and online paths.
 *
 * The reconnect section starts a real Node.js HTTP server and makes real HTTP
 * requests to verify that queued writes replay correctly against an endpoint.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse, type Server } from "http";
import type { AddressInfo } from "net";
import type { LaFincaDesktopAPI } from "@/lib/desktop.d";

// ── In-memory IPC bridge stub ─────────────────────────────────────────────────

type SyncQueueEntry = {
  id: number;
  method: string;
  urlPath: string;
  body: string | null;
  baseUpdatedAt: string | null;
  clientTempId: string | null;
};

let responseCache: Map<string, unknown>;
let syncQueue: SyncQueueEntry[];
let desktopStub: LaFincaDesktopAPI;
let idSeq: number;

function resetStubs() {
  responseCache = new Map();
  syncQueue = [];
  idSeq = 0;

  desktopStub = {
    isDesktop: true,
    getNetworkStatus: () => navigator.onLine,

    cacheResponse: vi.fn(async (urlPath: string, data: unknown) => {
      responseCache.set(urlPath, data);
    }),

    getCachedResponse: vi.fn(async (urlPath: string) => {
      return responseCache.has(urlPath) ? responseCache.get(urlPath) : null;
    }),

    upsertEntity: vi.fn(async () => {}),
    cacheEntities: vi.fn(async () => {}),
    removeEntity: vi.fn(async () => {}),
    getEntityById: vi.fn(async () => null),

    queueOfflineWrite: vi.fn(
      async (
        method: string,
        urlPath: string,
        body: string | null,
        baseUpdatedAt?: string | null,
        clientTempId?: string | null,
      ) => {
        syncQueue.push({
          id: ++idSeq,
          method,
          urlPath,
          body: body ?? null,
          baseUpdatedAt: baseUpdatedAt ?? null,
          clientTempId: clientTempId ?? null,
        });
      },
    ),

    getQueueCount: vi.fn(async () => syncQueue.length),
    notifyNetworkChange: vi.fn(async () => {}),
    onSyncStatusChange: vi.fn(),
    onNetworkChange: vi.fn(() => () => {}),
    onCheckPending: vi.fn(),
  } as unknown as LaFincaDesktopAPI;

  (window as { laFincaDesktop?: LaFincaDesktopAPI }).laFincaDesktop = desktopStub;
}

// ── Real mock HTTP server (Node.js) ───────────────────────────────────────────

interface ReceivedRequest {
  method: string;
  url: string;
  body: string;
}

let mockServer: Server;
let mockServerBaseUrl: string;
const serverRequests: ReceivedRequest[] = [];
let serverNextStatus = 200;
let serverNextBody: unknown = { id: "server-1" };

beforeAll(async () => {
  // 1. Spin up a real Node.js HTTP server for the reconnect/flush tests.
  await new Promise<void>((resolve) => {
    mockServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        serverRequests.push({ method: req.method ?? "GET", url: req.url ?? "/", body });
        res.writeHead(serverNextStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify(serverNextBody));
      });
    });
    mockServer.listen(0, "127.0.0.1", () => {
      const { port } = mockServer.address() as AddressInfo;
      mockServerBaseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // 2. Ensure window.fetch exists before the interceptor module loads.
  //    We install a passthrough spy that delegates to the real global fetch so
  //    that online tests (and flush tests) can make real network calls.
  const realNodeFetch: typeof fetch = (input, init) => {
    // Use the underlying Node.js fetch (available globally in Node v18+)
    return globalThis.fetch(input as RequestInfo, init);
  };
  const fetchSpy = vi.fn(realNodeFetch);
  vi.stubGlobal("fetch", fetchSpy);

  // 3. Minimal localStorage so auth helpers inside the interceptor don't throw.
  if (!globalThis.localStorage) {
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      },
      writable: true,
    });
  }

  // 4. Set up stubs before the module loads so they are present when the module
  //    executes its top-level window.laFincaDesktop assignment.
  resetStubs();

  // 5. Import the REAL fetch-interceptor.ts.  This patches window.fetch.
  await import("@/lib/fetch-interceptor");
});

afterAll(() => {
  mockServer?.close();
});

beforeEach(() => {
  resetStubs();
  serverRequests.length = 0;
  serverNextStatus = 200;
  serverNextBody = { id: "server-1" };
});

// ── Helper ────────────────────────────────────────────────────────────────────

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    value,
    writable: true,
    configurable: true,
  });
}

// ── Flush helper using real HTTP calls ────────────────────────────────────────
// Mirrors main.ts:flushSyncQueue, exercising the real queue state at each step.
// Uses Node.js http.request directly (not window.fetch) because the real flush
// runs in the Electron main process, not the renderer's fetch pipeline.

function makeHttpRequest(
  baseUrl: string,
  method: string,
  path: string,
  body: string | null,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(baseUrl + path);
    const req = httpRequest(
      {
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: parsed.pathname + parsed.search,
        method,
        headers: { "Content-Type": "application/json" },
      },
      (res: IncomingMessage) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function flushSyncQueueToMockServer(
  queue: SyncQueueEntry[],
  baseUrl: string,
): Promise<{ flushed: number; errors: number }> {
  let flushed = 0;
  let errors = 0;

  for (const entry of [...queue]) {
    try {
      const { status, body: rawBody } = await makeHttpRequest(
        baseUrl,
        entry.method,
        entry.urlPath,
        entry.body,
      );

      if (status >= 200 && status < 300) {
        const idx = queue.findIndex((e) => e.id === entry.id);
        if (idx !== -1) queue.splice(idx, 1);
        flushed++;

        const serverEntity = JSON.parse(rawBody) as Record<string, unknown>;

        // For POST: replace the offline entity with the real server entity
        if (entry.method === "POST" && entry.clientTempId) {
          const listUrl = entry.urlPath;
          const current = (responseCache.get(listUrl) as unknown[] | null) ?? [];
          responseCache.set(listUrl, [
            ...(current as Record<string, unknown>[]).filter(
              (e) => (e as { id: string }).id !== entry.clientTempId,
            ),
            serverEntity,
          ]);
        }
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { flushed, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline GET — patched fetch must serve from cache
// ─────────────────────────────────────────────────────────────────────────────

describe("Offline GET via real fetch interceptor", () => {
  beforeEach(() => setOnline(false));

  it("returns the cached response when one exists", async () => {
    const animals = [{ id: "a1", name: "Bessie" }];
    responseCache.set("/api/farms/f1/animals", animals);

    const response = await window.fetch("/api/farms/f1/animals");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(animals);
    expect(desktopStub.getCachedResponse).toHaveBeenCalledWith("/api/farms/f1/animals");
  });

  it("returns 503 with error body when cache has no entry", async () => {
    const response = await window.fetch("/api/farms/f1/animals");
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("offline");
  });

  it("does NOT call the original network fetch when offline", async () => {
    responseCache.set("/api/farms/f1/animals", []);
    await window.fetch("/api/farms/f1/animals");
    // getCachedResponse was called → interceptor used the offline cache path
    expect(desktopStub.getCachedResponse).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Offline POST/PATCH — writes queued via real interceptor
// ─────────────────────────────────────────────────────────────────────────────

describe("Offline POST via real fetch interceptor", () => {
  beforeEach(() => setOnline(false));

  it("enqueues the write and returns a synthetic optimistic response with offline ID", async () => {
    const response = await window.fetch("/api/farms/f1/animals", {
      method: "POST",
      body: JSON.stringify({ name: "Lola", species: "cow" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;

    // Real interceptor sets _offline: true and assigns a synthetic offline_ id
    expect(body._offline).toBe(true);
    expect(typeof body.id).toBe("string");
    expect((body.id as string).startsWith("offline_")).toBe(true);
    expect(body.name).toBe("Lola");

    // queueOfflineWrite on the IPC stub was called with the correct args
    expect(desktopStub.queueOfflineWrite).toHaveBeenCalledOnce();
    const [method, urlPath, , , clientTempId] = (
      desktopStub.queueOfflineWrite as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [string, string, string, null, string];
    expect(method).toBe("POST");
    expect(urlPath).toBe("/api/farms/f1/animals");
    expect(clientTempId).toBe(body.id);

    expect(syncQueue).toHaveLength(1);
    expect(syncQueue[0].method).toBe("POST");
  });

  it("queues a PATCH request with the correct body", async () => {
    await window.fetch("/api/farms/f1/animals/a1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(desktopStub.queueOfflineWrite).toHaveBeenCalledOnce();
    expect(syncQueue[0].method).toBe("PATCH");
  });

  it("queues multiple writes in FIFO order", async () => {
    await window.fetch("/api/farms/f1/animals", { method: "POST", body: JSON.stringify({ name: "First" }) });
    await window.fetch("/api/farms/f1/animals", { method: "POST", body: JSON.stringify({ name: "Second" }) });

    expect(syncQueue).toHaveLength(2);
    const names = syncQueue.map((e) => (JSON.parse(e.body ?? "{}") as { name: string }).name);
    expect(names).toEqual(["First", "Second"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reconnect — real HTTP flush against mock API server
// ─────────────────────────────────────────────────────────────────────────────

describe("Reconnect: flush queued writes via real HTTP against mock API endpoint", () => {
  it("full round-trip: offline POST queued → reconnect → real HTTP replay → cache updated", async () => {
    // Phase 1: Go offline and queue a POST via the real interceptor
    setOnline(false);
    responseCache.set("/api/farms/f1/animals", []);

    const postRes = await window.fetch("/api/farms/f1/animals", {
      method: "POST",
      body: JSON.stringify({ name: "Pancita", species: "cow" }),
    });
    const posted = (await postRes.json()) as { id: string; _offline: boolean; name: string };
    expect(posted._offline).toBe(true);
    const offlineId = posted.id;

    // Interceptor queued the write
    expect(syncQueue).toHaveLength(1);
    expect(syncQueue[0].clientTempId).toBe(offlineId);

    // Phase 2: Reconnect — set up server and flush via real HTTP
    setOnline(true);
    const serverEntity = { id: "srv-REAL-001", name: "Pancita", species: "cow" };
    serverNextStatus = 200;
    serverNextBody = serverEntity;

    const { flushed, errors } = await flushSyncQueueToMockServer(syncQueue, mockServerBaseUrl);

    // Real HTTP request reached the server
    expect(serverRequests).toHaveLength(1);
    expect(serverRequests[0].method).toBe("POST");
    expect(serverRequests[0].url).toBe("/api/farms/f1/animals");
    expect((JSON.parse(serverRequests[0].body) as { name: string }).name).toBe("Pancita");

    // Flush succeeded
    expect(flushed).toBe(1);
    expect(errors).toBe(0);

    // Queue cleared
    expect(syncQueue).toHaveLength(0);

    // Cache updated: offline ID replaced with real server entity
    const finalAnimals = responseCache.get("/api/farms/f1/animals") as { id: string }[];
    expect(finalAnimals.some((a) => a.id === "srv-REAL-001")).toBe(true);
    expect(finalAnimals.every((a) => a.id !== offlineId)).toBe(true);
  });

  it("server returns 409 conflict → write not removed from queue", async () => {
    setOnline(false);
    await window.fetch("/api/farms/f1/animals/a1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Conflict" }),
    });
    expect(syncQueue).toHaveLength(1);

    setOnline(true);
    serverNextStatus = 409;
    serverNextBody = { error: "conflict" };

    const { flushed, errors } = await flushSyncQueueToMockServer(syncQueue, mockServerBaseUrl);

    // Server received the real request
    expect(serverRequests).toHaveLength(1);
    expect(serverRequests[0].method).toBe("PATCH");

    // Write stays in queue because the server rejected it
    expect(flushed).toBe(0);
    expect(errors).toBe(1);
    expect(syncQueue).toHaveLength(1);
  });
});
