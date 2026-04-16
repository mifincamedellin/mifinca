import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useUpgradeStore } from "@/lib/upgradeStore";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, X, Pencil, Trash2, Phone, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Contact {
  id: string;
  farmId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  category: string;
  notes?: string | null;
}

const CATEGORIES = ["supplier", "buyer", "vet", "transport", "other"];

const CATEGORY_COLORS: Record<string, string> = {
  supplier: "bg-blue-100 text-blue-700",
  buyer: "bg-green-100 text-green-700",
  vet: "bg-purple-100 text-purple-700",
  transport: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-600",
};

const EMPTY_FORM = { name: "", phone: "", email: "", category: "other", customCategory: "", notes: "" };

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

const AVATAR_COLORS = [
  "bg-secondary/80", "bg-emerald-500", "bg-primary/70",
  "bg-purple-400", "bg-blue-400", "bg-orange-400",
];

export function Contacts() {
  const { t } = useTranslation();
  const { activeFarmId } = useStore();
  const qc = useQueryClient();
  const { openUpgradeModal } = useUpgradeStore();

  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["contacts", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/contacts`);
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const saveMut = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { customCategory, ...rest } = payload;
      const resolvedCategory = rest.category === "other" && customCategory.trim()
        ? customCategory.trim()
        : rest.category;
      const url = editRow
        ? `/api/farms/${activeFarmId}/contacts/${editRow.id}`
        : `/api/farms/${activeFarmId}/contacts`;
      const res = await fetch(url, {
        method: editRow ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, category: resolvedCategory }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error("save failed"), { data: body, status: res.status });
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts", activeFarmId] }); closeForm(); },
    onError: (err: any) => {
      if (err?.data?.error === "plan_limit") {
        openUpgradeModal("contacts", err.data.limit);
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/farms/${activeFarmId}/contacts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts", activeFarmId] }); setDeleteConfirm(null); },
  });

  const openNew = () => { setEditRow(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (c: Contact) => {
    setEditRow(c);
    const isCustom = !CATEGORIES.includes(c.category);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      category: isCustom ? "other" : c.category,
      customCategory: isCustom ? c.category : "",
      notes: c.notes ?? "",
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditRow(null); };

  const filtered = contacts.filter(c => {
    if (filterCat !== "all" && c.category !== filterCat) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !(c.phone ?? "").includes(search) &&
        !(c.notes ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{t("contacts.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("contacts.subtitle")}</p>
        </div>
        <Button onClick={openNew} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> {t("contacts.add")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("contacts.search")}
            className="pl-9 rounded-xl"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-10 w-36 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("contacts.cat.all")}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`contacts.cat.${c}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Contact count */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">{filtered.length} {t("contacts.found")}</p>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 bg-muted/30 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-border/50 p-16 flex flex-col items-center text-center text-muted-foreground gap-4">
          <div className="p-5 bg-muted/30 rounded-2xl">
            <Users className="h-10 w-10 text-border" />
          </div>
          <div>
            <p className="font-semibold text-foreground/70 mb-1">{t("contacts.empty.title")}</p>
            <p className="text-sm">{t("contacts.empty.desc")}</p>
          </div>
          <Button onClick={openNew} variant="outline" className="mt-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5">
            <Plus className="h-4 w-4 mr-2" /> {t("contacts.add")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-white font-semibold text-lg shrink-0`}>
                  {getInitials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground truncate">{c.name}</p>
                    <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteConfirm(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[c.category] ?? "bg-gray-100 text-gray-600"}`}>
                    {CATEGORIES.includes(c.category) ? t(`contacts.cat.${c.category}`) : c.category}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-secondary transition-colors group/link">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.phone}</span>
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-secondary transition-colors">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </a>
                )}
                {c.notes && (
                  <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2 mt-2 pt-2 border-t border-border/20">{c.notes}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-border/30"
            >
              <div className="flex flex-col items-center text-center gap-3 mb-5">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <h2 className="text-lg font-serif font-bold text-destructive">{t("contacts.confirmDelete")}</h2>
                <p className="text-sm text-muted-foreground">{t("contacts.confirmDeleteDesc")}</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirm(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-xl"
                  disabled={deleteMut.isPending}
                  onClick={() => deleteConfirm && deleteMut.mutate(deleteConfirm)}
                >
                  {t("contacts.delete")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit/New Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && closeForm()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-md border border-border/30"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-serif font-bold text-primary">{editRow ? t("contacts.form.edit") : t("contacts.form.new")}</h2>
                <button onClick={closeForm} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("contacts.form.name")} *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t("contacts.form.namePlaceholder")} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("contacts.form.category")}</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v, customCategory: "" }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`contacts.cat.${c}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.category === "other" && (
                    <Input
                      value={form.customCategory}
                      onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                      placeholder={t("contacts.form.customCategoryPlaceholder")}
                      className="rounded-xl mt-2"
                      maxLength={40}
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("contacts.form.phone")}</label>
                  <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+57 300 000 0000" className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("contacts.form.email")}</label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("contacts.form.notes")}</label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("contacts.form.notesPlaceholder")} className="rounded-xl" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={closeForm} className="flex-1 rounded-xl">{t("common.cancel")}</Button>
                  <Button
                    onClick={() => saveMut.mutate(form)}
                    disabled={saveMut.isPending || !form.name}
                    className="flex-1 rounded-xl"
                  >
                    {saveMut.isPending ? t("common.saving") : t("common.save")}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
