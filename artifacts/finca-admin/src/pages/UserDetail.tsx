import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, type UserDetail as UserDetailType } from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  Building2,
  PawPrint,
  Pencil,
  Trash2,
  X,
  Check,
  Mail,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

const PLAN_BADGE: Record<string, string> = {
  seed: "bg-amber-100 text-amber-700",
  farm: "bg-secondary/15 text-secondary",
  pro: "bg-violet-100 text-violet-700",
};

export default function UserDetail({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editData, setEditData] = useState({ fullName: "", email: "", plan: "seed" });

  const { data, isLoading } = useQuery<UserDetailType>({
    queryKey: ["admin-user", id],
    queryFn: () => api.user(id),
  });

  useEffect(() => {
    if (data) {
      setEditData({
        fullName: data.fullName ?? "",
        email: data.email ?? "",
        plan: data.plan ?? "seed",
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () => api.updateUser(id, editData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setEditOpen(false);
      toast.success("User updated");
    },
    onError: () => toast.error("Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteUser(id),
    onSuccess: () => {
      toast.success("User deleted");
      setLocation("/users");
    },
    onError: () => toast.error("Delete failed"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">User not found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLocation("/users")}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {data.fullName ?? <span className="text-muted-foreground italic">No name</span>}
          </h1>
          <p className="text-muted-foreground text-sm">{data.email ?? "No email"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditData({
                fullName: data.fullName ?? "",
                email: data.email ?? "",
                plan: data.plan ?? "seed",
              });
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

      {/* Email card — full width, prominent, editable */}
      <div className={`bg-card border rounded-xl p-4 flex items-center justify-between gap-4 ${!data.email ? "border-amber-300 bg-amber-50/60" : "border-card-border"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${data.email ? "bg-primary/10" : "bg-amber-100"}`}>
            <Mail className={`h-4 w-4 ${data.email ? "text-primary" : "text-amber-600"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email Address</p>
            {data.email
              ? <p className="text-sm font-medium text-foreground truncate">{data.email}</p>
              : <p className="text-sm text-amber-600 font-medium">No email set — click Edit to add one</p>
            }
          </div>
        </div>
        <button
          onClick={() => {
            setEditData({ fullName: data.fullName ?? "", email: data.email ?? "", plan: data.plan ?? "seed" });
            setEditOpen(true);
          }}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/50 text-xs font-medium transition-colors"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Plan",
            value: (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${PLAN_BADGE[data.plan] ?? "bg-muted text-muted-foreground"}`}>
                {data.plan}
              </span>
            ),
          },
          { label: "Role", value: <span className="capitalize text-sm">{data.role}</span> },
          {
            label: "Joined",
            value: <span className="text-sm">{data.createdAt ? format(parseISO(data.createdAt), "MMM d, yyyy") : "—"}</span>,
          },
          {
            label: "Auth ID",
            value: <span className="text-xs font-mono text-muted-foreground truncate block max-w-[160px]">{data.clerkId ?? <span className="text-amber-500 not-italic">Not linked</span>}</span>,
          },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
            {value}
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Farms ({data.farms?.length ?? 0})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data.farms ?? []).map((farm) => (
            <button
              key={farm.id}
              onClick={() => setLocation(`/farms/${farm.id}`)}
              className="bg-card border border-card-border rounded-xl p-4 text-left hover:border-primary/30 hover:bg-accent/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {farm.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{farm.memberRole}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg">
                  <PawPrint className="h-3 w-3" />
                  {farm.animalCount}
                </div>
              </div>
              {farm.location && (
                <p className="text-xs text-muted-foreground mt-2 truncate">{farm.location}</p>
              )}
            </button>
          ))}
          {(data.farms ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground col-span-3 py-6 text-center">No farms yet</p>
          )}
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl border border-card-border shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-foreground">Edit User</h3>
              <button onClick={() => setEditOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              {(
                [
                  { label: "Full Name", key: "fullName" },
                  { label: "Email", key: "email" },
                ] as const
              ).map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
                  <input
                    value={editData[key]}
                    onChange={(e) => setEditData((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Plan</label>
                <select
                  value={editData.plan}
                  onChange={(e) => setEditData((p) => ({ ...p, plan: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-card"
                >
                  <option value="seed">Seed</option>
                  <option value="farm">Farm</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
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
              <h3 className="font-semibold text-foreground">Delete User?</h3>
              <button onClick={() => setDeleteOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete <strong>{data.fullName ?? data.email}</strong> and all their data including farms and animals. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteOpen(false)}
                className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-destructive text-white rounded-xl py-2.5 text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
