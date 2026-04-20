import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  session,
  safeStorage,
  nativeTheme,
  shell,
  type IpcMainInvokeEvent,
  type IncomingMessage,
} from "electron";
import { autoUpdater } from "electron-updater";
import path from "path";
import fs from "fs";
import { URL } from "url";
import {
  openDatabase,
  cacheResponse,
  getCachedResponse,
  upsertEntities,
  upsertSingleEntity,
  removeEntity,
  getEntities,
  getEntityById,
  storeIdMapping,
  rewriteQueueIds,
  enqueueWrite,
  getPendingQueue,
  removeFromQueue,
  markQueueError,
  getQueueCount,
} from "./offline-db.js";

// ── Configuration ─────────────────────────────────────────────────────────────

/** Production API base. Set MIFINCA_API_URL at build time or via env. */
const API_BASE =
  process.env.MIFINCA_API_URL ?? "https://mifinca.replit.app";

const IS_DEV = process.env.MIFINCA_DEV === "1" || !app.isPackaged;
const USER_DATA_DIR = app.getPath("userData");
const LICENSE_FILE = path.join(USER_DATA_DIR, "license.dat");

// ── Offline / Sync state ──────────────────────────────────────────────────────

/**
 * "idle"       = online, nothing pending
 * "syncing"    = flush in progress
 * "up_to_date" = sync just completed successfully (transient, reverts to "idle" after 3 s)
 * "offline"    = no network connection
 * "error"      = one or more writes failed and need attention
 */
type SyncStatus = "idle" | "syncing" | "up_to_date" | "offline" | "error";

let currentSyncStatus: SyncStatus = "idle";
let isSyncing = false;

function broadcastSyncStatus(status: SyncStatus): void {
  currentSyncStatus = status;
  mainWindow?.webContents.send("offline:sync-status", status);
}

// ── URL → entity type mapping ─────────────────────────────────────────────────

/**
 * Entity types that are stored in the fine-grained `entity_cache` table.
 * For all other entity types (sub-resources like medical_records, weight_records,
 * animal_milk_records, etc.) we only use the URL-keyed `response_cache`.
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

interface ParsedEntityUrl {
  entityType: string;
  farmId: string | null;
  entityId: string | null;
  /** The URL path to the list endpoint (e.g. /api/farms/:farmId/animals) */
  listUrl: string;
}

type RouteDescriptor = {
  re: RegExp;
  entityType: string;
  toResult: (m: RegExpMatchArray) => Omit<ParsedEntityUrl, "entityType">;
};

/**
 * Route patterns ordered most-specific first. Every real API route must match
 * exactly one descriptor so no nested route is mis-classified as its parent.
 */
