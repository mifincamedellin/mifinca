/**
 * Global fetch interceptor.
 *
 * Responsibilities:
 * 1. Inject the Authorization header on all /api/* requests (both browser and desktop).
 * 2. Desktop offline reads  → serve from URL-keyed cache (or 503 on cache miss).
 * 3. Desktop offline writes → queue for later replay AND optimistically update the
 *    local entity + list caches so the UI reflects the change immediately.
 * 4. Desktop online reads   → pass through, then cache the successful response.
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
 * subsequent offline GETs reflect the change without waiting for sync.
 *
 * @param method     HTTP method of the queued write
 * @param path       URL path of the write
 * @param bodyStr    Serialised request body (if any)
 * @param syntheticId The fake ID assigned to new entities (used for POST)
 * @param desktop    The contextBridge-exposed desktop API
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

  // Helper: read current list from cache, mutate it, write it back
  async function refreshListCache(
    updater: (list: Record<string, unknown>[]) => Record<string, unknown>[],
  ) {
    const current = await desktop.getCachedResponse!(listUrl).catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(current) ? current : [];
    const updated = updater(list);
    await desktop.cacheResponse!(listUrl, updated).catch(() => {});
  }

  if (method === "DELETE" && entityId) {
    // Remove from entity cache
    await desktop.removeEntity!(entityType, entityId).catch(() => {});
    // Remove from list cache
    await refreshListCache((list) => list.filter((e) => e.id !== entityId));
    return;
  }

  if ((method === "POST" || method === "PUT" || method === "PATCH") && bodyStr) {
    let bodyObj: Record<string, unknown> = {};
    try { bodyObj = JSON.parse(bodyStr) as Record<string, unknown>; } catch { return; }

    const now = new Date().toISOString();

    if (method === "POST") {
      // New entity — assign the synthetic ID and farm ID
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
      // Update existing entity — keep original id
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
      // No cached response — return 503 so the UI can show a clear offline message
      return new Response(
        JSON.stringify({ error: "offline", message: "Sin conexión — no hay datos en caché" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // Write (POST / PUT / PATCH / DELETE) — queue and apply optimistic update
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

    const syntheticId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const queueId = await desktop.queueOfflineWrite!(method, path, bodyStr).catch(() => -1);

    // Optimistically reflect the write in local caches so the UI stays consistent
    await applyOptimisticMutation(method, path, bodyStr, syntheticId, desktop);

    return new Response(
      JSON.stringify({ id: syntheticId, _offline: true, _queueId: queueId }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Online path (browser and desktop) ────────────────────────────────────
  const response = await originalFetch(input, { ...init, headers });

  // Cache successful GET responses in desktop mode for future offline reads
  if (desktop?.isDesktop && method === "GET" && response.ok) {
    const path = toPathAndSearch(rawUrl);
    response
      .clone()
      .json()
      .then((data: unknown) => desktop.cacheResponse!(path, data))
      .catch(() => {});
  }

  return response;
};

export {};
