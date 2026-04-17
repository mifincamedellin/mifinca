import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { listActivity } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ActivityEntry } from "@workspace/api-client-react";

const PAGE_SIZE = 20;

export function AllActivity() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { activeFarmId } = useStore();
  const isEn = i18n.language === "en";

  const [pages, setPages] = useState<ActivityEntry[][]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  useEffect(() => {
    setPages([]);
    setIsFetchingMore(false);
  }, [activeFarmId]);

  const { data: firstPage, isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["activity", activeFarmId, 0, PAGE_SIZE],
    queryFn: () => listActivity(activeFarmId!, { limit: PAGE_SIZE, offset: 0 }),
    enabled: !!activeFarmId,
    staleTime: 30_000,
  });

  const allEntries: ActivityEntry[] = [
    ...(firstPage ?? []),
    ...pages.flat(),
  ];

  const lastPage = pages.length > 0 ? pages[pages.length - 1] : firstPage;
  const hasMore = (lastPage?.length ?? 0) === PAGE_SIZE;

  const handleLoadMore = useCallback(async () => {
    if (!activeFarmId || isFetchingMore) return;
    setIsFetchingMore(true);
    try {
      const nextOffset = allEntries.length;
      const newEntries = await listActivity(activeFarmId, {
        limit: PAGE_SIZE,
        offset: nextOffset,
      });
      setPages(prev => [...prev, newEntries as ActivityEntry[]]);
    } finally {
      setIsFetchingMore(false);
    }
  }, [activeFarmId, allEntries.length, isFetchingMore]);

  const dotColor = (actionType: string | null | undefined) => {
    if (actionType === "deleted") return "bg-destructive";
    if (actionType === "created" || actionType === "inventory_added") return "bg-emerald-500";
    if (actionType?.startsWith("inventory_")) return "bg-accent";
    return "bg-secondary";
  };

  return (
    <div className="min-h-screen" style={{ background: "#FDFAF5" }}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#FDFAF5]/90 backdrop-blur-sm border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl h-9 w-9 shrink-0"
          onClick={() => setLocation("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Activity className="h-4 w-4 text-primary shrink-0" />
          <h1 className="text-lg font-serif text-primary font-semibold truncate">
            {isEn ? "All Activity" : "Toda la Actividad"}
          </h1>
        </div>
        {allEntries.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium tabular-nums shrink-0">
            {allEntries.length}{hasMore ? "+" : ""}
          </span>
        )}
      </div>

      {/* ── Feed ── */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="relative pl-6 animate-pulse">
                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-muted" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : allEntries.length > 0 ? (
          <>
            <div className="space-y-5">
              {allEntries.map((item, i) => {
                const isLastVisible = i === allEntries.length - 1;

                return (
                  <div key={item.id} className="relative pl-6">
                    {!isLastVisible && (
                      <div className="absolute left-[7px] top-6 bottom-[-20px] w-0.5 bg-border/60" />
                    )}
                    <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-[#FDFAF5] ${dotColor(item.actionType)}`} />
                    <p className="text-sm font-medium text-foreground">
                      {item.description || item.actionType}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(
                        new Date(item.createdAt || ""),
                        "dd MMM yyyy, HH:mm",
                        isEn ? {} : { locale: es }
                      )}{" "}
                      · {item.profile?.fullName || (isEn ? "User" : "Usuario")}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* ── Load more ── */}
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-xl gap-2"
                  disabled={isFetchingMore}
                  onClick={handleLoadMore}
                >
                  <ChevronDown className="h-4 w-4" />
                  {isFetchingMore
                    ? (isEn ? "Loading…" : "Cargando…")
                    : (isEn ? "Load more" : "Cargar más")}
                </Button>
              </div>
            )}

            {!hasMore && allEntries.length > 0 && (
              <p className="mt-8 text-center text-xs text-muted-foreground">
                {isEn ? "You've reached the beginning." : "Has llegado al inicio."}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Activity className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
