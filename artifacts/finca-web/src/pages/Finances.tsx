import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore, ALL_FARMS_ID } from "@/lib/store";
import { useFarmPermissions } from "@/lib/useFarmPermissions";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { useListFarms, getListFarmsQueryKey } from "@workspace/api-client-react";
import { ExportButton } from "@/components/ExportButton";
import { formatCurrency, currencyInputDisplay, currencyInputRaw } from "@/lib/currency";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, TrendingDown, Sprout, Plus, X, Pencil, Trash2, Layers, Search
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

type Period = "all" | "year" | "6m" | "3m" | "last" | "month";


const INCOME_CATEGORIES = ["venta_animales", "venta_leche", "venta_cosecha", "subsidio", "otro_ingreso"];
const EXPENSE_CATEGORIES = ["alimentacion", "medicamentos", "mano_obra", "maquinaria", "servicios", "insumos", "transporte", "otro_gasto"];

function catLabel(cat: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    venta_animales: t("fin.cat.venta_animales"),
    venta_leche:    t("fin.cat.venta_leche"),
    venta_cosecha:  t("fin.cat.venta_cosecha"),
    subsidio:       t("fin.cat.subsidio"),
    otro_ingreso:   t("fin.cat.otro_ingreso"),
    alimentacion:   t("fin.cat.alimentacion"),
    medicamentos:   t("fin.cat.medicamentos"),
    mano_obra:      t("fin.cat.mano_obra"),
    maquinaria:     t("fin.cat.maquinaria"),
    servicios:      t("fin.cat.servicios"),
    insumos:        t("fin.cat.insumos"),
    transporte:     t("fin.cat.transporte"),
    otro_gasto:     t("fin.cat.otro_gasto"),
  };
  return map[cat] ?? cat;
}


function getDateRange(period: Period): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (period) {
    case "all":
      return { from: null, to: null };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
    case "6m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return { from: d, to: null };
    }
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from: d, to: null };
    }
    case "last":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to:   new Date(now.getFullYear(), now.getMonth(), 0),
      };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
  }
}

const EMPTY_FORM = {
  type: "income" as "income" | "expense",
  category: "",
  amount: "",
  description: "",
  date: new Date().toISOString().split("T")[0]!,
  notes: "",
};

