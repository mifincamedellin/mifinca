import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Users, Building2, PawPrint, TrendingUp, Loader2 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

const PLAN_COLORS: Record<string, string> = {
  seed: "bg-amber-500/15 text-amber-700 border-amber-200",
  farm: "bg-secondary/15 text-secondary border-secondary/30",
  pro: "bg-violet-500/15 text-violet-700 border-violet-200",
};

const PLAN_LABELS: Record<string, string> = {
  seed: "Seed",
  farm: "Farm",
  pro: "Pro",
};

export default function Overview() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.stats(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive text-sm">
        Failed to load stats. Check your session.
      </div>
    );
  }

  const chartData = data?.signupsByDay.map((d) => ({
    date: format(parseISO(d.day as string), "MMM d"),
    users: d.count,
  })) ?? [];

  const metrics = [
    {
      label: "Total Users",
      value: data?.users ?? 0,
      icon: Users,
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      label: "Total Farms",
      value: data?.farms ?? 0,
      icon: Building2,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Active Animals",
      value: data?.animals ?? 0,
      icon: PawPrint,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "New (30d)",
      value: data?.signupsByDay.reduce((s, d) => s + d.count, 0) ?? 0,
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Business metrics at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-1">New Signups</h2>
          <p className="text-xs text-muted-foreground mb-5">Last 30 days</p>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
              No signup data yet
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-1">Plan Distribution</h2>
          <p className="text-xs text-muted-foreground mb-5">Active users by plan</p>
          <div className="space-y-3">
            {(data?.planBreakdown ?? []).map(({ plan, count }) => (
              <div key={plan} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PLAN_COLORS[plan] ?? "bg-muted text-muted-foreground border-border"}`}
                  >
                    {PLAN_LABELS[plan] ?? plan}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.round((count / (data?.users || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {(data?.planBreakdown ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No users yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
