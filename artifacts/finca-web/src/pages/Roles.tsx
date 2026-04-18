import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useGetMe } from "@workspace/api-client-react";
import { useFarmPermissions } from "@/lib/useFarmPermissions";
import type { FarmPermissions } from "@/lib/useFarmPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, UserPlus, Trash2, ChevronDown, ChevronUp,
  PawPrint, Package, DollarSign, Users, UserCheck, CalendarDays, Clock,
  Check, Minus,
} from "lucide-react";

type Member = {
  id: string;
  userId: string;
  role: "owner" | "worker";
  permissions: FarmPermissions | null;
  createdAt: string;
  profile: {
    id: string;
    fullName: string | null;
    role: string | null;
    preferredLanguage: string | null;
  };
};

type Section = {
  key: string;
  labelKey: string;
  icon: React.ElementType;
  viewPerm: keyof FarmPermissions;
  addPerm: keyof FarmPermissions;
  editPerm: keyof FarmPermissions;
  removePerm: keyof FarmPermissions;
};

const SECTIONS: Section[] = [
  { key: "animals", labelKey: "nav.animals", icon: PawPrint, viewPerm: "can_view_animals", addPerm: "can_add_animals", editPerm: "can_edit_animals", removePerm: "can_remove_animals" },
  { key: "inventory", labelKey: "nav.inventory", icon: Package, viewPerm: "can_view_inventory", addPerm: "can_add_inventory", editPerm: "can_edit_inventory", removePerm: "can_remove_inventory" },
  { key: "finances", labelKey: "nav.finances", icon: DollarSign, viewPerm: "can_view_finances", addPerm: "can_add_finances", editPerm: "can_edit_finances", removePerm: "can_remove_finances" },
  { key: "contacts", labelKey: "nav.contacts", icon: Users, viewPerm: "can_view_contacts", addPerm: "can_add_contacts", editPerm: "can_edit_contacts", removePerm: "can_remove_contacts" },
  { key: "employees", labelKey: "nav.employees", icon: UserCheck, viewPerm: "can_view_employees", addPerm: "can_add_employees", editPerm: "can_edit_employees", removePerm: "can_remove_employees" },
  { key: "calendar", labelKey: "nav.calendar", icon: CalendarDays, viewPerm: "can_view_calendar", addPerm: "can_add_calendar", editPerm: "can_edit_calendar", removePerm: "can_remove_calendar" },
];

const DEFAULT_WORKER_PERMS: FarmPermissions = {
  can_view_animals: true, can_add_animals: false, can_edit_animals: false, can_remove_animals: false,
  can_view_inventory: true, can_add_inventory: false, can_edit_inventory: false, can_remove_inventory: false,
  can_view_finances: true, can_add_finances: false, can_edit_finances: false, can_remove_finances: false,
  can_view_contacts: true, can_add_contacts: false, can_edit_contacts: false, can_remove_contacts: false,
  can_view_employees: true, can_add_employees: false, can_edit_employees: false, can_remove_employees: false,
  can_view_calendar: true, can_add_calendar: false, can_edit_calendar: false, can_remove_calendar: false,
};

const INVITE_DEFAULT_PERMS: FarmPermissions = {
  can_view_animals: true, can_add_animals: false, can_edit_animals: false, can_remove_animals: false,
  can_view_inventory: true, can_add_inventory: false, can_edit_inventory: false, can_remove_inventory: false,
  can_view_finances: true, can_add_finances: false, can_edit_finances: false, can_remove_finances: false,
  can_view_contacts: true, can_add_contacts: false, can_edit_contacts: false, can_remove_contacts: false,
  can_view_employees: true, can_add_employees: false, can_edit_employees: false, can_remove_employees: false,
  can_view_calendar: true, can_add_calendar: false, can_edit_calendar: false, can_remove_calendar: false,
};

