import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useStore } from "@/lib/store";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

interface OfflineContextValue {
  /** Whether the app currently has network connectivity */
  isOnline: boolean;
  /** Current sync state for the pending-writes queue */
  syncStatus: SyncStatus;
  /** Number of writes waiting to be synced */
  pendingCount: number;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  syncStatus: "idle",
  pendingCount: 0,
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

/** Wraps the app when running inside the Electron desktop shell. */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const desktop = window.miFincaDesktop;
  const { token } = useStore();

  const [isOnline, setIsOnline] = useState(desktop?.getNetworkStatus?.() ?? navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [pendingCount, setPendingCount] = useState(0);

  // Keep a stable ref to the current token so the network-change handler can
  // read the latest value without being re-created on every token change.
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Refresh the pending-count badge
  const refreshPendingCount = useCallback(async () => {
    if (!desktop?.getQueueCount) return;
    try {
      const count = await desktop.getQueueCount();
      setPendingCount(count ?? 0);
    } catch {
      // non-fatal
    }
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;

    // Subscribe to sync status updates from main process
    desktop.onSyncStatusChange?.((status) => {
      setSyncStatus(status);
      if (status === "idle" || status === "error") {
        refreshPendingCount();
      }
    });

    // Subscribe to network changes in this renderer
    const unsubscribe = desktop.onNetworkChange?.((online) => {
      setIsOnline(online);
      setSyncStatus(online ? "idle" : "offline");

      // Notify the main process so it can flush the queue on reconnect
      desktop.notifyNetworkChange?.(online, tokenRef.current ?? "").catch(() => {});

      if (online) refreshPendingCount();
    });

    // Seed initial pending count
    refreshPendingCount();

    return () => {
      unsubscribe?.();
    };
  }, [desktop, refreshPendingCount]);

  // If not in the desktop app, render children without any context overhead
  if (!desktop) {
    return <>{children}</>;
  }

  return (
    <OfflineContext.Provider value={{ isOnline, syncStatus, pendingCount }}>
      {children}
    </OfflineContext.Provider>
  );
}

/**
 * Seed hook: fetches all core farm entities from the API and caches them
 * in SQLite so the user starts with a fresh local copy before going offline.
 * Runs once per authenticated desktop session (when online).
 */
export function useOfflineSeeding() {
  const desktop = window.miFincaDesktop;
  const { token, activeFarmId } = useStore();
  const seededRef = useRef(false);

  useEffect(() => {
    if (!desktop?.isDesktop) return;
    if (!token && !navigator.onLine) return;
    if (seededRef.current) return;
    if (!activeFarmId || activeFarmId === "__all__") return;

    seededRef.current = true;

    async function seed() {
      if (!navigator.onLine) return;

      // Helper: fetch + cache a list endpoint
      async function fetchAndCache(urlPath: string, entityType: string) {
        try {
          const res = await fetch(urlPath);
          if (!res.ok) return;
          const data = await res.json();
          // Cache the raw response for fast offline GET serving
          await desktop!.cacheResponse!(urlPath, data);
          // Also store individual entities for conflict resolution
          const entities = Array.isArray(data) ? data : data.data ?? data.items ?? [];
          if (entities.length > 0) {
            await desktop!.cacheEntities!(entityType, entities);
          }
        } catch {
          // Non-fatal — offline seeding is best-effort
        }
      }

      const farmId = activeFarmId;
      if (!farmId || farmId === "__all__") return;

      // Seed all core entities for the active farm in parallel
      await Promise.allSettled([
        fetchAndCache(`/api/farms`, "farms"),
        fetchAndCache(`/api/farms/${farmId}/animals`, "animals"),
        fetchAndCache(`/api/farms/${farmId}/milk-records`, "milk_records"),
        fetchAndCache(`/api/farms/${farmId}/finances`, "finance_transactions"),
        fetchAndCache(`/api/farms/${farmId}/inventory`, "inventory_items"),
        fetchAndCache(`/api/farms/${farmId}/contacts`, "contacts"),
        fetchAndCache(`/api/farms/${farmId}/events`, "farm_events"),
      ]);
    }

    seed().catch(() => {});
  }, [desktop, token, activeFarmId]);
}
