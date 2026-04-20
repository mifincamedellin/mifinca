/**
 * Type declarations for the miFinca Desktop API exposed via Electron's contextBridge.
 * These are automatically available via the preload script when running inside the
 * desktop app. Always check `window.miFincaDesktop?.isDesktop` before using any API.
 */

export interface MiFincaDesktopAPI {
  readonly isDesktop: true;
  readonly version: string;

  // ── License ──────────────────────────────────────────────────────────────────

  activateLicense(
    key: string,
    authToken?: string,
  ): Promise<{ ok: boolean; expiresAt?: string; error?: string }>;

  renewLicense(
    key: string,
  ): Promise<{ ok: boolean; expiresAt?: string; error?: string }>;

  activationComplete(): void;
  renewalComplete(): void;

  clearLicense(): Promise<{ ok: boolean }>;
  openPurchase(): Promise<void>;

  // ── Updates ──────────────────────────────────────────────────────────────────

  installUpdate(): Promise<void>;

  onUpdateAvailable(
    cb: (info: { version: string; releaseNotes?: string }) => void,
  ): void;

  onUpdateDownloaded(
    cb: (info: { version: string }) => void,
  ): void;

  // ── Offline / Sync ────────────────────────────────────────────────────────────

  /** Returns true if the renderer is currently online */
  getNetworkStatus(): boolean;

  /**
   * Subscribe to network changes (fires when online ↔ offline transitions occur).
   * Returns an unsubscribe function.
   */
  onNetworkChange(cb: (isOnline: boolean) => void): () => void;

  /**
   * Inform the main process of a network change. Main will flush the sync queue
   * on reconnect using the provided auth token.
   */
  notifyNetworkChange(isOnline: boolean, authToken: string): Promise<void>;

  /** Cache a successful GET response keyed by URL path */
  cacheResponse(urlPath: string, data: unknown): Promise<void>;

  /** Retrieve a cached GET response (null if not present) */
  getCachedResponse(urlPath: string): Promise<unknown | null>;

  /** Bulk-cache entities of a given type for initial seeding */
  cacheEntities(
    entityType: string,
    entities: Record<string, unknown>[],
  ): Promise<void>;

  /** Upsert a single entity into the fine-grained entity cache */
  upsertEntity(
    entityType: string,
    entity: Record<string, unknown>,
  ): Promise<void>;

  /** Remove a single entity from the fine-grained entity cache */
  removeEntity(entityType: string, id: string): Promise<void>;

  /** Queue an offline write to be replayed when back online */
  queueOfflineWrite(
    method: string,
    urlPath: string,
    body: string | null,
    /** The entity's updated_at at write time — used for server-wins conflict resolution */
    baseUpdatedAt?: string | null,
  ): Promise<number>;

  /** Returns the number of pending offline writes */
  getQueueCount(): Promise<number>;

  /**
   * Subscribe to sync status updates from the main process.
   * Status values: "idle" | "syncing" | "up_to_date" | "offline" | "error"
   */
  onSyncStatusChange(
    cb: (status: "idle" | "syncing" | "up_to_date" | "offline" | "error") => void,
  ): void;

  /**
   * Called by main process at startup when there are pending writes and it needs
   * the renderer to supply the auth token. Renderer should respond by calling
   * notifyNetworkChange(true, authToken) so the flush can proceed.
   */
  onCheckPending(cb: () => void): void;
}

declare global {
  interface Window {
    miFincaDesktop?: MiFincaDesktopAPI;
  }
}