function PermissionsGrid({
  perms,
  onToggle,
}: {
  perms: FarmPermissions;
  onToggle: (perm: keyof FarmPermissions, value: boolean) => void;
}) {
  const { t } = useTranslation();
  const cols = [
    { label: t("roles.perm.view"), key: "view" },
    { label: t("roles.perm.add"),  key: "add"  },
    { label: t("roles.perm.edit"), key: "edit" },
    { label: t("roles.perm.remove"), key: "remove" },
  ];
  return (
    <div>
      <div className="grid grid-cols-[1fr_repeat(4,_40px)] mb-1.5">
        <div />
        {cols.map(c => (
          <div key={c.key} className="text-center text-[10px] font-medium text-muted-foreground">{c.label}</div>
        ))}
      </div>
      <div className="space-y-2">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const viewVal = perms[section.viewPerm];
          return (
            <div key={section.key} className="grid grid-cols-[1fr_repeat(4,_40px)] items-center">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground">{t(section.labelKey)}</span>
              </div>
              {([
                { perm: section.viewPerm,   val: perms[section.viewPerm],   disabled: false     },
                { perm: section.addPerm,    val: perms[section.addPerm],    disabled: !viewVal  },
                { perm: section.editPerm,   val: perms[section.editPerm],   disabled: !viewVal  },
                { perm: section.removePerm, val: perms[section.removePerm], disabled: !viewVal  },
              ] as const).map(({ perm, val, disabled }) => (
                <div key={perm as string} className="flex justify-center">
                  <PermToggle
                    checked={val as boolean}
                    onChange={(v) => onToggle(perm as keyof FarmPermissions, v)}
                    disabled={disabled as boolean}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadOnlyPermissionsGrid({ perms }: { perms: FarmPermissions }) {
  const { t } = useTranslation();
  const cols = [
    { label: t("roles.perm.view"),   key: "view"   },
    { label: t("roles.perm.add"),    key: "add"    },
    { label: t("roles.perm.edit"),   key: "edit"   },
    { label: t("roles.perm.remove"), key: "remove" },
  ];
  return (
    <div>
      <div className="grid grid-cols-[1fr_repeat(4,_40px)] mb-1.5">
        <div />
        {cols.map(c => (
          <div key={c.key} className="text-center text-[10px] font-medium text-muted-foreground">{c.label}</div>
        ))}
      </div>
      <div className="space-y-2.5">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const permsRow = [section.viewPerm, section.addPerm, section.editPerm, section.removePerm] as const;
          return (
            <div key={section.key} className="grid grid-cols-[1fr_repeat(4,_40px)] items-center">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-semibold text-foreground">{t(section.labelKey)}</span>
              </div>
              {permsRow.map(perm => (
                <div key={perm} className="flex justify-center">
                  {perms[perm]
                    ? <Check className="h-4 w-4 text-emerald-500" />
                    : <Minus className="h-4 w-4 text-muted-foreground/30" />
                  }
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PermToggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}
      disabled={disabled}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function MemberCard({ member, isOwner: currentUserIsOwner, currentUserId, onRemove, onUpdatePerms, onUpdateRole }: {
  member: Member;
  isOwner: boolean;
  currentUserId: string;
  onRemove: (userId: string) => void;
  onUpdatePerms: (userId: string, perms: FarmPermissions) => void;
  onUpdateRole: (userId: string, role: "worker" | "owner") => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isWorker = member.role === "worker";
  // currentUserId is "" while useGetMe() is still loading — treat as "unknown self" to prevent flicker
  const meLoaded = currentUserId !== "";
  const isSelf = meLoaded && member.userId === currentUserId;
  const canShowControls = currentUserIsOwner && meLoaded && !isSelf;
  const perms: FarmPermissions = member.permissions ?? DEFAULT_WORKER_PERMS;

  const displayName = member.profile.fullName || t("common.user");
  const initials = displayName.substring(0, 2).toUpperCase();

  function handleToggle(perm: keyof FarmPermissions, value: boolean) {
    const next: FarmPermissions = { ...perms, [perm]: value };
    if (perm.startsWith("can_view_") && !value) {
      const base = perm.replace("can_view_", "");
      next[`can_add_${base}` as keyof FarmPermissions] = false;
      next[`can_edit_${base}` as keyof FarmPermissions] = false;
      next[`can_remove_${base}` as keyof FarmPermissions] = false;
    }
    if (!perm.startsWith("can_view_") && value) {
      const base = perm.replace(/^can_(add|edit|remove)_/, "");
      next[`can_view_${base}` as keyof FarmPermissions] = true;
    }
    onUpdatePerms(member.userId, next);
  }

  function handleRoleChange(newRole: "worker" | "owner") {
    if (newRole === member.role) return;
    const msg = newRole === "owner"
      ? t("roles.confirmPromote", { name: displayName })
      : t("roles.confirmDemote", { name: displayName });
    if (!confirm(msg)) return;
    onUpdateRole(member.userId, newRole);
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground truncate">{displayName}</div>
          {canShowControls ? (
            <div className="flex items-center gap-1 mt-1">
              {(["worker", "owner"] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${
                    member.role === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {t(r === "owner" ? "roles.owner" : "roles.worker")}
                </button>
              ))}
            </div>
          ) : (
            <Badge variant={member.role === "owner" ? "default" : "secondary"} className="text-xs mt-0.5">
              {t(member.role === "owner" ? "roles.owner" : "roles.worker")}
            </Badge>
          )}
        </div>
        {canShowControls && (
          <div className="flex items-center gap-1">
            {isWorker && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(t("roles.confirmRemove"))) onRemove(member.userId);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {expanded && isWorker && canShowControls && (
        <div className="border-t border-border px-4 py-3 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-3">{t("roles.permissionsLabel")}</p>
          <PermissionsGrid perms={perms} onToggle={handleToggle} />
        </div>
      )}
    </div>
  );
}

function PendingInviteCard({ invite, onUpdatePerms, onCancel }: {
  invite: { id: string; invitedEmail: string; role: string; status: string; permissions: FarmPermissions | null };
  onUpdatePerms: (inviteId: string, perms: FarmPermissions) => void;
  onCancel: (inviteId: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const perms: FarmPermissions = invite.permissions ?? INVITE_DEFAULT_PERMS;
  const initials = invite.invitedEmail.substring(0, 2).toUpperCase();

  function handleToggle(perm: keyof FarmPermissions, value: boolean) {
    const next: FarmPermissions = { ...perms, [perm]: value };
    if (perm.startsWith("can_view_") && !value) {
      const base = perm.replace("can_view_", "");
      next[`can_add_${base}` as keyof FarmPermissions] = false;
      next[`can_edit_${base}` as keyof FarmPermissions] = false;
      next[`can_remove_${base}` as keyof FarmPermissions] = false;
    }
    if (!perm.startsWith("can_view_") && value) {
      const base = perm.replace(/^can_(add|edit|remove)_/, "");
      next[`can_view_${base}` as keyof FarmPermissions] = true;
    }
    onUpdatePerms(invite.id, next);
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground truncate">{invite.invitedEmail}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t("roles.pendingBadge")}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium text-foreground/70">
              {t(invite.role === "owner" ? "roles.inviteRoleOwner" : "roles.inviteRoleWorker")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(t("roles.confirmCancelInvite", { email: invite.invitedEmail }))) {
                onCancel(invite.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {invite.role !== "owner" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {invite.role !== "owner" && expanded && (
        <div className="border-t border-dashed border-border px-4 py-3 bg-muted/30">
          <p className="text-xs text-muted-foreground mb-3">{t("roles.invitePermsLabel")}</p>
          <PermissionsGrid perms={perms} onToggle={handleToggle} />
        </div>
      )}
    </div>
  );
}

export function Roles() {
  const { t } = useTranslation();
  const { activeFarmId } = useStore();
  const { isOwner, farmsLoaded, permissions: myPermissions } = useFarmPermissions();
  const { data: me } = useGetMe();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"worker" | "owner">("worker");
  const [inviting, setInviting] = useState(false);

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: [`/api/farms/${activeFarmId}/members`],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/members`);
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/farms/${activeFarmId}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "remove_failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/members`] });
      toast({ title: t("roles.memberRemoved") });
    },
    onError: (err: Error) => {
      if (err.message === "last_owner") {
        toast({ title: t("roles.lastOwnerError"), variant: "destructive" });
      } else {
        toast({ title: t("common.error"), variant: "destructive" });
      }
    },
  });

  const updatePerms = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: FarmPermissions }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/members/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/members`] });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "worker" | "owner" }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/members/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "update_failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/members`] });
      toast({ title: t("roles.roleChanged") });
    },
    onError: (err: Error) => {
      if (err.message === "last_owner") {
        toast({ title: t("roles.lastOwnerError"), variant: "destructive" });
      } else {
        toast({ title: t("common.error"), variant: "destructive" });
      }
    },
  });

  type PendingInvite = { id: string; invitedEmail: string; role: string; status: string; permissions: FarmPermissions | null };

  const { data: pendingInvites = [] } = useQuery<PendingInvite[]>({
    queryKey: [`/api/farms/${activeFarmId}/invitations`],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/invitations`);
      if (!res.ok) return [];
      const all = await res.json();
      return (all as PendingInvite[]).filter(i => i.status === "pending");
    },
    enabled: !!activeFarmId && isOwner,
  });

  const updateInvitePerms = useMutation({
    mutationFn: async ({ inviteId, permissions }: { inviteId: string; permissions: FarmPermissions }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/invitations/${inviteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/invitations`] });
      toast({ title: t("roles.invitePermsSaved") });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/farms/${activeFarmId}/invitations/${inviteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/invitations`] });
      toast({ title: t("roles.inviteCancelled") });
    },
    onError: () => toast({ title: t("common.error"), variant: "destructive" }),
  });

  const inviteMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "worker" | "owner" }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        throw new Error("invite_failed");
      }
      const body = await res.json();
      return { status: res.status, body };
    },
    onSuccess: ({ status }) => {
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/members`] });
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/invitations`] });
      setInviteEmail("");
      setInviteRole("worker");
      if (status === 202) {
        toast({ title: t("roles.invitePending"), description: t("roles.invitePendingDesc") });
      } else {
        toast({ title: t("roles.memberInvited") });
      }
    },
    onError: () => {
      toast({ title: t("common.error"), variant: "destructive" });
    },
  });

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">{t("roles.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("roles.subtitle")}</p>
        </div>
      </div>

      {farmsLoaded && !isOwner && (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-base font-serif font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {t("roles.myPerms")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("roles.myPermsSubtitle")}</p>
          </div>
          <ReadOnlyPermissionsGrid perms={myPermissions} />
        </div>
      )}

      {farmsLoaded && isOwner && (
        <form onSubmit={handleInvite} className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={t("roles.invitePlaceholder")}
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
              <UserPlus className="h-4 w-4 mr-1" />
              {t("roles.invite")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInviteRole("worker")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                inviteRole === "worker"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {t("roles.inviteRoleWorker")}
            </button>
            <button
              type="button"
              onClick={() => setInviteRole("owner")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                inviteRole === "owner"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {t("roles.inviteRoleOwner")}
            </button>
            {inviteRole === "owner" && (
              <span className="text-xs text-muted-foreground">{t("roles.ownerFullAccess")}</span>
            )}
          </div>
        </form>
      )}

      <div className="space-y-3">
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground text-sm">{t("common.loading")}</div>
        )}
        {!isLoading && members.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">{t("roles.noMembers")}</div>
        )}
        {members.map(member => (
          <MemberCard
            key={member.id}
            member={member}
            isOwner={isOwner}
            currentUserId={me?.id ?? ""}
            onRemove={(userId) => removeMember.mutate(userId)}
            onUpdatePerms={(userId, permissions) => updatePerms.mutate({ userId, permissions })}
            onUpdateRole={(userId, role) => updateRole.mutate({ userId, role })}
          />
        ))}
      </div>

      {farmsLoaded && isOwner && pendingInvites.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{t("roles.pendingInvites")}</p>
          {pendingInvites.map(invite => (
            <PendingInviteCard
              key={invite.id}
              invite={invite}
              onUpdatePerms={(inviteId, permissions) => updateInvitePerms.mutate({ inviteId, permissions })}
              onCancel={(inviteId) => cancelInvite.mutate(inviteId)}
            />
          ))}
        </div>
      )}

      {farmsLoaded && isOwner && (
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">{t("roles.ownerHint")}</p>
        </div>
      )}
    </div>
  );
}
