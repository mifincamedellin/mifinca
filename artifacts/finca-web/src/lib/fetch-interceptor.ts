/** Global fetch interceptor: auth injection, offline cache serving, offline write queuing, write-through caching. */

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

/**
 * Entity types stored in the fine-grained SQLite entity_cache table.
 * For types NOT in this set (e.g. medical_records, weight_records, animal_milk_records)
 * only the URL-keyed response_cache is updated — never entity_cache — to prevent
 * corrupting unrelated entity lists.
 */
const ENTITY_CACHE_TYPES = new Set([
  "animals",
  "farms",
  "finance_transactions",
  "inventory_items",
  "contacts",
  "farm_events",
  "employees",
  "zones",
  "farm_milk_records",
  "farm_members",
  "farm_invitations",
]);

interface ParsedUrl {
  entityType: string;
  farmId: string | null;
  entityId: string | null;
  /** Canonical list endpoint URL for this entity type + scope */
  listUrl: string;
}

type RouteDescriptor = {
  re: RegExp;
  entityType: string;
  toResult: (m: RegExpMatchArray) => Omit<ParsedUrl, "entityType">;
};

/**
 * Route patterns ordered most-specific first.
 * Must stay in sync with the same table in artifacts/finca-desktop/src/main.ts.
 */
const ROUTE_PATTERNS: RouteDescriptor[] = [
  // ── Animal sub-resources (must precede /animals/:id) ─────────────────────
  // Each pattern matches both the list endpoint AND the detail endpoint (/:recordId)
  // so entityId is resolved for individual-record PUT/DELETE conflict checks.
  {
    re: /^\/api\/farms\/([^/]+)\/animals\/([^/]+)\/medical(?:\/([^/]+))?$/,
    entityType: "medical_records",
    toResult: (m) => ({ farmId: m[1], entityId: m[3] ?? null, listUrl: `/api/farms/${m[1]}/animals/${m[2]}/medical` }),
  },
  {
    re: /^\/api\/farms\/([^/]+)\/animals\/([^/]+)\/milk(?:\/([^/]+))?$/,
    entityType: "animal_milk_records",
    toResult: (m) => ({ farmId: m[1], entityId: m[3] ?? null, listUrl: `/api/farms/${m[1]}/animals/${m[2]}/milk` }),
  },
  {
    re: /^\/api\/farms\/([^/]+)\/animals\/([^/]+)\/weights(?:\/([^/]+))?$/,
    entityType: "weight_records",
    toResult: (m) => ({ farmId: m[1], entityId: m[3] ?? null, listUrl: `/api/farms/${m[1]}/animals/${m[2]}/weights` }),
  },
  {
    re: /^\/api\/farms\/([^/]+)\/animals\/([^/]+)\/lifecycle-history$/,
    entityType: "lifecycle_history",
    toResult: (m) => ({ farmId: m[1], entityId: null, listUrl: `/api/farms/${m[1]}/animals/${m[2]}/lifecycle-history` }),
  },
  // Lifecycle / death / lineage / pregnancy patches → classify as 'animals'
  {
    re: /^\/api\/farms\/([^/]+)\/animals\/([^/]+)\/(lifecycle|death|lineage|pregnancy)(\/.*)?$/,
    entityType: "animals",
    toResult: (m) => ({ farmId: m[1], entityId: m[2], listUrl: `/api/farms/${m[1]}/animals` }),
  },
  // Individual animal
  {
    re: /^\/api\/farms\/([^/]+)\/animals\/([^/]+)$/,
    entityType: "animals",
    toResult: (m) => ({ farmId: m[1], entityId: m[2], listUrl: `/api/farms/${m[1]}/animals` }),
  },
  // Animals list
  {
    re: /^\/api\/farms\/([^/]+)\/animals$/,
    entityType: "animals",
    toResult: (m) => ({ farmId: m[1], entityId: null, listUrl: `/api/farms/${m[1]}/animals` }),
  },
  // ── Farm-level milk ──────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/milk$/,
    entityType: "farm_milk_records",
    toResult: (m) => ({ farmId: m[1], entityId: null, listUrl: `/api/farms/${m[1]}/milk` }),
  },
  // ── Finances ─────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/finances(?:\/([^/]+))?$/,
    entityType: "finance_transactions",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/finances` }),
  },
  // ── Inventory ────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/inventory(?:\/([^/]+))?$/,
    entityType: "inventory_items",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/inventory` }),
  },
  // ── Contacts ─────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/contacts(?:\/([^/]+))?$/,
    entityType: "contacts",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/contacts` }),
  },
  // ── Events ───────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/events(?:\/([^/]+))?$/,
    entityType: "farm_events",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/events` }),
  },
  // ── Employee attachments (must precede /employees/:id) ───────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/employees\/([^/]+)\/attachments(?:\/([^/]+))?(\/.*)?$/,
    entityType: "employee_attachments",
    toResult: (m) => ({ farmId: m[1], entityId: m[3] ?? null, listUrl: `/api/farms/${m[1]}/employees/${m[2]}/attachments` }),
  },
  // ── Employees ────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/employees(?:\/([^/]+))?$/,
    entityType: "employees",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/employees` }),
  },
  // ── Zones ────────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/zones(?:\/([^/]+))?$/,
    entityType: "zones",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/zones` }),
  },
  // ── Farm members ─────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/members(?:\/([^/]+))?$/,
    entityType: "farm_members",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/members` }),
  },
  // ── Farm invitations ─────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/invitations(?:\/([^/]+))?$/,
    entityType: "farm_invitations",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/invitations` }),
  },
  // ── Farm operational endpoints (stats, activity, seed, location, pay-day) ─
  {
    re: /^\/api\/farms\/([^/]+)\/(stats|activity|seed|location|pay-day)$/,
    entityType: "farms",
    toResult: (m) => ({ farmId: m[1], entityId: m[1], listUrl: "/api/farms" }),
  },
  // ── Individual farm ──────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)$/,
    entityType: "farms",
    toResult: (m) => ({ farmId: m[1], entityId: m[1], listUrl: "/api/farms" }),
  },
  // ── Farm list ────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms$/,
    entityType: "farms",
    toResult: () => ({ farmId: null, entityId: null, listUrl: "/api/farms" }),
  },
];

