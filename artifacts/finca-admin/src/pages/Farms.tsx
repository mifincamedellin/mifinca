import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Search, Loader2, ChevronLeft, ChevronRight, PawPrint, ChevronRight as Arrow } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Farms() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  function handleSearch(v: string) {
    setSearch(v);
    clearTimeout((window as unknown as { _fst: ReturnType<typeof setTimeout> })._fst);
    (window as unknown as { _fst: ReturnType<typeof setTimeout> })._fst = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 300);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin-farms", debouncedSearch, page],
    queryFn: () => api.farms({ search: debouncedSearch || undefined, page }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Farms</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data ? `${data.total.toLocaleString()} total farms` : "All farms across the platform"}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by farm name..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Farm</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Owner</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Animals</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</th>
                <th className="w-8 px-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(data?.farms ?? []).map((farm) => (
                <tr
                  key={farm.id}
                  onClick={() => setLocation(`/farms/${farm.id}`)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-foreground">{farm.name}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="text-sm text-foreground">{farm.ownerName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{farm.ownerEmail ?? ""}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <PawPrint className="h-3.5 w-3.5 text-muted-foreground" />
                      {farm.animalCount}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[180px] truncate">
                    {farm.location ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">
                    {farm.createdAt ? format(parseISO(farm.createdAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <Arrow className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
              {(data?.farms ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    No farms found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {data.pages}</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="p-2 rounded-lg border border-border bg-card hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
