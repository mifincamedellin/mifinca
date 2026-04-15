import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Arrow,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";

const PLAN_BADGE: Record<string, string> = {
  seed: "bg-amber-100 text-amber-700",
  farm: "bg-secondary/15 text-secondary",
  pro: "bg-violet-100 text-violet-700",
};

type SortBy = "createdAt" | "fullName" | "email" | "plan";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy; sortDir: SortDir }) {
  if (col !== sortBy) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
  return sortDir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1 text-primary" />
    : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
}

export default function Users() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSearch(v: string) {
    setSearch(v);
    clearTimeout((window as unknown as { _st: ReturnType<typeof setTimeout> })._st);
    (window as unknown as { _st: ReturnType<typeof setTimeout> })._st = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 300);
  }

  function toggleSort(col: SortBy) {
    if (col === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedSearch, page, sortBy, sortDir],
    queryFn: () => api.users({ search: debouncedSearch || undefined, page, sortBy, sortDir }),
  });

  const COLS: { key: SortBy; label: string; sortable: boolean }[] = [
    { key: "fullName", label: "Name", sortable: true },
    { key: "email", label: "Email", sortable: true },
    { key: "plan", label: "Plan", sortable: true },
    { key: "createdAt", label: "Farms / Joined", sortable: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data ? `${data.total.toLocaleString()} total customers` : "All registered customers"}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email..."
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
                {COLS.map(({ key, label, sortable }) => (
                  <th key={key} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {sortable ? (
                      <button
                        onClick={() => toggleSort(key)}
                        className="flex items-center hover:text-foreground transition-colors"
                      >
                        {label}
                        <SortIcon col={key} sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    ) : label}
                  </th>
                ))}
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Active</th>
                <th className="w-8 px-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(data?.users ?? []).map((user) => (
                <tr
                  key={user.id}
                  onClick={() => setLocation(`/users/${user.id}`)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {(user.fullName ?? user.email ?? "?")[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {user.fullName ?? <span className="text-muted-foreground italic">No name</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm">
                    {user.email
                      ? <span className="text-muted-foreground">{user.email}</span>
                      : <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">No email</span>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PLAN_BADGE[user.plan] ?? "bg-muted text-muted-foreground"}`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm text-foreground">{user.farmCount ?? 0} farms</p>
                    <p className="text-xs text-muted-foreground">
                      {user.createdAt ? format(parseISO(user.createdAt), "MMM d, yyyy") : "—"}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {user.lastActive
                      ? formatDistanceToNow(parseISO(user.lastActive), { addSuffix: true })
                      : "Never"}
                  </td>
                  <td className="px-5 py-3.5">
                    <Arrow className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
              {(data?.users ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    No users found
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
