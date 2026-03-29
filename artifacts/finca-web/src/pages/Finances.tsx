import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Plus, X, Pencil, Trash2, Filter, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Transaction {
  id: string;
  farmId: string;
  type: "income" | "expense";
  category: string;
  amount: string;
  description: string;
  date: string;
  notes?: string | null;
}

const INCOME_CATEGORIES = ["venta_animales", "venta_leche", "venta_cosecha", "subsidio", "otro_ingreso"];
const EXPENSE_CATEGORIES = ["alimentacion", "medicamentos", "mano_obra", "maquinaria", "servicios", "insumos", "transporte", "otro_gasto"];

function catLabel(cat: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    venta_animales: t("fin.cat.venta_animales"),
    venta_leche: t("fin.cat.venta_leche"),
    venta_cosecha: t("fin.cat.venta_cosecha"),
    subsidio: t("fin.cat.subsidio"),
    otro_ingreso: t("fin.cat.otro_ingreso"),
    alimentacion: t("fin.cat.alimentacion"),
    medicamentos: t("fin.cat.medicamentos"),
    mano_obra: t("fin.cat.mano_obra"),
    maquinaria: t("fin.cat.maquinaria"),
    servicios: t("fin.cat.servicios"),
    insumos: t("fin.cat.insumos"),
    transporte: t("fin.cat.transporte"),
    otro_gasto: t("fin.cat.otro_gasto"),
  };
  return map[cat] ?? cat;
}

function formatCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const EMPTY_FORM = { type: "expense" as "income" | "expense", category: "", amount: "", description: "", date: new Date().toISOString().split("T")[0]!, notes: "" };

export function Finances() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<Transaction | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterType, setFilterType] = useState("all");
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["finances", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/finances`);
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const saveMut = useMutation({
    mutationFn: async (payload: typeof form) => {
      const url = editRow
        ? `/api/farms/${activeFarmId}/finances/${editRow.id}`
        : `/api/farms/${activeFarmId}/finances`;
      const res = await fetch(url, {
        method: editRow ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, amount: parseFloat(payload.amount) }),
      });
      if (!res.ok) throw new Error("save failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finances", activeFarmId] }); closeForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/farms/${activeFarmId}/finances/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finances", activeFarmId] }),
  });

  const openNew = () => { setEditRow(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (row: Transaction) => {
    setEditRow(row);
    setForm({ type: row.type, category: row.category, amount: row.amount, description: row.description, date: row.date, notes: row.notes ?? "" });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditRow(null); };

  // Filtered list
  const filtered = useMemo(() => {
    return transactions.filter(r => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (filterMonth && !r.date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [transactions, filterType, filterMonth]);

  // Summary
  const totalIncome = filtered.filter(r => r.type === "income").reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalExpense = filtered.filter(r => r.type === "expense").reduce((s, r) => s + parseFloat(r.amount), 0);
  const balance = totalIncome - totalExpense;

  // Monthly chart data (last 6 months)
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const locale = i18n.language === "en" ? "en-US" : "es-CO";
      const label = d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
      months[key] = { month: label, income: 0, expense: 0 };
    }
    transactions.forEach(r => {
      const key = r.date.slice(0, 7);
      if (months[key]) {
        if (r.type === "income") months[key]!.income += parseFloat(r.amount);
        else months[key]!.expense += parseFloat(r.amount);
      }
    });
    return Object.values(months);
  }, [transactions]);

  // Category breakdown for the selected period
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      map[r.category] = (map[r.category] ?? 0) + parseFloat(r.amount);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat, value]) => ({ name: catLabel(cat, t), value }));
  }, [filtered, t]);

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{t("fin.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("fin.subtitle")}</p>
        </div>
        <Button onClick={openNew} className="bg-secondary hover:bg-secondary/90 text-white rounded-xl gap-2">
          <Plus className="h-4 w-4" /> {t("fin.add")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t("fin.income"), value: totalIncome, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 border-green-100" },
          { label: t("fin.expense"), value: totalExpense, icon: TrendingDown, color: "text-red-500", bg: "bg-red-50 border-red-100" },
          { label: t("fin.balance"), value: balance, icon: DollarSign, color: balance >= 0 ? "text-blue-600" : "text-red-500", bg: "bg-blue-50 border-blue-100" },
        ].map(card => (
          <div key={card.label} className={`${card.bg} border rounded-2xl p-5 flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
              <p className={`text-xl font-bold font-mono ${card.color}`}>{formatCOP(card.value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">{t("fin.chart.monthly")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barSize={14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCOP(v)} />
              <Legend />
              <Bar dataKey="income" name={t("fin.income")} fill="#4A6741" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name={t("fin.expense")} fill="#C4956A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">{t("fin.chart.balance")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCOP(v)} />
              <Line type="monotone" dataKey="income" name={t("fin.income")} stroke="#4A6741" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="expense" name={t("fin.expense")} stroke="#C4956A" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters + Table */}
      <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <h3 className="font-semibold text-foreground flex-1">{t("fin.transactions")}</h3>
          <div className="flex gap-2 flex-wrap">
            <Input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="h-9 w-40 rounded-xl text-sm"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("fin.filter.all")}</SelectItem>
                <SelectItem value="income">{t("fin.income")}</SelectItem>
                <SelectItem value="expense">{t("fin.expense")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">{t("fin.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("fin.empty")}</p>
            <Button variant="outline" onClick={openNew} className="mt-4 rounded-xl gap-2">
              <Plus className="h-4 w-4" /> {t("fin.add")}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t("fin.col.date")}</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t("fin.col.description")}</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t("fin.col.category")}</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t("fin.col.type")}</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">{t("fin.col.amount")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={row.id} className={`border-t border-border/20 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-6 py-3 text-muted-foreground">{new Date(row.date + "T12:00:00").toLocaleDateString(i18n.language === "en" ? "en-US" : "es-CO")}</td>
                    <td className="px-6 py-3 font-medium">{row.description}</td>
                    <td className="px-6 py-3 text-muted-foreground">{catLabel(row.category, t)}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {row.type === "income" ? t("fin.income") : t("fin.expense")}
                      </span>
                    </td>
                    <td className={`px-6 py-3 text-right font-mono font-semibold ${row.type === "income" ? "text-green-700" : "text-red-600"}`}>
                      {row.type === "income" ? "+" : "-"}{formatCOP(parseFloat(row.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteMut.mutate(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
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
                <h2 className="text-xl font-serif font-bold text-primary">{editRow ? t("fin.form.edit") : t("fin.form.new")}</h2>
                <button onClick={closeForm} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("fin.col.type")}</label>
                    <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as "income" | "expense", category: "" }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">{t("fin.income")}</SelectItem>
                        <SelectItem value="expense">{t("fin.expense")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">{t("fin.col.date")}</label>
                    <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-xl" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("fin.col.category")}</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("fin.form.selectCategory")} /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{catLabel(c, t)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("fin.col.description")}</label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t("fin.form.descPlaceholder")} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("fin.col.amount")} (COP)</label>
                  <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("fin.form.notes")}</label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t("fin.form.notesPlaceholder")} className="rounded-xl" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={closeForm} className="flex-1 rounded-xl">{t("common.cancel")}</Button>
                  <Button
                    onClick={() => saveMut.mutate(form)}
                    disabled={saveMut.isPending || !form.description || !form.amount || !form.category || !form.date}
                    className="flex-1 rounded-xl bg-secondary hover:bg-secondary/90 text-white"
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
