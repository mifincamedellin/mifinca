import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { listActivity } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft, ChevronDown, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ActivityEntry } from "@workspace/api-client-react";

const PAGE_SIZE = 20;

interface FarmMember {
  id: string;
  userId: string;
  role: string;
  profile: { id: string; fullName: string | null; role: string | null };
}

const ENTITY_TYPES = ["animal", "inventory", "finance", "contact", "employee"] as const;

interface Filters {
  userId: string;
  entityType: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { userId: "", entityType: "", from: "", to: "" };

function filtersActive(f: Filters) {
  return !!(f.userId || f.entityType || f.from || f.to);
}

function activeCount(f: Filters) {
  return [f.userId, f.entityType, f.from, f.to].filter(Boolean).length;
}

export function AllActivity() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { activeFarmId } = useStore();
  const isEn = i18n.language === "en";

  const [pages, setPages] = useState<ActivityEntry[][]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [stagedFilters, setStagedFilters] = useState<Filters>(EMPTY_FILTERS);
  const prevFarmRef = useRef(activeFarmId);

  useEffect(() => {
    if (prevFarmRef.current !== activeFarmId) {
      prevFarmRef.current = activeFarmId;
      setPages([]);
      setFilters(EMPTY_FILTERS);
      setStagedFilters(EMPTY_FILTERS);
      setIsFetchingMore(false);
    }
  }, [activeFarmId]);

  const { data: members = [] } = useQuery<FarmMember[]>({
    queryKey: ["members", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/members`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFarmId,
    staleTime: 60_000,
  });

  const filterParams = {
    limit: PAGE_SIZE,
    offset: 0,
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  };

  const { data: firstPage, isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["activity", activeFarmId, filterParams],
    queryFn: () => listActivity(activeFarmId!, filterParams),
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
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      });
      setPages(prev => [...prev, newEntries as ActivityEntry[]]);
    } finally {
      setIsFetchingMore(false);
    }
  }, [activeFarmId, allEntries.length, isFetchingMore, filters]);

  function applyFilters() {
    setFilters(stagedFilters);
    setPages([]);
    setShowFilters(false);
  }

  function clearFilters() {
    setStagedFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPages([]);
    setShowFilters(false);
  }

  const dotColor = (actionType: string | null | undefined) => {
    if (actionType === "deleted") return "bg-destructive";
    if (actionType === "created" || actionType === "inventory_added") return "bg-emerald-500";
    if (actionType?.startsWith("inventory_")) return "bg-accent";
    return "bg-secondary";
  };

  const entityLabel = (type: string, en: boolean): string => {
    const map: Record<string, [string, string]> = {
      animal:    ["Animals",   "Animales"],
      inventory: ["Inventory", "Inventario"],
      finance:   ["Finances",  "Finanzas"],
      contact:   ["Contacts",  "Contactos"],
      employee:  ["Employees", "Empleados"],
    };
    return map[type]?.[en ? 0 : 1] ?? type;
  };

  const filterCount = activeCount(filters);

  return (
    <div className="min-h-screen" style={{ background: "#FDFAF5" }}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#FDFAF5]/90 backdrop-blur-sm border-b border-border/40">
        <div className="px-4 py-3 flex items-center gap-3">
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
          <div className="flex items-center gap-2 shrink-0">
            {allEntries.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium tabular-nums">
                {allEntries.length}{hasMore ? "+" : ""}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-xl gap-1.5 h-9 px-3 ${filterCount > 0 ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
              onClick={() => { setStagedFilters(filters); setShowFilters(v => !v); }}
            >
              <Filter className="h-3.5 w-3.5" />
              {isEn ? "Filter" : "Filtros"}
              {filterCount > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full bg-primary text-primary-foreground font-bold">
                  {filterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* ── Filter panel ── */}
        {showFilters && (
          <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3 bg-[#FDFAF5]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Worker filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isEn ? "Worker" : "Trabajador"}
                </label>
                <select
                  value={stagedFilters.userId}
                  onChange={e => setStagedFilters(f => ({ ...f, userId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-border/60 bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{isEn ? "All workers" : "Todos"}</option>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>
                      {m.profile.fullName || (isEn ? "Unknown" : "Desconocido")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity type filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isEn ? "Category" : "Categoría"}
                </label>
                <select
                  value={stagedFilters.entityType}
                  onChange={e => setStagedFilters(f => ({ ...f, entityType: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-border/60 bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">{isEn ? "All categories" : "Todas"}</option>
                  {ENTITY_TYPES.map(type => (
                    <option key={type} value={type}>{entityLabel(type, isEn)}</option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isEn ? "From" : "Desde"}
                </label>
                <input
                  type="date"
                  value={stagedFilters.from}
                  max={stagedFilters.to || undefined}
                  onChange={e => setStagedFilters(f => ({ ...f, from: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-border/60 bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Date to */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isEn ? "To" : "Hasta"}
                </label>
                <input
                  type="date"
                  value={stagedFilters.to}
                  min={stagedFilters.from || undefined}
                  onChange={e => setStagedFilters(f => ({ ...f, to: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-border/60 bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                className="rounded-xl bg-primary hover:bg-primary/90 flex-1 sm:flex-none"
                onClick={applyFilters}
              >
                {isEn ? "Apply" : "Aplicar"}
              </Button>
              {filtersActive(stagedFilters) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-muted-foreground gap-1.5"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  {isEn ? "Clear" : "Limpiar"}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {filterCount > 0 && !showFilters && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {filters.userId && (() => {
              const member = members.find(m => m.userId === filters.userId);
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {member?.profile.fullName || (isEn ? "Worker" : "Trabajador")}
                  <button onClick={() => { setFilters(f => ({ ...f, userId: "" })); setPages([]); }} className="hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })()}
            {filters.entityType && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {entityLabel(filters.entityType, isEn)}
                <button onClick={() => { setFilters(f => ({ ...f, entityType: "" })); setPages([]); }} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.from && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {isEn ? "From" : "Desde"}: {filters.from}
                <button onClick={() => { setFilters(f => ({ ...f, from: "" })); setPages([]); }} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.to && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {isEn ? "To" : "Hasta"}: {filters.to}
                <button onClick={() => { setFilters(f => ({ ...f, to: "" })); setPages([]); }} className="hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
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
            <p className="text-sm text-muted-foreground">
              {filterCount > 0
                ? (isEn ? "No activity matches your filters." : "Ninguna actividad coincide con los filtros.")
                : t("dashboard.noActivity")}
            </p>
            {filterCount > 0 && (
              <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={clearFilters}>
                {isEn ? "Clear filters" : "Limpiar filtros"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
