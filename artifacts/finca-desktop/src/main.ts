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
  getEntities,
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

/** "idle" = online and not syncing; "syncing" = flush in progress; "offline" = no connection */
type SyncStatus = "idle" | "syncing" | "offline" | "error";

let currentSyncStatus: SyncStatus = "idle";
let isSyncing = false;

function broadcastSyncStatus(status: SyncStatus): void {
  currentSyncStatus = status;
  mainWindow?.webContents.send("offline:sync-status", status);
}

/**
 * Replay queued offline writes against the live API.
 * Called automatically when the app comes back online.
 */
async function flushSyncQueue(authToken: string): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;
  broadcastSyncStatus("syncing");

  const entries = getPendingQueue();
  let errors = 0;

  for (const entry of entries) {
    try {
      const result = await new Promise<{ status: number; body: string }>(
        (resolve, reject) => {
          const req = net.request({
            method: entry.method,
            url: `${API_BASE}${entry.urlPath}`,
          });
          req.setHeader("Content-Type", "application/json");
          if (authToken) {
            req.setHeader("Authorization", `Bearer ${authToken}`);
          }
          let body = "";
          req.on("response", (res: IncomingMessage) => {
            res.on("data", (chunk: Buffer) => (body += chunk.toString()));
            res.on("end", () => resolve({ status: (res as { statusCode?: number }).statusCode ?? 200, body }));
          });
          req.on("error", reject);
          if (entry.body) req.write(entry.body);
          req.end();
        },
      );

      if (result.status >= 200 && result.status < 300) {
        // Success: remove from queue and cache the server response
        removeFromQueue(entry.id);
        try {
          const parsed = JSON.parse(result.body);
          // Cache the result under the URL path for future reads
          cacheResponse(entry.urlPath, parsed);
        } catch {
          // Non-JSON response — ignore caching
        }
      } else if (result.status === 409) {
        // Conflict: server version wins — discard local write
        removeFromQueue(entry.id);
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
  broadcastSyncStatus(errors > 0 ? "error" : "idle");
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

  // Read entities from the cache (used for offline fallback)
  ipcMain.handle(
    "offline:get-entities",
    (_event: IpcMainInvokeEvent, entityType: string, farmId?: string) => {
      try { return getEntities(entityType, farmId); } catch { return []; }
    },
  );

  // Queue an offline write; returns the new queue entry ID
  ipcMain.handle(
    "offline:queue-write",
    (_event: IpcMainInvokeEvent, method: string, urlPath: string, body: string | null) => {
      try { return enqueueWrite(method, urlPath, body); } catch { return -1; }
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