export function Finances() {
  const { t, i18n } = useTranslation();
  const { activeFarmId, currency } = useStore();
  const { can } = useFarmPermissions();
  const qc = useQueryClient();
  const isEn = i18n.language === "en";

  const isAllFarms = activeFarmId === ALL_FARMS_ID;

  const [showForm, setShowForm]   = useState(false);
  const [editRow, setEditRow]     = useState<Transaction | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch]       = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [period, setPeriod]       = useState<Period>("all");

  const { data: farms } = useListFarms({ query: { queryKey: getListFarmsQueryKey(), enabled: true } });
  const farmList = farms as Array<{ id: string; name: string }> | undefined ?? [];
  const farmIds  = farmList.map(f => f.id);
  const farmNameMap: Record<string, string> = Object.fromEntries(farmList.map(f => [f.id, f.name]));
  const farmName = farmNameMap[activeFarmId ?? ""] ?? "laFinca";

  const { data: transactions = [], isLoading: singleLoading } = useQuery<Transaction[]>({
    queryKey: ["finances", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/finances`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!activeFarmId && !isAllFarms,
  });

  const { data: allFarmsData, isLoading: allLoading } = useQuery<{ rows: Transaction[]; failedCount: number }>({
    queryKey: ["all-farms-finances-page", [...farmIds].sort().join(",")],
    enabled: isAllFarms && farmIds.length > 0,
    queryFn: async () => {
      let failedCount = 0;
      const results = await Promise.all(
        farmIds.map(id =>
          fetch(`/api/farms/${id}/finances`)
            .then(r => r.ok ? (r.json() as Promise<Transaction[]>) : (failedCount++, [] as Transaction[]))
            .catch(() => { failedCount++; return [] as Transaction[]; })
        )
      );
      return { rows: results.flat(), failedCount };
    },
  });

  const isLoading = isAllFarms ? allLoading : singleLoading;
  const effectiveTransactions: Transaction[] = isAllFarms ? (allFarmsData?.rows ?? []) : transactions;
  const allFarmsFailed = (allFarmsData?.failedCount ?? 0) > 0;

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finances", activeFarmId] }); setDeleteConfirm(null); },
  });

  const openNew  = () => { setEditRow(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (row: Transaction) => {
    setEditRow(row);
    setForm({ type: row.type, category: row.category, amount: Math.round(parseFloat(row.amount) || 0).toString(), description: row.description, date: row.date, notes: row.notes ?? "" });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditRow(null); };

  const { from, to } = getDateRange(period);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return effectiveTransactions.filter(r => {
      const d = new Date(r.date + "T12:00:00");
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      if (filterType !== "all" && r.type !== filterType) return false;
      if (q) {
        const haystack = [
          r.description,
          catLabel(r.category, t),
          farmNameMap[r.farmId] ?? "",
          r.notes ?? "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [effectiveTransactions, from, to, filterType, search, t, farmNameMap]);

  const totalIncome  = filtered.filter(r => r.type === "income").reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalExpense = filtered.filter(r => r.type === "expense").reduce((s, r) => s + parseFloat(r.amount), 0);
  const profit       = totalIncome - totalExpense;

  const PERIODS_MAP: Record<string, [string, string]> = {
    all:   ["Todo", "All"],
    year:  ["Este año", "This Year"],
    "6m":  ["6 meses", "6 Months"],
    "3m":  ["3 meses", "3 Months"],
    last:  ["Mes anterior", "Last Month"],
    month: ["Este mes", "This Month"],
  };

  const exportOptions = useMemo(() => {
    const date = new Date().toISOString().slice(0, 10);
    const locale = isEn ? "en-US" : "es-CO";
    const periodLabel = isEn ? (PERIODS_MAP[period]?.[1] ?? period) : (PERIODS_MAP[period]?.[0] ?? period);
    const typeLabel = filterType === "all" ? undefined : filterType === "income" ? t("fin.income") : t("fin.expense");
    const subtitleParts = [periodLabel, typeLabel].filter(Boolean);
    const baseFilename = `${isEn ? "finances" : "finanzas"}-${date}`;
    const farmCol = isEn ? "Farm" : "Finca";
    const columns = isAllFarms
      ? (isEn ? ["Date", "Farm", "Description", "Category", "Type", "Amount"] : ["Fecha", "Finca", "Descripción", "Categoría", "Tipo", "Monto"])
      : (isEn ? ["Date", "Description", "Category", "Type", "Amount"] : ["Fecha", "Descripción", "Categoría", "Tipo", "Monto"]);
    const exportTitle = isAllFarms
      ? (isEn ? `All Farms · Finances (${filtered.length})` : `Todas las Fincas · Finanzas (${filtered.length})`)
      : `${farmName} · ${isEn ? "Finances" : "Finanzas"} (${filtered.length})`;
    const rows = filtered.map(r => {
      const base = [
        new Date(r.date + "T12:00:00").toLocaleDateString(locale),
        r.description,
        catLabel(r.category, t),
        r.type === "income" ? t("fin.income") : t("fin.expense"),
        `${r.type === "income" ? "+" : "-"}${formatCurrency(parseFloat(r.amount), currency)}`,
      ];
      if (isAllFarms) base.splice(1, 0, farmNameMap[r.farmId] ?? r.farmId);
      return base;
    });
    return {
      pdfOptions: {
        title: exportTitle,
        subtitle: subtitleParts.join(" · "),
        farmName: isAllFarms ? (isEn ? "All Farms" : "Todas las fincas") : farmName,
        columns,
        rows,
        filename: `${baseFilename}.pdf`,
      },
      csvOptions: {
        filename: `${baseFilename}.csv`,
        title: exportTitle,
        subtitle: subtitleParts.join(" · ") || undefined,
        columns,
        rows,
      },
    };
  }, [filtered, farmName, farmNameMap, period, filterType, isEn, isAllFarms, t, currency]);

  const chartData = useMemo(() => {
    const locale = isEn ? "en-US" : "es-CO";
    const months: Record<string, { month: string; income: number; expense: number }> = {};

    if (period === "all") {
      effectiveTransactions.forEach(r => {
        const key = r.date.slice(0, 7);
        if (!months[key]) {
          const d = new Date(r.date + "T12:00:00");
          months[key] = {
            month: d.toLocaleDateString(locale, { month: "short", year: "2-digit" }),
            income: 0, expense: 0,
          };
        }
        if (r.type === "income") months[key]!.income += parseFloat(r.amount);
        else months[key]!.expense += parseFloat(r.amount);
      });
    } else {
      const start = from ?? new Date();
      const end   = to ?? new Date();
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      while (d.getFullYear() < end.getFullYear() || (d.getFullYear() === end.getFullYear() && d.getMonth() <= end.getMonth())) {
        const key = d.toISOString().slice(0, 7);
        months[key] = {
          month: d.toLocaleDateString(locale, { month: "short", year: "2-digit" }),
          income: 0, expense: 0,
        };
        d.setMonth(d.getMonth() + 1);
      }
      effectiveTransactions.forEach(r => {
        const key = r.date.slice(0, 7);
        if (months[key]) {
          if (r.type === "income") months[key]!.income += parseFloat(r.amount);
          else months[key]!.expense += parseFloat(r.amount);
        }
      });
    }

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [effectiveTransactions, period, from, to, isEn]);

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const PERIODS: { key: Period; label: string }[] = [
    { key: "all",   label: t("fin.period.all")   },
    { key: "year",  label: t("fin.period.year")  },
    { key: "6m",    label: t("fin.period.6m")    },
    { key: "3m",    label: t("fin.period.3m")    },
    { key: "last",  label: t("fin.period.last")  },
    { key: "month", label: t("fin.period.month") },
  ];

  return (
    <div className="space-y-6">
      {!isAllFarms && (
        <ViewOnlyBanner canAdd={can("can_add_finances")} canEdit={can("can_edit_finances")} canRemove={can("can_remove_finances")} />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{t("fin.title")}</h1>
          {isAllFarms ? (
            <div className="flex items-center gap-1.5 mt-1">
              <Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
              <p className="text-muted-foreground text-sm">
                {isEn
                  ? `Combined across ${farmIds.length} farms`
                  : `Combinado de ${farmIds.length} fincas`}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground mt-1">{t("fin.subtitle")}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isAllFarms && can("can_add_finances") && (
            <Button onClick={openNew} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> {t("fin.add")}
            </Button>
          )}
          <ExportButton
            pdfOptions={exportOptions.pdfOptions}
            csvOptions={exportOptions.csvOptions}
            disabled={filtered.length === 0}
            label={isEn ? "Export" : "Exportar"}
            labelCsv={isEn ? "Export CSV" : "Exportar CSV"}
            labelPdf={isEn ? "Export PDF" : "Exportar PDF"}
          />
        </div>
      </div>

      {allFarmsFailed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/40 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
          {isEn
            ? "Some farm data could not be loaded. Totals may be incomplete."
            : "No se pudo cargar la información de algunas fincas. Los totales pueden estar incompletos."}
        </div>
      )}

      {/* Period selector */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-6 pl-6 pr-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              period === p.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card/60 text-muted-foreground border-border/50 hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-100 dark:bg-green-950/40 dark:border-green-800/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-white/10 shadow-sm flex-shrink-0">
            <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{t("fin.income")}</p>
            {isLoading && isAllFarms
              ? <div className="h-6 w-28 rounded animate-pulse bg-black/10 mt-1" />
              : <p className="text-xl font-bold font-mono text-green-600 dark:text-green-400">{formatCurrency(totalIncome, currency)}</p>}
          </div>
        </div>

        <div className="bg-red-50 border border-red-100 dark:bg-red-950/40 dark:border-red-800/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-white/10 shadow-sm flex-shrink-0">
            <TrendingDown className="h-6 w-6 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{t("fin.expense")}</p>
            {isLoading && isAllFarms
              ? <div className="h-6 w-28 rounded animate-pulse bg-black/10 mt-1" />
              : <p className="text-xl font-bold font-mono text-red-500 dark:text-red-400">{formatCurrency(totalExpense, currency)}</p>}
          </div>
        </div>

        <div className={`border rounded-2xl p-5 flex items-center gap-4 ${
          profit >= 0
            ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800/30"
            : "bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-800/30"
        }`}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-white/10 shadow-sm flex-shrink-0">
            <Sprout className={`h-6 w-6 ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{t("fin.profit")}</p>
            {isLoading && isAllFarms
              ? <div className="h-6 w-28 rounded animate-pulse bg-black/10 mt-1" />
              : (
                <p className={`text-xl font-bold font-mono ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                  {profit >= 0 ? "+" : ""}{formatCurrency(profit, currency)}
                </p>
              )}
          </div>
        </div>
      </div>

      {/* Monthly chart */}
      {chartData.length > 0 && (
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">{t("fin.chart.monthly")}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={chartData.length === 1 ? 48 : 14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
              <Legend />
              <Bar dataKey="income"  name={t("fin.income")}  fill="#4A6741" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name={t("fin.expense")} fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Transactions table */}
      <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <h3 className="font-semibold text-foreground flex-1">{t("fin.transactions")}</h3>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isEn ? "Search…" : "Buscar…"}
                className="pl-8 h-9 rounded-xl text-sm"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-sm shrink-0">
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
            <Sprout className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("fin.empty")}</p>
            {!isAllFarms && can("can_add_finances") && (
              <Button variant="outline" onClick={openNew} className="mt-4 rounded-xl gap-2">
                <Plus className="h-4 w-4" /> {t("fin.add")}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t("fin.col.date")}</th>
                  {isAllFarms && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{isEn ? "Farm" : "Finca"}</th>
                  )}
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t("fin.col.description")}</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t("fin.col.category")}</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">{t("fin.col.type")}</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">{t("fin.col.amount")}</th>
                  {!isAllFarms && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((row, i) => (
                  <tr key={row.id} className={`border-t border-border/20 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(row.date + "T12:00:00").toLocaleDateString(isEn ? "en-US" : "es-CO")}
                    </td>
                    {isAllFarms && (
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/8 text-primary border border-primary/15 whitespace-nowrap">
                          {farmNameMap[row.farmId] ?? row.farmId}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-3 font-medium">{row.description}</td>
                    <td className="px-6 py-3 text-muted-foreground">{catLabel(row.category, t)}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.type === "income" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"}`}>
                        {row.type === "income" ? t("fin.income") : t("fin.expense")}
                      </span>
                    </td>
                    <td className={`px-6 py-3 text-right font-mono font-semibold ${row.type === "income" ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {row.type === "income" ? "+" : "-"}{formatCurrency(parseFloat(row.amount), currency)}
                    </td>
                    {!isAllFarms && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          {can("can_edit_finances") && (
                            <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {can("can_remove_finances") && (
                            <button onClick={() => setDeleteConfirm(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-muted-foreground hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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
                <h2 className="text-xl font-serif font-bold text-primary">
                  {editRow ? t("fin.form.edit") : t("fin.form.new")}
                </h2>
                <button onClick={closeForm} className="p-2 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
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
                    <div className="h-10 overflow-hidden rounded-xl border border-input bg-background flex items-center">
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full h-full px-3 bg-transparent text-sm outline-none appearance-none [&::-webkit-date-and-time-value]:text-left" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("fin.col.category")}</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder={t("fin.form.selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{catLabel(c, t)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("fin.col.amount")} ({currency})</label>
                  <Input
                    value={currencyInputDisplay(form.amount, currency)}
                    onChange={e => setForm(f => ({ ...f, amount: currencyInputRaw(e.target.value) }))}
                    placeholder="0"
                    className="rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("fin.col.description")}</label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t("fin.form.notes")}</label>
                  <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={closeForm} className="flex-1 rounded-xl">{t("fin.form.cancel")}</Button>
                <Button
                  onClick={() => saveMut.mutate(form)}
                  disabled={!form.category || !form.amount || !form.description || saveMut.isPending}
                  className="flex-1 rounded-xl"
                >
                  {saveMut.isPending ? "…" : t("fin.form.save")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-border/30"
            >
              <h2 className="text-lg font-serif font-bold text-primary mb-2">{t("fin.delete.title")}</h2>
              <p className="text-muted-foreground text-sm mb-6">{t("fin.delete.confirm")}</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-xl">{t("fin.form.cancel")}</Button>
                <Button variant="destructive" onClick={() => deleteMut.mutate(deleteConfirm!)} disabled={deleteMut.isPending} className="flex-1 rounded-xl">
                  {deleteMut.isPending ? "…" : t("fin.delete.confirm_btn")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
