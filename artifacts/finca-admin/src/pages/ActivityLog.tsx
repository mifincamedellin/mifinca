import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "login", label: "Login" },
];

function ActionBadge({ action }: { action: string }) {
  const lower = action.toLowerCase();
  if (lower.includes("creat") || lower.includes("add")) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        {action}
      </span>
    );
  }
  if (lower.includes("delet") || lower.includes("remov")) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        {action}
      </span>
    );
  }
  if (lower.includes("updat") || lower.includes("edit") || lower.includes("change")) {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
        {action}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
      {action}
    </span>
  );
}

export default function ActivityLog() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [farmFilter, setFarmFilter] = useState("");
  const [debouncedUser, setDebouncedUser] = useState("");
  const [debouncedFarm, setDebouncedFarm] = useState("");

  function debounce(setter: (v: string) => void, pageSetter: (v: number) => void, v: string) {
    setter(v);
    clearTimeout((window as unknown as { _ast: ReturnType<typeof setTimeout> })._ast);
    (window as unknown as { _ast: ReturnType<typeof setTimeout> })._ast = setTimeout(() => {
      pageSetter(1);
    }, 300);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", page, actionFilter, debouncedUser, debouncedFarm],
    queryFn: () =>
      api.activity({
        page,
        action: actionFilter !== "all" ? actionFilter : undefined,
        user: debouncedUser || undefined,
        farm: debouncedFarm || undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data ? `${data.total.toLocaleString()} total entries` : "Global audit trail"}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="border border-border rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {ACTION_TYPES.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <input
          type="search"
          value={userFilter}
          onChange={(e) => {
            setUserFilter(e.target.value);
            debounce(setDebouncedUser, setPage, e.target.value);
          }}
          placeholder="Filter by user..."
          className="border border-border rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
        />
        <input
          type="search"
          value={farmFilter}
          onChange={(e) => {
            setFarmFilter(e.target.value);
            debounce(setDebouncedFarm, setPage, e.target.value);
          }}
          placeholder="Filter by farm..."
          className="border border-border rounded-xl px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
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
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Farm</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(data?.activity ?? []).map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      <Clock className="h-3 w-3 shrink-0" />
                      {entry.created_at ? format(parseISO(entry.created_at), "MMM d, HH:mm") : "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground">{entry.user_name ?? "—"}</td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{entry.farm_name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground font-mono">
                    {entry.entity_type ?? "—"}
                  </td>
                </tr>
              ))}
              {(data?.activity ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    No activity found
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
