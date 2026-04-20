import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useStore } from "@/lib/store";
import { useListFarms } from "@workspace/api-client-react";

export type SyncStatus = "idle" | "syncing" | "up_to_date" | "offline" | "error";

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

    // Main process may ask us to supply the auth token at startup so it can
    // flush a pending queue from the previous session.
    desktop.onCheckPending?.(() => {
      if (navigator.onLine && tokenRef.current) {
        desktop.notifyNetworkChange?.(true, tokenRef.current).catch(() => {});
      }
    });

    // On mount: if we're online and there's a pending queue (from a previous offline
    // session), proactively kick off a flush so the user doesn't have to toggle offline.
    if (navigator.onLine) {
      desktop.getQueueCount?.().then((count) => {
        if (count && count > 0 && tokenRef.current) {
          desktop.notifyNetworkChange?.(true, tokenRef.current).catch(() => {});
        }
      }).catch(() => {});
    }

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
 * Seed hook: fetches all core entity data for ALL of the user's farms from the API
 * and caches it in SQLite on every app launch while online.
 *
 * This ensures a full local copy is available before the user goes offline,
 * regardless of which farm they last had active.
 *
 * Session deduplication: uses sessionStorage so seeding runs exactly once per
 * app launch (Electron session), not once per React mount.
 */
export function useOfflineSeeding() {
  const desktop = window.miFincaDesktop;
  const { token } = useStore();
  const seedingRef = useRef(false);

  // Fetch all farms the user has access to so we can seed each one.
  // Only enabled when running in the desktop app and connected.
  const { data: farms } = useListFarms({
    query: {
      enabled: !!(desktop?.isDesktop && token && navigator.onLine),
    },
  });

  useEffect(() => {
    if (!desktop?.isDesktop) return;
    if (!navigator.onLine) return;
    if (!farms?.length) return;
    if (seedingRef.current) return;
    // One seed per browser/Electron session (survives re-mounts, cleared on app restart)
    if (sessionStorage.getItem("offline-seeded") === "1") return;

    seedingRef.current = true;

    async function seedAll() {
      sessionStorage.setItem("offline-seeded", "1");

      /** Fetch a URL and cache it in both response_cache and entity_cache. */
      async function fetchAndCache(urlPath: string, entityType: string) {
        try {
          const res = await fetch(urlPath);
          if (!res.ok) return;
          const data: unknown = await res.json();
          // Always cache the raw URL response
          await desktop!.cacheResponse!(urlPath, data);
          // For top-level entities also populate the fine-grained entity_cache
          const entities: unknown[] = Array.isArray(data)
            ? data
            : (data as Record<string, unknown>)?.data ?? [];
          if ((entities as Record<string, unknown>[]).length > 0) {
            await desktop!.cacheEntities!(entityType, entities as Record<string, unknown>[]);
          }
        } catch {
          // Non-fatal — best-effort offline seeding
        }
      }

      // Seed the farms list itself
      await fetchAndCache("/api/farms", "farms");

      // Seed core entities for every farm the user has access to
      for (const farm of farms!) {
        const fid = farm.id as string;
        if (!fid) continue;

        // Cache the individual farm record
        await fetchAndCache(`/api/farms/${fid}`, "farms").catch(() => {});

        // Seed all entity types in parallel per farm
        await Promise.allSettled([
          fetchAndCache(`/api/farms/${fid}/animals`, "animals"),
          fetchAndCache(`/api/farms/${fid}/milk`, "farm_milk_records"),
          fetchAndCache(`/api/farms/${fid}/finances`, "finance_transactions"),
          fetchAndCache(`/api/farms/${fid}/inventory`, "inventory_items"),
          fetchAndCache(`/api/farms/${fid}/contacts`, "contacts"),
          fetchAndCache(`/api/farms/${fid}/events`, "farm_events"),
          fetchAndCache(`/api/farms/${fid}/employees`, "employees"),
          fetchAndCache(`/api/farms/${fid}/zones`, "zones"),
        ]);
      }
    }

    seedAll().catch(() => {
      // Reset so a failed seed attempt can retry on next launch
      sessionStorage.removeItem("offline-seeded");
      seedingRef.current = false;
    });
  }, [desktop, farms]);
}