const ROUTE_PATTERNS: RouteDescriptor[] = [
  // ── Animal sub-resources (must precede general /animals/:id) ──────────────
  // Each pattern matches both the list endpoint and the detail endpoint (/:recordId)
  // so that entityId is resolved for individual-record operations.
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
  // Lifecycle patches + other operational patches on an animal → classify as 'animals'
  // so the animal record is correctly updated/conflict-checked after the patch.
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
  // ── Farm-level milk ───────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/milk$/,
    entityType: "farm_milk_records",
    toResult: (m) => ({ farmId: m[1], entityId: null, listUrl: `/api/farms/${m[1]}/milk` }),
  },
  // ── Finances ──────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/finances(?:\/([^/]+))?$/,
    entityType: "finance_transactions",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/finances` }),
  },
  // ── Inventory ─────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/inventory(?:\/([^/]+))?$/,
    entityType: "inventory_items",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/inventory` }),
  },
  // ── Contacts ──────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/contacts(?:\/([^/]+))?$/,
    entityType: "contacts",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/contacts` }),
  },
  // ── Events ────────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/events(?:\/([^/]+))?$/,
    entityType: "farm_events",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/events` }),
  },
  // ── Employee attachments (sub-resource, must precede /employees/:id) ──────
  {
    re: /^\/api\/farms\/([^/]+)\/employees\/([^/]+)\/attachments(?:\/([^/]+))?(\/.*)?$/,
    entityType: "employee_attachments",
    toResult: (m) => ({ farmId: m[1], entityId: m[3] ?? null, listUrl: `/api/farms/${m[1]}/employees/${m[2]}/attachments` }),
  },
  // ── Employees ─────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/employees(?:\/([^/]+))?$/,
    entityType: "employees",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/employees` }),
  },
  // ── Zones ─────────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/zones(?:\/([^/]+))?$/,
    entityType: "zones",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/zones` }),
  },
  // ── Farm members ──────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/members(?:\/([^/]+))?$/,
    entityType: "farm_members",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/members` }),
  },
  // ── Farm invitations ──────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)\/invitations(?:\/([^/]+))?$/,
    entityType: "farm_invitations",
    toResult: (m) => ({ farmId: m[1], entityId: m[2] ?? null, listUrl: `/api/farms/${m[1]}/invitations` }),
  },
  // ── Farm operational endpoints (stats, activity, seed, location, pay-day) ─
  // These patch the farm itself; map to farms so the farm record is refreshed.
  {
    re: /^\/api\/farms\/([^/]+)\/(stats|activity|seed|location|pay-day)$/,
    entityType: "farms",
    toResult: (m) => ({ farmId: m[1], entityId: m[1], listUrl: "/api/farms" }),
  },
  // ── Individual farm ───────────────────────────────────────────────────────
  {
    re: /^\/api\/farms\/([^/]+)$/,
    entityType: "farms",
    toResult: (m) => ({ farmId: m[1], entityId: m[1], listUrl: "/api/farms" }),
  },
  // ── Farm list ─────────────────────────────────────────────────────────────
  {
    re: /^\/api\/farms$/,
    entityType: "farms",
    toResult: () => ({ farmId: null, entityId: null, listUrl: "/api/farms" }),
  },
];

/**
 * Classify an API URL path into entity metadata.
 * Patterns are tested most-specific first, so nested routes are never
 * mis-classified as their parent resource.
 * Returns null for unrecognised paths (e.g. /api/auth/*, /api/chat/*).
 */
function parseEntityUrl(urlPath: string): ParsedEntityUrl | null {
  const bare = urlPath.split("?")[0];
  for (const descriptor of ROUTE_PATTERNS) {
    const m = bare.match(descriptor.re);
    if (m) {
      return { entityType: descriptor.entityType, ...descriptor.toResult(m) };
    }
  }
  return null;
}

/**
 * After a successful write or conflict resolution, update local caches
 * so subsequent offline reads reflect server truth.
 *
 * Top-level entities (in ENTITY_CACHE_TYPES):
 *   → upsert into entity_cache + refresh the list URL in response_cache
 * Sub-resources (medical_records, weight_records, etc.):
 *   → only update the individual entity URL in response_cache;
 *     the list will be refreshed on the next online GET
 */
function applyServerEntityToCache(
  parsed: ParsedEntityUrl,
  serverEntity: Record<string, unknown>,
): void {
  try {
    if (ENTITY_CACHE_TYPES.has(parsed.entityType)) {
      // Full entity-cache upsert + refresh the farm-scoped list URL
      upsertSingleEntity(parsed.entityType, serverEntity);
      const allEntities = parsed.farmId
        ? getEntities(parsed.entityType, parsed.farmId)
        : getEntities(parsed.entityType);
      cacheResponse(parsed.listUrl, allEntities);
    } else {
      // URL-scoped sub-resource (medical, milk, weights, attachments, etc.):
      // splice the new entity into the URL-keyed list cache so offline reads
      // of the list endpoint reflect the change.
      const id = serverEntity.id as string | undefined;
      if (id) {
        // Update individual detail URL
        cacheResponse(`${parsed.listUrl}/${id}`, serverEntity);
        // Splice into the list URL cache
        const raw = getCachedResponse(parsed.listUrl);
        const list: Record<string, unknown>[] = Array.isArray(raw) ? raw : [];
        const exists = list.some((e) => e.id === id);
        cacheResponse(
          parsed.listUrl,
          exists
            ? list.map((e) => (e.id === id ? { ...e, ...serverEntity } : e))
            : [...list, serverEntity],
        );
      }
    }
  } catch {
    // Non-fatal — best-effort
  }
}

// ── HTTP helpers (used during flush) ─────────────────────────────────────────

/** Fire a single `net.request` and return `{status, body}`. */
function netRequest(
  method: string,
  url: string,
  authToken: string,
  body?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = net.request({ method, url });
    req.setHeader("Content-Type", "application/json");
    if (authToken) req.setHeader("Authorization", `Bearer ${authToken}`);
    let responseBody = "";
    req.on("response", (res: IncomingMessage) => {
      res.on("data", (chunk: Buffer) => (responseBody += chunk.toString()));
      res.on("end", () =>
        resolve({
          status: (res as { statusCode?: number }).statusCode ?? 200,
          body: responseBody,
        }),
      );
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Parse a JSON string; return undefined on failure. */
function tryParseJson(raw: string): Record<string, unknown> | undefined {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* ignore */ }
  return undefined;
}

/** Returns true if isoA is strictly after isoB (null/undefined ≡ epoch). */
function isAfter(isoA: string | null | undefined, isoB: string | null | undefined): boolean {
  if (!isoA) return false;
  if (!isoB) return true;
  return new Date(isoA).getTime() > new Date(isoB).getTime();
}

/**
 * Replay queued offline writes against the live API.
 *
 * Conflict resolution (last-write-wins by updated_at, server wins on tie):
 *   - For PUT/PATCH/DELETE: fetch the current server record first.
 *     If server.updated_at > entry.base_updated_at → server is newer; skip write,
 *     update local cache with server state. Otherwise apply the write.
 *   - For POST: always apply (no conflict possible for a new entity).
 *
 * ID reconciliation:
 *   - On successful POST: map synthetic offline_* ID to real server ID,
 *     rewrite any subsequent queue entries that reference the synthetic ID,
 *     and remove the synthetic entity from local cache.
 *
 * Status progression:
 *   "syncing" → ("up_to_date" for 3 s) → "idle"  (or "error" on failures)
 */
async function flushSyncQueue(authToken: string): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;
  broadcastSyncStatus("syncing");

  const entries = getPendingQueue();
  let errors = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const parsed = parseEntityUrl(entry.urlPath);

      // ── Conflict check for PUT / PATCH / DELETE ──────────────────────────────
      // Compare base_updated_at (captured at write-queue time from local cache)
      // against the live server record. Server newer → skip write.
      // base_updated_at will be present only when the entity was cached before
      // the write was enqueued; missing it means we have no baseline → apply write.
      if (
        (entry.method === "PUT" || entry.method === "PATCH" || entry.method === "DELETE") &&
        entry.baseUpdatedAt &&
        parsed?.entityId
      ) {
        let serverRecord: Record<string, unknown> | undefined;
        try {
          const getRes = await netRequest("GET", `${API_BASE}${entry.urlPath}`, authToken);
          if (getRes.status === 200) serverRecord = tryParseJson(getRes.body);
        } catch {
          markQueueError(entry.id, "conflict_check_failed");
          errors++;
          continue;
        }

        if (serverRecord) {
          const serverUpdatedAt =
            (serverRecord.updatedAt ?? serverRecord.updated_at) as string | null | undefined;
          if (isAfter(serverUpdatedAt, entry.baseUpdatedAt)) {
            // Server is newer — server wins; discard local write, update local cache
            removeFromQueue(entry.id);
            if (parsed) applyServerEntityToCache(parsed, serverRecord);
            continue;
          }
        }
      }

      // ── Apply the write ──────────────────────────────────────────────────────
      const result = await netRequest(
        entry.method,
        `${API_BASE}${entry.urlPath}`,
        authToken,
        entry.body ?? undefined,
      );

      if (result.status >= 200 && result.status < 300) {
        removeFromQueue(entry.id);

        // Update entity cache with the authoritative server response
        try {
          if (parsed) {
            if (entry.method === "DELETE") {
              if (ENTITY_CACHE_TYPES.has(parsed.entityType)) {
                // Top-level entity: remove from entity_cache and rebuild list
                if (parsed.entityId) removeEntity(parsed.entityType, parsed.entityId);
                const remaining = parsed.farmId
                  ? getEntities(parsed.entityType, parsed.farmId)
                  : getEntities(parsed.entityType);
                cacheResponse(parsed.listUrl, remaining);
              } else if (parsed.entityId) {
                // URL-scoped sub-resource: splice out from list cache + clear detail URL
                const raw = getCachedResponse(parsed.listUrl);
                const list: Record<string, unknown>[] = Array.isArray(raw) ? raw : [];
                cacheResponse(
                  parsed.listUrl,
                  list.filter((e) => e.id !== parsed.entityId),
                );
                cacheResponse(`${parsed.listUrl}/${parsed.entityId}`, null);
              }
            } else {
              const serverEntity = tryParseJson(result.body);
              if (serverEntity && "id" in serverEntity) {
                // For POST: reconcile synthetic ID → real server ID.
                // Use the explicitly stored clientTempId (set at queue time) so
                // reconciliation works even when the temp ID isn't in the URL/body.
                if (entry.method === "POST") {
                  const realId = serverEntity.id as string;
                  const offlineId = entry.clientTempId ?? undefined;
                  if (offlineId && offlineId !== realId) {
                    // Persist mapping to DB
                    storeIdMapping(offlineId, realId);
                    // Rewrite later DB rows
                    rewriteQueueIds(offlineId, realId);
                    // Also rewrite remaining in-memory entries so they succeed
                    // in THIS flush pass without waiting for a re-read from DB.
                    for (let j = i + 1; j < entries.length; j++) {
                      entries[j].urlPath = entries[j].urlPath.split(offlineId).join(realId);
                      if (entries[j].body) {
                        entries[j].body = entries[j].body!.split(offlineId).join(realId);
                      }
                    }
                    // Remove the synthetic entity from cache
                    removeEntity(parsed.entityType, offlineId);
                  }
                }
                applyServerEntityToCache(parsed, serverEntity);
                // Also cache the individual entity URL
                if (entry.method !== "POST") {
                  cacheResponse(entry.urlPath, serverEntity);
                }
              }
            }
          }
        } catch {
          // Non-fatal — best-effort cache update
        }
      } else if (result.status === 409) {
        // 409 means the server rejected due to a conflict — server wins
        removeFromQueue(entry.id);
        if (parsed) {
          const serverEntity = tryParseJson(result.body);
          if (serverEntity && "id" in serverEntity) {
            applyServerEntityToCache(parsed, serverEntity);
          } else if (parsed.entityId) {
            // Re-fetch the authoritative record and update cache
            try {
              const getRes = await netRequest("GET", `${API_BASE}${entry.urlPath}`, authToken);
              if (getRes.status === 200) {
                const refetched = tryParseJson(getRes.body);
                if (refetched) applyServerEntityToCache(parsed, refetched);
              }
            } catch { /* non-fatal */ }
          }
        }
      } else {
        markQueueError(entry.id, `HTTP ${result.status}`);
        errors++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "network_error";
      markQueueError(entry.id, msg);
      errors++;
    }
  }

  isSyncing = false;

  if (errors > 0) {
    broadcastSyncStatus("error");
  } else {
    // Brief "up to date" confirmation, then settle at idle
    broadcastSyncStatus("up_to_date");
    setTimeout(() => {
      if (currentSyncStatus === "up_to_date") broadcastSyncStatus("idle");
    }, 3000);
  }
}

// ── License storage ───────────────────────────────────────────────────────────

interface LicenseData {
  key: string;
  expiresAt: string;
  validatedAt: string;
}

// Security posture: license.dat is encrypted with safeStorage (OS keychain-backed)
// on all supported platforms where Electron ships with an OS credential store
// (macOS: Keychain, Windows: DPAPI, Linux: libsecret / kwallet).
// On headless/CI environments where safeStorage reports unavailable, the file
// falls back to plaintext JSON. This is acceptable for desktop packaging targets
// (Mac/Win) because safeStorage is always available there; the plaintext path is
// a dev/CI convenience fallback and is guarded by filesystem ACLs.
function readLicense(): LicenseData | null {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return null;
    const raw = fs.readFileSync(LICENSE_FILE);
    if (safeStorage.isEncryptionAvailable()) {
      const json = safeStorage.decryptString(raw);
      return JSON.parse(json) as LicenseData;
    }
    return JSON.parse(raw.toString("utf-8")) as LicenseData;
  } catch {
    return null;
  }
}

function writeLicense(data: LicenseData): void {
  if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(JSON.stringify(data));
    fs.writeFileSync(LICENSE_FILE, enc);
  } else {
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(data), "utf-8");
  }
}

function clearLicense(): void {
  try { fs.unlinkSync(LICENSE_FILE); } catch { }
}

// ── API helpers ───────────────────────────────────────────────────────────────

interface ValidateResult {
  valid: boolean;
  expiresAt: string | null;
  reason?: string;
}

function apiRequest(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: "GET", url });
    let body = "";
    req.on("response", (res) => {
      res.on("data", (chunk) => (body += chunk.toString()));
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.end();
  });
}

async function validateKeyOnline(key: string): Promise<ValidateResult> {
  try {
    const url = `${API_BASE}/api/licenses/validate?key=${encodeURIComponent(key)}`;
    const timeoutMs = 7000;
    const body = await Promise.race([
      apiRequest(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    return JSON.parse(body) as ValidateResult;
  } catch {
    return { valid: false, expiresAt: null, reason: "offline" };
  }
}

/**
 * POST /api/licenses/activate  (optionally authenticated)
 *
 * No auth: activates an unclaimed key without user binding. Returns
 * { error: "login_required" } when the key is already bound to a user account —
 * the activation screen should then prompt the user to log in and retry with a JWT.
 *
 * With authToken: binds the key to the user's account. Idempotent for the same user.
 * Returns { error: "already_claimed" } only when a DIFFERENT user owns the key.
 */
async function activateKey(
  key: string,
  authToken?: string
): Promise<{ ok?: boolean; error?: string; expiresAt?: string }> {
  return new Promise((resolve) => {
    const req = net.request({
      method: "POST",
      url: `${API_BASE}/api/licenses/activate`,
    });
    req.setHeader("Content-Type", "application/json");
    if (authToken) {
      req.setHeader("Authorization", `Bearer ${authToken}`);
    }
    let body = "";
    req.on("response", (res: IncomingMessage) => {
      res.on("data", (chunk: Buffer) => (body += chunk.toString()));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({ error: "parse_error" }); }
      });
    });
    req.on("error", () => resolve({ error: "network" }));
    req.write(JSON.stringify({ key }));
    req.end();
  });
}

// ── Window management ─────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let activationWindow: BrowserWindow | null = null;
let renewalWindow: BrowserWindow | null = null;

function getWebDistPath(): string {
  if (IS_DEV) {
    return path.join(__dirname, "..", "web-dist");
  }
  return path.join(process.resourcesPath, "web-dist");
}

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function createActivationWindow(): void {
  activationWindow = new BrowserWindow({
    width: 480,
    height: 580,
    resizable: false,
    maximizable: false,
    center: true,
    title: "miFinca — Activar licencia",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a120b" : "#fdfaf7",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });
  activationWindow.loadFile(path.join(__dirname, "..", "src", "activation.html"));
  if (!IS_DEV) activationWindow.setMenu(null);
  activationWindow.once("ready-to-show", () => activationWindow?.show());
  activationWindow.on("closed", () => { activationWindow = null; });
}

function createRenewalWindow(): void {
  renewalWindow = new BrowserWindow({
    width: 480,
    height: 520,
    resizable: false,
    maximizable: false,
    center: true,
    title: "miFinca — Licencia vencida",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a120b" : "#fdfaf7",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });
  renewalWindow.loadFile(path.join(__dirname, "..", "src", "renewal.html"));
  if (!IS_DEV) renewalWindow.setMenu(null);
  renewalWindow.once("ready-to-show", () => renewalWindow?.show());
  renewalWindow.on("closed", () => { renewalWindow = null; });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "miFinca",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a120b" : "#fdfaf7",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // In dev mode, load from the Vite dev server
  if (IS_DEV && process.env.MIFINCA_DEV_URL) {
    mainWindow.loadURL(process.env.MIFINCA_DEV_URL);
  } else {
    const indexPath = path.join(getWebDistPath(), "index.html");
    mainWindow.loadFile(indexPath);
  }

  if (!IS_DEV) mainWindow.setMenu(null);
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    // Trigger silent update check after main window is ready
    setupAutoUpdater();
  });

  // After the renderer has loaded, ask it to supply auth token so we can flush any
  // queued writes that accumulated from a previous offline session.
  mainWindow.webContents.once("did-finish-load", () => {
    if (getQueueCount() > 0) {
      // Small delay so React and the auth store have time to hydrate from localStorage
      setTimeout(() => {
        mainWindow?.webContents.send("offline:check-pending");
      }, 2000);
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  // Prevent navigation to external URLs — open in system browser instead
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("file://") && !url.startsWith(API_BASE)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

// ── Intercept API requests ────────────────────────────────────────────────────
// When the SPA is loaded from file://, relative /api/* calls fail.
// We intercept them and redirect to the production API server.

function setupApiInterceptor(): void {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["file://*api*", "file://*"] },
    (details, callback) => {
      const fileUrl = details.url;
      // Match paths that look like /api/...
      const apiMatch = fileUrl.match(/\/api\/(.*)/);
      if (apiMatch) {
        callback({ redirectURL: `${API_BASE}/api/${apiMatch[1]}` });
      } else {
        callback({});
      }
    }
  );

  // Inject ACAO: * for API responses received inside the Electron session.
  // Security note: this is intentionally broad because the renderer is a
  // trusted first-party shell loading from file:// — no untrusted origins
  // can issue cross-origin requests here. A follow-up can tighten this to
  // only allow the specific API_BASE origin if needed.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Access-Control-Allow-Origin": ["*"],
      },
    });
  });
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  if (IS_DEV) return;

  const updateUrl = process.env.MIFINCA_UPDATE_URL;
  if (updateUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: updateUrl });
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("updater:update-available", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("updater:update-downloaded", {
      version: info.version,
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-updater error:", err.message);
  });

  // Silently check in the background
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function setupIpc(): void {
  // Called by activation page. Calls POST /api/licenses/activate:
  //   - If authToken is provided (user already logged in): binds key to user account
  //   - If no authToken: activates unclaimed key without binding
  //   - If server returns login_required: bubbles up so UI can prompt login
  ipcMain.handle("license:activate", async (_event: IpcMainInvokeEvent, key: string, authToken: string) => {
    const normalizedKey = key.toUpperCase().trim();
    const activation = await activateKey(normalizedKey, authToken || undefined);
    if (!activation.ok || !activation.expiresAt) {
      return { ok: false, error: activation.error ?? "invalid" };
    }
    writeLicense({ key: normalizedKey, expiresAt: activation.expiresAt, validatedAt: new Date().toISOString() });
    return { ok: true, expiresAt: activation.expiresAt };
  });

  // Called by main window / renewal page: install update and restart
  ipcMain.handle("updater:install", async () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Called by renewal page: user entered a new key.
  ipcMain.handle("license:renew", async (_event: IpcMainInvokeEvent, key: string) => {
    const normalizedKey = key.toUpperCase().trim();
    const activation = await activateKey(normalizedKey);
    if (!activation.ok || !activation.expiresAt) {
      return { ok: false, error: activation.error ?? "invalid" };
    }
    writeLicense({ key: normalizedKey, expiresAt: activation.expiresAt, validatedAt: new Date().toISOString() });
    return { ok: true, expiresAt: activation.expiresAt };
  });

  // Clear stored license (used for testing / sign-out)
  ipcMain.handle("license:clear", async () => {
    clearLicense();
    return { ok: true };
  });

  // Open the miFinca website for purchasing / renewal
  ipcMain.handle("open:purchase", async () => {
    shell.openExternal(`${API_BASE}/app/login`);
  });

  // ── Offline / SQLite IPC ────────────────────────────────────────────────────

  // Cache a successful GET response keyed by URL path
  ipcMain.handle(
    "offline:cache-response",
    (_event: IpcMainInvokeEvent, urlPath: string, data: unknown) => {
      try { cacheResponse(urlPath, data); } catch { /* non-fatal */ }
    },
  );

  // Return cached GET response for a URL path (null if not cached)
  ipcMain.handle(
    "offline:get-cached-response",
    (_event: IpcMainInvokeEvent, urlPath: string) => {
      try { return getCachedResponse(urlPath); } catch { return null; }
    },
  );

  // Bulk upsert entities into the fine-grained entity cache (used for seeding)
  ipcMain.handle(
    "offline:cache-entities",
    (_event: IpcMainInvokeEvent, entityType: string, entities: Record<string, unknown>[]) => {
      try { upsertEntities(entityType, entities); } catch { /* non-fatal */ }
    },
  );

  // Upsert a single entity (used for optimistic cache updates in fetch interceptor)
  ipcMain.handle(
    "offline:upsert-entity",
    (_event: IpcMainInvokeEvent, entityType: string, entity: Record<string, unknown>) => {
      try { upsertSingleEntity(entityType, entity); } catch { /* non-fatal */ }
    },
  );

  // Remove a single entity from the cache (used for offline DELETE)
  ipcMain.handle(
    "offline:remove-entity",
    (_event: IpcMainInvokeEvent, entityType: string, id: string) => {
      try { removeEntity(entityType, id); } catch { /* non-fatal */ }
    },
  );

  // Read entities from the cache (used for offline fallback)
  ipcMain.handle(
    "offline:get-entities",
    (_event: IpcMainInvokeEvent, entityType: string, farmId?: string) => {
      try { return getEntities(entityType, farmId); } catch { return []; }
    },
  );

  // Queue an offline write; returns the new queue entry ID.
  // baseUpdatedAt: entity's updated_at when write was queued (server-wins conflict check).
  // clientTempId:  synthetic offline_* id assigned to POST creates for ID reconciliation.
  ipcMain.handle(
    "offline:queue-write",
    (
      _event: IpcMainInvokeEvent,
      method: string,
      urlPath: string,
      body: string | null,
      baseUpdatedAt?: string | null,
      clientTempId?: string | null,
    ) => {
      try { return enqueueWrite(method, urlPath, body, baseUpdatedAt, clientTempId); } catch { return -1; }
    },
  );

  // Fetch a single entity from entity_cache by (entityType, id)
  ipcMain.handle(
    "offline:get-entity",
    (_event: IpcMainInvokeEvent, entityType: string, id: string) => {
      try { return getEntityById(entityType, id); } catch { return null; }
    },
  );

  // Return the number of pending queue entries (displayed in sync bar)
  ipcMain.handle("offline:get-queue-count", () => {
    try { return getQueueCount(); } catch { return 0; }
  });

  // Return current sync status
  ipcMain.handle("offline:get-sync-status", () => currentSyncStatus);

  // Called by renderer when network connectivity changes.
  // On reconnect: flush queued writes against the live API.
  ipcMain.handle(
    "offline:network-changed",
    (_event: IpcMainInvokeEvent, isOnline: boolean, authToken: string) => {
      if (isOnline) {
        broadcastSyncStatus("idle");
        if (getQueueCount() > 0) {
          flushSyncQueue(authToken).catch((err: unknown) => {
            console.error("sync flush error:", err);
            broadcastSyncStatus("error");
          });
        }
      } else {
        broadcastSyncStatus("offline");
      }
    },
  );
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Open the correct window based on current license state.
// This is safe to call more than once (e.g. on macOS "activate") because IPC
// handlers and interceptors are registered separately in bootstrap() below.
async function openAppropriateWindow(): Promise<void> {
  const license = readLicense();

  if (!license) {
    // First launch — show activation screen
    createActivationWindow();
    ipcMain.once("activation:complete", () => {
      activationWindow?.close();
      createMainWindow();
    });
    return;
  }

  // Key exists — validate it against the server
  const online = await validateKeyOnline(license.key);

  if (online.reason === "offline") {
    // Offline fallback: use cached expiry
    const expired = new Date(license.expiresAt) < new Date();
    if (expired) {
      createRenewalWindow();
      ipcMain.once("renewal:complete", () => {
        renewalWindow?.close();
        createMainWindow();
      });
    } else {
      createMainWindow();
    }
    return;
  }

  if (!online.valid) {
    // Key was revoked or truly expired — server confirmed
    if (online.expiresAt) {
      writeLicense({ ...license, expiresAt: online.expiresAt, validatedAt: new Date().toISOString() });
    }
    createRenewalWindow();
    ipcMain.once("renewal:complete", () => {
      renewalWindow?.close();
      createMainWindow();
    });
    return;
  }

  // Valid — refresh cached dates then open app
  writeLicense({
    key: license.key,
    expiresAt: online.expiresAt ?? license.expiresAt,
    validatedAt: new Date().toISOString(),
  });
  createMainWindow();
}

// One-time bootstrap: register IPC handlers and request interceptors exactly
// once (ipcMain.handle throws on duplicate registration), then open first window.
async function bootstrap(): Promise<void> {
  // Open the offline SQLite database before registering IPC handlers
  const dbPath = path.join(USER_DATA_DIR, "offline.db");
  openDatabase(dbPath);

  setupApiInterceptor();
  setupIpc();
  await openAppropriateWindow();
}

app.whenReady().then(bootstrap).catch(console.error);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// macOS: re-open when dock icon clicked with no windows open.
// Calls openAppropriateWindow() (not bootstrap) to avoid re-registering handlers.
app.on("activate", () => {
  if (!mainWindow && !activationWindow && !renewalWindow) {
    openAppropriateWindow().catch(console.error);
  }
});