function parseEntityUrl(path: string): ParsedUrl | null {
  const bare = path.split("?")[0];
  for (const descriptor of ROUTE_PATTERNS) {
    const m = bare.match(descriptor.re);
    if (m) return { entityType: descriptor.entityType, ...descriptor.toResult(m) };
  }
  return null;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

type Desktop = NonNullable<typeof window.miFincaDesktop>;

async function applyOptimisticMutation(
  method: string,
  path: string,
  bodyStr: string | null,
  syntheticId: string,
  desktop: Desktop,
): Promise<void> {
  const parsed = parseEntityUrl(path);
  if (!parsed) return;

  const { entityType, farmId, entityId, listUrl } = parsed;
  const isTopLevel = ENTITY_CACHE_TYPES.has(entityType);

  async function refreshListCache(
    updater: (list: Record<string, unknown>[]) => Record<string, unknown>[],
  ) {
    const current = await desktop.getCachedResponse!(listUrl).catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(current) ? current : [];
    await desktop.cacheResponse!(listUrl, updater(list)).catch(() => {});
  }

  if (method === "DELETE" && entityId) {
    if (isTopLevel) await desktop.removeEntity!(entityType, entityId).catch(() => {});
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
      if (isTopLevel) await desktop.upsertEntity!(entityType, entity).catch(() => {});
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
      if (isTopLevel) await desktop.upsertEntity!(entityType, entity).catch(() => {});
      await refreshListCache((list) =>
        list.map((e) => (e.id === id ? { ...e, ...entity } : e)),
      );
    }
  }
}

