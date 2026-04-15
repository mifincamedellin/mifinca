import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  Users,
  PawPrint,
  DollarSign,
  Activity,
  Pencil,
  Trash2,
  X,
  Check,
  UserMinus,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const TABS = ["Animals", "Finances", "Members", "Activity"] as const;
type Tab = (typeof TABS)[number];

const SPECIES_EMOJI: Record<string, string> = {
  cattle: "🐄",
  pig: "🐷",
  chicken: "🐔",
  goat: "🐐",
  sheep: "🐑",
  horse: "🐎",
  other: "🐾",
};

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function FarmDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("Animals");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editData, setEditData] = useState({ name: "", location: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-farm", id],
    queryFn: () => api.farm(id),
    onSuccess: (d) => {
      setEditData({ name: d.farm.name ?? "", location: d.farm.location ?? "" });
    },
  } as Parameters<typeof useQuery>[0]);

  const updateMutation = useMutation({
    mutationFn: () => api.updateFarm(id, editData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-farm", id] });
      qc.invalidateQueries({ queryKey: ["admin-farms"] });
      setEditOpen(false);
      toast.success("Farm updated");
    },
    onError: () => toast.error("Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteFarm(id),
    onSuccess: () => {
      toast.success("Farm deleted");
      setLocation("/farms");
    },
    onError: () => toast.error("Delete failed"),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeMember(id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-farm", id] });
      toast.success("Member removed");
    },
    onError: () => toast.error("Remove failed"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Farm not found.</div>;
  }

  const { farm, members, animals, finances, activity } = data;
  const income = finances.summary.find((s) => s.type === "income")?.total ?? 0;
  const expense = finances.summary.find((s) => s.type === "expense")?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLocation("/farms")}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{farm.name}</h1>
          <p className="text-muted-foreground text-sm">
            Owner: <button onClick={() => farm.ownerId && setLocation(`/users/${farm.ownerId}`)} className="hover:text-primary transition-colors">{farm.ownerName ?? "Unknown"}</button>
            {farm.location && ` · ${farm.location}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditData({ name: farm.name ?? "", location: farm.location ?? "" });
              setEditOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 text-sm font-medium transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 text-sm font-medium transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Animals", value: animals.length, icon: PawPrint, color: "text-green-600", bg: "bg-green-50" },
          { label: "Members", value: members.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Income", value: formatCOP(income), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Expenses", value: formatCOP(expense), icon: DollarSign, color: "text-red-500", bg: "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-3.5 w-3.5 ${color}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "Animals" && <PawPrint className="h-3.5 w-3.5" />}
              {t === "Finances" && <DollarSign className="h-3.5 w-3.5" />}
              {t === "Members" && <Users className="h-3.5 w-3.5" />}
              {t === "Activity" && <Activity className="h-3.5 w-3.5" />}
              {t}
            </button>
          ))}
        </div>

        <div className="p-0">
          {tab === "Animals" && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tag / Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Species</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Breed</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sex</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {animals.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-foreground">{a.name ?? a.customTag ?? "—"}</p>
                      {a.name && a.customTag && <p className="text-xs text-muted-foreground">{a.customTag}</p>}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground capitalize">
                      <span className="mr-1">{SPECIES_EMOJI[a.species] ?? "🐾"}</span>
                      {a.species}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{a.breed ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground capitalize">{a.sex ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                        a.status === "active" ? "bg-green-100 text-green-700" :
                        a.status === "sold" ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {animals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">No animals</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {tab === "Finances" && (
            <div className="p-5 space-y-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {finances.recent.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{format(parseISO(t.date + "T12:00:00"), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${t.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground capitalize">{t.category}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{t.description}</td>
                      <td className={`px-4 py-3 text-sm font-semibold text-right ${t.type === "income" ? "text-green-600" : "text-red-500"}`}>
                        {t.type === "income" ? "+" : "-"}{formatCOP(Number(t.amount))}
                      </td>
                    </tr>
                  ))}
                  {finances.recent.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-sm text-muted-foreground">No transactions</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "Members" && (
            <div className="divide-y divide-border/60">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {(m.fullName ?? m.email ?? "?")[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.fullName ?? "No name"}</p>
                      <p className="text-xs text-muted-foreground">{m.email ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{m.role}</span>
                    <button
                      onClick={() => removeMemberMutation.mutate(m.userId)}
                      disabled={removeMemberMutation.isPending}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove member"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-center py-10 text-sm text-muted-foreground">No members</p>
              )}
            </div>
          )}

          {tab === "Activity" && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {activity.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {a.created_at ? format(parseISO(a.created_at), "MMM d, HH:mm") : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">{a.user_name ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{a.action}</td>
                  </tr>
                ))}
                {activity.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-sm text-muted-foreground">No activity</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-foreground">Edit Farm</h3>
              <button onClick={() => setEditOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Farm Name", key: "name" as const },
                { label: "Location", key: "location" as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
                  <input
                    value={editData[key]}
                    onChange={(e) => setEditData((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditOpen(false)} className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Delete Farm?</h3>
              <button onClick={() => setDeleteOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete <strong>{farm.name}</strong> and all its animals, finances, and records. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteOpen(false)} className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-destructive text-white rounded-xl py-2.5 text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
