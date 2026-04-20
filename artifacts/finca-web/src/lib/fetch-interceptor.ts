/**
 * Global fetch interceptor.
 *
 * Responsibilities:
 * 1. Inject the Authorization header on all /api/* requests (both browser and desktop).
 * 2. Desktop offline reads  → serve from URL-keyed cache (503 on cache miss).
 * 3. Desktop offline writes → queue for later replay AND optimistically update the
 *    local entity + list caches so the UI reflects the change immediately.
 * 4. Desktop online reads   → pass through, then cache the successful response.
 * 5. Desktop online writes  → pass through, then update entity + list caches with
 *    the authoritative server response (write-through for offline reads).
 */

const originalFetch = window.fetch.bind(window);

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("finca-storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

/** Return `path + search` from a raw URL string (strips origin). */
function toPathAndSearch(rawUrl: string): string {
  try {
    const u = new URL(rawUrl, window.location.href);
    return u.pathname + u.search;
  } catch {
    return rawUrl;
  }
}

// ── URL → entity-type mapping ─────────────────────────────────────────────────
// Must match the mapping in artifacts/finca-desktop/src/main.ts

const URL_SEGMENT_TO_ENTITY: Record<string, string> = {
  animals: "animals",
  "milk-records": "milk_records",
  finances: "finance_transactions",
  inventory: "inventory_items",
  contacts: "contacts",
  events: "farm_events",
  farms: "farms",
};

interface ParsedUrl {
  entityType: string;
  farmId: string | null;
  entityId: string | null;
  /** Canonical list endpoint URL for this entity type + farm */
  listUrl: string;
}

function parseEntityUrl(path: string): ParsedUrl | null {
  const bare = path.split("?")[0];

  // /api/farms/:farmId/segment[/:entityId]
  const deep = bare.match(/^\/api\/farms\/([^/]+)\/([^/]+)(?:\/([^/]+))?/);
  if (deep) {
    const [, farmId, segment, entityId] = deep;
    const entityType = URL_SEGMENT_TO_ENTITY[segment];
    if (!entityType) return null;
    return {
      entityType,
      farmId,
      entityId: entityId ?? null,
      listUrl: `/api/farms/${farmId}/${segment}`,
    };
  }

  // /api/farms[/:id]
  const farmsMatch = bare.match(/^\/api\/farms(?:\/([^/]+))?/);
  if (farmsMatch) {
    return {
      entityType: "farms",
      farmId: null,
      entityId: farmsMatch[1] ?? null,
      listUrl: "/api/farms",
    };
  }

  return null;
}

/**
 * Optimistically apply an offline write to the local SQLite caches so that
 * subsequent offline GETs reflect the change immediately.
 */
async function applyOptimisticMutation(
  method: string,
  path: string,
  bodyStr: string | null,
  syntheticId: string,
  desktop: NonNullable<typeof window.miFincaDesktop>,
): Promise<void> {
  const parsed = parseEntityUrl(path);
  if (!parsed) return;

  const { entityType, farmId, entityId, listUrl } = parsed;

  async function refreshListCache(
    updater: (list: Record<string, unknown>[]) => Record<string, unknown>[],
  ) {
    const current = await desktop.getCachedResponse!(listUrl).catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(current) ? current : [];
    await desktop.cacheResponse!(listUrl, updater(list)).catch(() => {});
  }

  if (method === "DELETE" && entityId) {
    await desktop.removeEntity!(entityType, entityId).catch(() => {});
    await refreshListCache((list) => list.filter((e) => e.id !== entityId));
    return;
  }

  if ((method === "POST" || method === "PUT" || method === "PATCH") && bodyStr) {
    let bodyObj: Record<string, unknown> = {};
    try { bodyObj = JSON.parse(bodyStr) as Record<string, unknown>; } catch { return; }

    const now = new Date().toISOString();

    if (method === "POST") {
      const entity: Record<string, unknown> = {
        ...bodyObj,
        id: syntheticId,
        _offline: true,
        createdAt: now,
        updatedAt: now,
        ...(farmId ? { farmId } : {}),
      };
      await desktop.upsertEntity!(entityType, entity).catch(() => {});
      await refreshListCache((list) => [...list, entity]);
    } else {
      const id = entityId ?? (bodyObj.id as string);
      if (!id) return;
      const entity: Record<string, unknown> = {
        ...bodyObj,
        id,
        _offline: true,
        updatedAt: now,
        ...(farmId ? { farmId } : {}),
      };
      await desktop.upsertEntity!(entityType, entity).catch(() => {});
      await refreshListCache((list) =>
        list.map((e) => (e.id === id ? { ...e, ...entity } : e)),
      );
    }
  }
}

/**
 * Apply a successful online write response to local caches (write-through).
 * Keeps SQLite current so offline reads are up to date after every mutation.
 */
async function applyOnlineWriteToCache(
  method: string,
  path: string,
  serverEntity: Record<string, unknown>,
  desktop: NonNullable<typeof window.miFincaDesktop>,
): Promise<void> {
  const parsed = parseEntityUrl(path);
  if (!parsed) return;

  const { entityType, farmId, entityId, listUrl } = parsed;

  if (method === "DELETE") {
    if (entityId) await desktop.removeEntity!(entityType, entityId).catch(() => {});
  } else if ("id" in serverEntity) {
    await desktop.upsertEntity!(entityType, serverEntity).catch(() => {});
    // Refresh the list cache from the live entity cache
    // (simpler than trying to splice – entity cache is the source of truth)
    const current = await desktop.getCachedResponse!(listUrl).catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(current) ? current : [];
    const id = serverEntity.id;
    if (method === "POST") {
      await desktop.cacheResponse!(listUrl, [...list, serverEntity]).catch(() => {});
    } else {
      await desktop
        .cacheResponse!(
          listUrl,
          list.map((e) => (e.id === id ? { ...e, ...serverEntity } : e)),
        )
        .catch(() => {});
    }
    // Also update the individual entity URL cache for PUT/PATCH
    if (method !== "POST" && entityId) {
      await desktop.cacheResponse!(path, serverEntity).catch(() => {});
    }
  }

  // Suppress unused warning — farmId is read by parseEntityUrl callers
  void farmId;
}

/** Extract `updated_at` / `updatedAt` from a parsed JSON body string, if present. */
function extractUpdatedAt(bodyStr: string | null): string | null {
  if (!bodyStr) return null;
  try {
    const obj = JSON.parse(bodyStr) as Record<string, unknown>;
    const v = obj.updatedAt ?? obj.updated_at;
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

// ── Patched fetch ─────────────────────────────────────────────────────────────

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  const isApiCall = rawUrl.startsWith("/api") || rawUrl.includes("/api/");
  if (!isApiCall) {
    return originalFetch(input, init);
  }

  // Build headers with auth token
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : {}),
  );
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

  const desktop = window.miFincaDesktop;

  // ── Desktop offline path ───────────────────────────────────────────────────
  if (desktop?.isDesktop && !navigator.onLine) {
    const path = toPathAndSearch(rawUrl);

    if (method === "GET") {
      const cached = await desktop.getCachedResponse!(path).catch(() => null);
      if (cached !== null && cached !== undefined) {
        return new Response(JSON.stringify(cached), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // No cache hit — 503 so UI can show a clear offline message instead of rendering broken data
      return new Response(
        JSON.stringify({ error: "offline", message: "Sin conexión — no hay datos en caché" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // Write — queue and apply optimistic update to local caches
    let bodyStr: string | null = null;
    if (init?.body) {
      bodyStr =
        typeof init.body === "string"
          ? init.body
          : init.body instanceof FormData
            ? null
            : JSON.stringify(init.body);
    } else if (input instanceof Request) {
      bodyStr = await input.clone().text().catch(() => null);
    }

    // Capture entity version at write time for server-wins conflict resolution
    const baseUpdatedAt = extractUpdatedAt(bodyStr);
    const syntheticId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const queueId = await desktop.queueOfflineWrite!(method, path, bodyStr, baseUpdatedAt).catch(() => -1);

    // Optimistically reflect the write in local caches
    await applyOptimisticMutation(method, path, bodyStr, syntheticId, desktop);

    return new Response(
      JSON.stringify({ id: syntheticId, _offline: true, _queueId: queueId }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Online path (browser and desktop) ────────────────────────────────────
  const response = await originalFetch(input, { ...init, headers });

  if (desktop?.isDesktop && response.ok) {
    const path = toPathAndSearch(rawUrl);

    if (method === "GET") {
      // Cache GET responses for offline reads
      response
        .clone()
        .json()
        .then((data: unknown) => desktop.cacheResponse!(path, data))
        .catch(() => {});
    } else if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
      // Write-through: update entity + list caches with the authoritative server response
      // so SQLite stays current even while online.
      response
        .clone()
        .json()
        .then((data: unknown) => {
          if (data && typeof data === "object" && !Array.isArray(data)) {
            applyOnlineWriteToCache(
              method,
              path,
              data as Record<string, unknown>,
              desktop,
            );
          } else if (method === "DELETE") {
            // DELETE may return empty body — apply removal anyway
            applyOnlineWriteToCache(method, path, {}, desktop);
          }
        })
        .catch(() => {
          // DELETE may return 204 with no body — apply removal from URL
          if (method === "DELETE") {
            applyOnlineWriteToCache(method, path, {}, desktop).catch(() => {});
          }
        });
    }
  }

  return response;
};

export {};