async function applyOnlineWriteToCache(
  method: string,
  path: string,
  serverEntity: Record<string, unknown>,
  desktop: Desktop,
): Promise<void> {
  const parsed = parseEntityUrl(path);
  if (!parsed) return;

  const { entityType, farmId, entityId, listUrl } = parsed;
  const isTopLevel = ENTITY_CACHE_TYPES.has(entityType);

  if (method === "DELETE") {
    const id = entityId ?? (serverEntity.id as string | undefined);
    if (isTopLevel) {
      if (id) await desktop.removeEntity!(entityType, id).catch(() => {});
      const cur = await desktop.getCachedResponse!(listUrl).catch(() => null);
      const lst: Record<string, unknown>[] = Array.isArray(cur) ? cur : [];
      await desktop.cacheResponse!(listUrl, lst.filter((e) => e.id !== id)).catch(() => {});
    } else if (id) {
      const cur = await desktop.getCachedResponse!(listUrl).catch(() => null);
      const lst: Record<string, unknown>[] = Array.isArray(cur) ? cur : [];
      await desktop.cacheResponse!(listUrl, lst.filter((e) => e.id !== id)).catch(() => {});
      await desktop.cacheResponse!(`${listUrl}/${id}`, null).catch(() => {});
    }
    return;
  }

  if (!("id" in serverEntity)) return;
  const id = serverEntity.id;

  const cur = await desktop.getCachedResponse!(listUrl).catch(() => null);
  const lst: Record<string, unknown>[] = Array.isArray(cur) ? cur : [];

  if (isTopLevel) {
    await desktop.upsertEntity!(entityType, serverEntity).catch(() => {});
    if (method === "POST") {
      await desktop.cacheResponse!(listUrl, [...lst, serverEntity]).catch(() => {});
    } else {
      await desktop.cacheResponse!(listUrl, lst.map((e) => (e.id === id ? { ...e, ...serverEntity } : e))).catch(() => {});
    }
    if (method !== "POST" && entityId) {
      await desktop.cacheResponse!(path.split("?")[0], serverEntity).catch(() => {});
    }
  } else {
    if (method === "POST") {
      await desktop.cacheResponse!(listUrl, [...lst, serverEntity]).catch(() => {});
      await desktop.cacheResponse!(`${listUrl}/${String(id)}`, serverEntity).catch(() => {});
    } else {
      await desktop.cacheResponse!(listUrl, lst.map((e) => (e.id === id ? { ...e, ...serverEntity } : e))).catch(() => {});
      await desktop.cacheResponse!(path.split("?")[0], serverEntity).catch(() => {});
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

  // ── Desktop offline path ──────────────────────────────────────────────────
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
      // Fallback: check entity_cache for detail endpoints (seeded entities that
      // don't yet have an individual detail URL in response_cache)
      const parsedGet = parseEntityUrl(path);
      if (parsedGet?.entityId && desktop.getEntityById) {
        const entity = await desktop.getEntityById(parsedGet.entityType, parsedGet.entityId).catch(() => null);
        if (entity) {
          return new Response(JSON.stringify(entity), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      return new Response(
        JSON.stringify({ error: "offline", message: "Sin conexión — no hay datos en caché" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

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

    // Read baseUpdatedAt from response_cache (detail URL) then entity_cache fallback
    let baseUpdatedAt: string | null = null;
    const parsedForBase = parseEntityUrl(path);
    if (
      (method === "PUT" || method === "PATCH" || method === "DELETE") &&
      parsedForBase?.entityId
    ) {
      const { entityType, entityId, listUrl } = parsedForBase;
      const detailUrl = `${listUrl}/${entityId}`;
      try {
        const c = await desktop.getCachedResponse!(detailUrl);
        if (c && typeof c === "object" && !Array.isArray(c)) {
          const rec = c as Record<string, unknown>;
          const ts = rec.updatedAt ?? rec.updated_at;
          if (typeof ts === "string") baseUpdatedAt = ts;
        }
      } catch { /* ignore */ }
      if (!baseUpdatedAt && desktop.getEntityById) {
        try {
          const ent = await desktop.getEntityById(entityType, entityId);
          if (ent) {
            const ts = ent.updatedAt ?? ent.updated_at;
            if (typeof ts === "string") baseUpdatedAt = ts;
          }
        } catch { /* ignore */ }
      }
    }

    const syntheticId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const clientTempId = method === "POST" ? syntheticId : null;
    await desktop.queueOfflineWrite!(method, path, bodyStr, baseUpdatedAt, clientTempId).catch(() => {});

    await applyOptimisticMutation(method, path, bodyStr, syntheticId, desktop);

    // Return a response that matches the server's expected shape
    let offlineBody: unknown;
    if (method === "DELETE") {
      offlineBody = { ok: true };
    } else {
      let bodyObj: Record<string, unknown> = {};
      try { bodyObj = JSON.parse(bodyStr ?? "{}") as Record<string, unknown>; } catch { /* ignore */ }
      const now = new Date().toISOString();
      const parsedWrite = parseEntityUrl(path);
      if (method === "POST") {
        offlineBody = {
          ...bodyObj,
          id: syntheticId,
          ...(parsedWrite?.farmId ? { farmId: parsedWrite.farmId } : {}),
          createdAt: now,
          updatedAt: now,
          _offline: true,
        };
      } else {
        offlineBody = {
          ...bodyObj,
          id: parsedWrite?.entityId ?? (bodyObj.id as string | undefined) ?? syntheticId,
          updatedAt: now,
          _offline: true,
        };
      }
    }

    return new Response(JSON.stringify(offlineBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
      // Write-through: keep SQLite current while online
      response
        .clone()
        .json()
        .then((data: unknown) => {
          if (data && typeof data === "object" && !Array.isArray(data)) {
            applyOnlineWriteToCache(method, path, data as Record<string, unknown>, desktop);
          } else if (method === "DELETE") {
            applyOnlineWriteToCache(method, path, {}, desktop);
          }
        })
        .catch(() => {
          if (method === "DELETE") {
            // 204 No Content — apply removal by URL
            applyOnlineWriteToCache(method, path, {}, desktop).catch(() => {});
          }
        });
    }
  }

  return response;
};

export {};
