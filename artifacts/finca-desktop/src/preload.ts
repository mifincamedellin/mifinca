import { contextBridge, ipcRenderer } from "electron";

// ── Network state tracking ─────────────────────────────────────────────────────
// Tracked here (renderer process) since navigator.onLine is accurate and window
// events fire reliably. Main process is notified so it can trigger sync flush.

let isOnlineState = navigator.onLine;

window.addEventListener("online", () => {
  isOnlineState = true;
  // Main process will check queue and flush; auth token is provided by caller
});

window.addEventListener("offline", () => {
  isOnlineState = false;
});

// ── Exposed API surface ───────────────────────────────────────────────────────
// Only whitelisted channels are accessible from the renderer process.

contextBridge.exposeInMainWorld("miFincaDesktop", {
  // ── License ────────────────────────────────────────────────────────────────

  /** Activate a license key (called from activation.html) */
  activateLicense: (key: string, authToken?: string) =>
    ipcRenderer.invoke("license:activate", key, authToken ?? ""),

  /** Renew with a new key (called from renewal.html) */
  renewLicense: (key: string) =>
    ipcRenderer.invoke("license:renew", key),

  /** Notify main process that activation succeeded — opens main window */
  activationComplete: () => ipcRenderer.send("activation:complete"),

  /** Notify main process that renewal succeeded — opens main window */
  renewalComplete: () => ipcRenderer.send("renewal:complete"),

  /** Clear the stored license (testing / reset) */
  clearLicense: () => ipcRenderer.invoke("license:clear"),

  /** Open purchase / renewal page in system browser */
  openPurchase: () => ipcRenderer.invoke("open:purchase"),

  // ── Updates ────────────────────────────────────────────────────────────────

  /** Install a downloaded update and restart */
  installUpdate: () => ipcRenderer.invoke("updater:install"),

  /** Subscribe to update events (called from main window) */
  onUpdateAvailable: (
    cb: (info: { version: string; releaseNotes?: string }) => void,
  ) => {
    ipcRenderer.on("updater:update-available", (_event, info) => cb(info));
  },
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
    ipcRenderer.on("updater:update-downloaded", (_event, info) => cb(info));
  },

  // ── Offline / Sync ─────────────────────────────────────────────────────────

  /** Whether the renderer is currently online */
  getNetworkStatus: () => isOnlineState,

  /**
   * Subscribe to network changes (online/offline window events).
   * Returns an unsubscribe function.
   */
  onNetworkChange: (cb: (isOnline: boolean) => void) => {
    const onOnline = () => cb(true);
    const onOffline = () => cb(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  },

  /**
   * Notify the main process of a connectivity change.
   * When isOnline=true and there are pending queue entries, main will flush them.
   */
  notifyNetworkChange: (isOnline: boolean, authToken: string) =>
    ipcRenderer.invoke("offline:network-changed", isOnline, authToken),

  /** Cache a successful GET response by URL path */
  cacheResponse: (urlPath: string, data: unknown) =>
    ipcRenderer.invoke("offline:cache-response", urlPath, data),

  /** Retrieve a cached GET response (null if not present) */
  getCachedResponse: (urlPath: string) =>
    ipcRenderer.invoke("offline:get-cached-response", urlPath),

  /** Bulk-cache entities of a given type (used for initial seeding) */
  cacheEntities: (entityType: string, entities: Record<string, unknown>[]) =>
    ipcRenderer.invoke("offline:cache-entities", entityType, entities),

  /** Upsert a single entity into the fine-grained entity cache */
  upsertEntity: (entityType: string, entity: Record<string, unknown>) =>
    ipcRenderer.invoke("offline:upsert-entity", entityType, entity),

  /** Remove a single entity from the fine-grained entity cache */
  removeEntity: (entityType: string, id: string) =>
    ipcRenderer.invoke("offline:remove-entity", entityType, id),

  /** Queue an offline write to be replayed on reconnect. Returns queue entry id. */
  queueOfflineWrite: (
    method: string,
    urlPath: string,
    body: string | null,
    baseUpdatedAt?: string | null,
    clientTempId?: string | null,
  ) =>
    ipcRenderer.invoke(
      "offline:queue-write",
      method,
      urlPath,
      body,
      baseUpdatedAt ?? null,
      clientTempId ?? null,
    ),

  /** Fetch a single entity from entity_cache by (entityType, id). Returns null if not found. */
  getEntityById: (entityType: string, id: string) =>
    ipcRenderer.invoke("offline:get-entity", entityType, id),

  /** Get the number of pending offline writes */
  getQueueCount: () => ipcRenderer.invoke("offline:get-queue-count"),

  /** Subscribe to sync status updates ("idle" | "syncing" | "offline" | "error") */
  onSyncStatusChange: (
    cb: (status: "idle" | "syncing" | "offline" | "error") => void,
  ) => {
    ipcRenderer.on("offline:sync-status", (_event, status) => cb(status));
  },

  /**
   * Main process calls this once at startup when there are pending queue entries
   * and needs the renderer to supply the auth token to trigger a flush.
   * Renderer should respond by calling notifyNetworkChange(true, authToken).
   */
  onCheckPending: (cb: () => void) => {
    ipcRenderer.on("offline:check-pending", () => cb());
  },

  // ── App info ───────────────────────────────────────────────────────────────

  /** Whether running inside the desktop app (used by the web app to adjust UI) */
  isDesktop: true as const,

  /** App version */
  version: process.env.npm_package_version ?? "1.0.0",
});
