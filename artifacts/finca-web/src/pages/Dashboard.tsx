import { useTranslation } from "react-i18next";
import { useStore, ALL_FARMS_ID } from "@/lib/store";
import { formatCurrencyCompact } from "@/lib/currency";
import { useGetFarmStats, useListActivity, useListFarms, useGetMe, getGetMeQueryKey, getListFarmsQueryKey, getGetFarmStatsQueryKey, getListActivityQueryKey, type FarmStats, type MedicalRecord, type InventoryItem } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Activity, AlertTriangle, Syringe, PawPrint, HelpCircle,
  Users, Phone, TrendingUp, TrendingDown, ArrowRight, Wallet, Baby, Droplets,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

type StatsExt = FarmStats;
type FinanceRow = { id: string; type: "income" | "expense"; amount: string; date: string; category: string; description: string };


function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const getAlignment = () => {
    if (!ref.current) return "center";
    const rect = ref.current.getBoundingClientRect();
    const tooltipWidth = 240;
    const halfTooltip = tooltipWidth / 2;
    if (rect.left < halfTooltip + 8) return "left";
    if (window.innerWidth - rect.right < halfTooltip + 8) return "right";
    return "center";
  };

  const align = show ? getAlignment() : "center";
  const popupClass =
    align === "left"
      ? "absolute bottom-full left-0 mb-2 z-50 pointer-events-none"
      : align === "right"
      ? "absolute bottom-full right-0 mb-2 z-50 pointer-events-none"
      : "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none";
  const caretClass =
    align === "left"
      ? "block absolute top-full left-3 border-4 border-transparent border-t-foreground"
      : align === "right"
      ? "block absolute top-full right-3 border-4 border-transparent border-t-foreground"
      : "block absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground";

  return (
    <span ref={ref} className="relative inline-flex items-center ml-1.5">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        aria-label="More info"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={popupClass}
          >
            <span className="block bg-foreground text-background text-xs rounded-xl px-3 py-2 shadow-xl w-[240px] text-left leading-snug whitespace-normal">
              {text}
              <span className={caretClass} />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

const SPECIES_LABELS: Record<string, { es: string; en: string }> = {
  cattle:  { es: "Bovinos",  en: "Cattle"  },
  pig:     { es: "Porcinos", en: "Pigs"    },
  horse:   { es: "Equinos",  en: "Horses"  },
  goat:    { es: "Caprinos", en: "Goats"   },
  sheep:   { es: "Ovinos",   en: "Sheep"   },
  chicken: { es: "Aves",     en: "Poultry" },
  other:   { es: "Otros",    en: "Other"   },
};

const RECORD_TYPE_LABELS: Record<string, { es: string; en: string }> = {
  vaccination: { es: "Vacuna",       en: "Vaccine"    },
  treatment:   { es: "Tratamiento",  en: "Treatment"  },
  checkup:     { es: "Revisión",     en: "Check-up"   },
  surgery:     { es: "Cirugía",      en: "Surgery"    },
  deworming:   { es: "Desparasit.",  en: "Deworm"     },
  other:       { es: "Otro",         en: "Other"      },
};

const MEDICAL_TITLE_EN: Record<string, string> = {
  "Vacuna Aftosa":                  "FMD Vaccine",
  "Desparasitación interna":        "Internal Deworming",
  "Vacuna Brucelosis":              "Brucellosis Vaccine",
  "Desparasitación externa":        "External Deworming",
  "Vacuna Rabia Bovina":            "Bovine Rabies Vaccine",
  "Revisión sanitaria":             "Sanitary Check-up",
  "Control de condición corporal":  "Body Condition Score",
  "Vacuna Peste Porcina":           "CSF Vaccine",
  "Desparasitación piara":          "Pig Deworming",
  "Vacuna Aftosa porcinos":         "FMD Vaccine (Pigs)",
  "Vacuna Tétano equino":           "Equine Tetanus Vaccine",
  "Desparasitación equina":         "Equine Deworming",
  "Vacuna Influenza equina":        "Equine Influenza Vaccine",
  "Vacuna Clostridiosis":           "Clostridial Vaccine",
  "Desparasitación caprinos":       "Goat Deworming",
};

const ACTIVITY_LABELS: Record<string, Record<string, { es: string; en: string }>> = {
  create: {
    animal:         { en: "Animal added",          es: "Animal añadido"        },
    weight_record:  { en: "Weight recorded",        es: "Peso registrado"       },
    medical_record: { en: "Medical record added",   es: "Registro médico"       },
    inventory:      { en: "Inventory added",        es: "Inventario añadido"    },
    inventory_added:{ en: "Inventory added",        es: "Inventario añadido"    },
    finance:        { en: "Transaction recorded",   es: "Transacción registrada"},
    contact:        { en: "Contact added",          es: "Contacto añadido"      },
    employee:       { en: "Employee added",         es: "Empleado añadido"      },
  },
  update: {
    animal:         { en: "Animal updated",         es: "Animal actualizado"    },
    inventory:      { en: "Inventory updated",      es: "Inventario actualizado"},
    finance:        { en: "Transaction updated",    es: "Transacción actualizada"},
  },
  deleted: {
    animal:         { en: "Animal removed",         es: "Animal eliminado"      },
    inventory:      { en: "Inventory removed",      es: "Inventario eliminado"  },
  },
};

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { activeFarmId, currency } = useStore();
  const isEn = i18n.language === "en";
  const [, navigate] = useLocation();

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: true } });
  const firstName = user?.isDemo
    ? (isEn ? "Owner" : "Dueño")
    : (user?.fullName?.split(" ")[0] ?? "");

  const { data: farms } = useListFarms({ query: { queryKey: getListFarmsQueryKey(), enabled: true } });
  const activeFarm = farms?.find(f => f.id === activeFarmId);
  const isAllFarms = activeFarmId === ALL_FARMS_ID;
  const farmsList = (farms as Array<{ id: string; name: string }> | undefined) ?? [];
  const farmIds = farmsList.map(f => f.id);

  const { data: rawStats, isLoading: rawStatsLoading } = useGetFarmStats(activeFarmId || "", {
    query: { queryKey: getGetFarmStatsQueryKey(activeFarmId || ""), enabled: !!activeFarmId && !isAllFarms },
  });

  const { data: activity } = useListActivity(activeFarmId || "", { limit: 5 }, {
    query: { queryKey: getListActivityQueryKey(activeFarmId || "", { limit: 5 }), enabled: !!activeFarmId && !isAllFarms },
  });

  const { data: finances } = useQuery<FinanceRow[]>({
    queryKey: ["finances", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/finances`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFarmId && !isAllFarms,
  });

  interface ActivityItem {
    id?: string;
    actionType?: string;
    entityType?: string;
    description?: string;
    createdAt?: string;
    profile?: { fullName?: string };
    _farmName?: string;
  }

  const { data: allFarmsStats, isLoading: allStatsLoading } = useQuery<FarmStats>({
    queryKey: ["all-farms-stats", farmIds.join(",")],
    enabled: isAllFarms && farmIds.length > 0,
    queryFn: async () => {
      const rawResults = await Promise.all(
        farmIds.map(id => fetch(`/api/farms/${id}/stats`).then(r => r.ok ? (r.json() as Promise<FarmStats>) : null))
      );
      const valid = rawResults.filter((r): r is FarmStats => r !== null);
      const speciesMap: Record<string, number> = {};
      valid.forEach(r => {
        (r.animalsBySpecies ?? []).forEach(s => {
          const key = s.species ?? "other";
          speciesMap[key] = (speciesMap[key] ?? 0) + (s.count ?? 0);
        });
      });
      const aggregated: FarmStats = {
        totalAnimals: valid.reduce((s, r) => s + (r.totalAnimals ?? 0), 0),
        pregnantCount: valid.reduce((s, r) => s + (r.pregnantCount ?? 0), 0),
        upcomingMedicalCount: valid.reduce((s, r) => s + (r.upcomingMedicalCount ?? 0), 0),
        lowStockCount: valid.reduce((s, r) => s + (r.lowStockCount ?? 0), 0),
        employeeCount: valid.reduce((s, r) => s + (r.employeeCount ?? 0), 0),
        contactCount: valid.reduce((s, r) => s + (r.contactCount ?? 0), 0),
        recentActivityCount: valid.reduce((s, r) => s + (r.recentActivityCount ?? 0), 0),
        animalsBySpecies: Object.entries(speciesMap).map(([species, count]) => ({ species, count })),
        upcomingMedical: valid.flatMap(r => r.upcomingMedical ?? []).slice(0, 5) as MedicalRecord[],
        lowStockItems: valid.flatMap(r => r.lowStockItems ?? []).slice(0, 5) as InventoryItem[],
        upcomingMedicalAnimalIds: valid.flatMap(r => r.upcomingMedicalAnimalIds ?? []),
      };
      return aggregated;
    },
  });

  const { data: allFarmsActivity } = useQuery<ActivityItem[]>({
    queryKey: ["all-farms-activity", farmIds.join(",")],
    enabled: isAllFarms && farmIds.length > 0,
    queryFn: async () => {
      const rawResults = await Promise.all(
        farmIds.map((id, i) =>
          fetch(`/api/farms/${id}/activity?limit=10`).then(r =>
            r.ok ? (r.json() as Promise<ActivityItem[]>).then(items =>
              items.map(item => ({ ...item, _farmName: farmsList[i]?.name }))
            ) : Promise.resolve([] as ActivityItem[])
          )
        )
      );
      return rawResults.flat().sort((a, b) =>
        new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime()
      ).slice(0, 10);
    },
  });

  const { data: allFarmsMilkTotal } = useQuery<number>({
    queryKey: ["all-farms-milk-total", farmIds.join(",")],
    enabled: isAllFarms && farmIds.length > 0,
    queryFn: async () => {
      const from30 = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
      const rawResults = await Promise.all(
        farmIds.map(id =>
          fetch(`/api/farms/${id}/milk?from=${from30}`).then(r =>
            r.ok ? (r.json() as Promise<{ summary?: { totalLiters?: number } }>).then(d => d.summary?.totalLiters ?? 0) : 0
          )
        )
      );
      return rawResults.reduce((s, v) => s + v, 0);
    },
  });

  const stats = (isAllFarms ? allFarmsStats : rawStats) as StatsExt | undefined;
  const statsLoading = isAllFarms ? allStatsLoading : rawStatsLoading;
  const displayActivity: ActivityItem[] | undefined = isAllFarms ? allFarmsActivity : activity as ActivityItem[] | undefined;

  const now = new Date();
  const thisMonth = (finances || []).filter(t => {
    const d = new Date(t.date + "T12:00:00");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthIncome   = thisMonth.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthExpenses = thisMonth.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthNet      = monthIncome - monthExpenses;

  if (!activeFarmId) return <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>;

  const today = isEn
    ? format(now, "EEEE, MMMM d")
    : format(now, "EEEE, d 'de' MMMM", { locale: es });

  const colors = ["#4A6741", "#C4956A", "#2C1810", "#6B8F61", "#8FAF85", "#D4A574", "#A0A0A0"];

  const chartData = stats?.animalsBySpecies?.map(entry => ({
    ...entry,
    label: SPECIES_LABELS[(entry.species ?? "") as string]?.[isEn ? "en" : "es"] ?? entry.species,
  })) ?? [];

  const upcomingMedical = (stats?.upcomingMedical || []).slice(0, 5);
  const lowStockItems   = (stats?.lowStockItems   || []).slice(0, 5) as Array<{
    id: string; name: string; quantity: number; unit: string;
    status: string; lowStockThreshold: number | null;
  }>;

  const baseStatCards = [
    {
      title:   t("dashboard.totalAnimals"),
      value:   stats?.totalAnimals || 0,
      icon:    PawPrint,
      color:   "text-secondary",
      bg:      "bg-secondary/10",
      href:    "/animals",
      tooltip: isEn ? "All animals registered on this farm, across all species." : "Total de animales registrados en esta finca, de todas las especies.",
    },
    {
      title:   isEn ? "Pregnant" : "Preñadas",
      value:   stats?.pregnantCount || 0,
      icon:    Baby,
      color:   "text-rose-600",
      bg:      "bg-rose-100",
      href:    "/animals",
      tooltip: isEn ? "Active animals currently marked as pregnant." : "Animales activas actualmente marcadas como preñadas.",
    },
    {
      title:   t("dashboard.upcomingTasks"),
      value:   stats?.upcomingMedicalCount || 0,
      icon:    Syringe,
      color:   "text-accent",
      bg:      "bg-accent/10",
      href:    "/animals",
      tooltip: isEn ? "Upcoming or overdue medical events: vaccines and check-ups." : "Eventos médicos próximos o vencidos: vacunas y revisiones.",
    },
    {
      title:   t("dashboard.lowStock"),
      value:   stats?.lowStockCount || 0,
      icon:    AlertTriangle,
      color:   "text-destructive",
      bg:      "bg-destructive/10",
      href:    "/inventory",
      tooltip: isEn ? "Items that have fallen below their minimum stock level." : "Artículos por debajo del nivel mínimo de inventario.",
    },
    {
      title:   t("dashboard.employees"),
      value:   stats?.employeeCount || 0,
      icon:    Users,
      color:   "text-primary",
      bg:      "bg-primary/10",
      href:    "/employees",
      tooltip: isEn ? "Total employees registered on this farm." : "Total de empleados registrados en esta finca.",
    },
    {
      title:   t("dashboard.contacts"),
      value:   stats?.contactCount || 0,
      icon:    Phone,
      color:   "text-secondary",
      bg:      "bg-secondary/10",
      href:    "/contacts",
      tooltip: isEn ? "Suppliers, vets, buyers, and other contacts." : "Proveedores, veterinarios, compradores y otros contactos.",
    },
  ];

  const allFarmsExtraCards = isAllFarms ? [
    {
      title:   isEn ? "Milk (30d)" : "Leche (30d)",
      value:   `${(allFarmsMilkTotal ?? 0).toFixed(1)} L`,
      icon:    Droplets,
      color:   "text-sky-600",
      bg:      "bg-sky-100",
      href:    "/milk",
      tooltip: isEn ? "Combined milk production across all farms in the last 30 days." : "Producción total de leche en todas las fincas en los últimos 30 días.",
    },
    {
      title:   isEn ? "Recent Activity" : "Actividad",
      value:   stats?.recentActivityCount || 0,
      icon:    Activity,
      color:   "text-violet-600",
      bg:      "bg-violet-100",
      href:    undefined as string | undefined,
      tooltip: isEn ? "Combined recent events across all your farms." : "Eventos recientes en todas tus fincas.",
    },
  ] : [];

  const statCards = [...baseStatCards, ...allFarmsExtraCards];

  return (
    <div className="space-y-6 pb-10">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-primary mb-1">
            {t("dashboard.welcome")}<span className="text-accent">{firstName}</span>
          </h1>
          <p className="text-muted-foreground capitalize text-sm">{today}</p>
        </div>
      </header>

      {/* ── Stat cards ──────────────────────────────────────── */}
      {statsLoading ? (
        <div className={`grid grid-cols-2 gap-4 ${isAllFarms ? "md:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-6"}`}>
          {[...Array(isAllFarms ? 8 : 6)].map((_, i) => <Card key={i} className="h-24 animate-pulse bg-black/5 border-none" />)}
        </div>
      ) : (
        <div className={`grid grid-cols-2 gap-4 ${isAllFarms ? "md:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-6"}`}>
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
            >
              <div
                onClick={() => stat.href && navigate(stat.href)}
                role={stat.href ? "button" : undefined}
                tabIndex={stat.href ? 0 : undefined}
                onKeyDown={e => e.key === "Enter" && stat.href && navigate(stat.href)}
                className={`w-full text-left group ${stat.href ? "cursor-pointer" : "cursor-default"}`}
              >
                <Card className="p-4 border-border/50 shadow-sm group-hover:shadow-md transition-all bg-card/60 backdrop-blur-sm rounded-2xl group-hover:border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center leading-tight">
                        <span className="truncate">{stat.title}</span>
                        <InfoTooltip text={stat.tooltip} />
                      </div>
                      <h3 className="text-2xl font-serif text-foreground font-bold leading-none">{stat.value}</h3>
                    </div>
                    <div className={`p-2.5 rounded-xl ${stat.bg} flex-shrink-0`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </div>
                  {stat.href && (
                    <div className="text-[10px] text-muted-foreground/40 group-hover:text-accent mt-2 flex items-center gap-0.5 transition-colors">
                      <ArrowRight className="h-2.5 w-2.5" />
                      {isEn ? "View" : "Ver"}
                    </div>
                  )}
                </Card>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Middle row: Finances card + Species chart ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Finances this-month card */}
        <Card
          className="lg:order-2 p-6 border-border/50 shadow-sm rounded-2xl bg-card/40 flex flex-col cursor-pointer hover:shadow-md transition-all hover:border-border group"
          onClick={() => navigate("/finances")}
        >
          <h3 className="text-xl font-serif text-primary mb-5 flex items-center justify-between">
            {t("dashboard.thisMonth")}
            <Wallet className="h-4 w-4 text-muted-foreground/40 group-hover:text-accent transition-colors" />
          </h3>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between py-2.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-sm text-muted-foreground">{t("dashboard.income")}</span>
              </div>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrencyCompact(monthIncome, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-sm text-muted-foreground">{t("dashboard.expenses")}</span>
              </div>
              <span className="font-semibold text-red-500 tabular-nums">
                {formatCurrencyCompact(monthExpenses, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-semibold text-foreground">{t("dashboard.netBalance")}</span>
              <span className={`text-xl font-serif font-bold tabular-nums ${monthNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {monthNet >= 0 ? "+" : ""}{formatCurrencyCompact(monthNet, currency)}
              </span>
            </div>
            {thisMonth.length === 0 && (
              <p className="text-xs text-muted-foreground/60 text-center pt-1">
                {t("dashboard.noTransactions")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground/50 group-hover:text-accent transition-colors">
            <ArrowRight className="h-3 w-3" />
            {t("dashboard.viewFinances")}
          </div>
        </Card>

        {/* Species bar chart */}
        <Card className="lg:order-1 lg:col-span-2 p-6 border-border/50 shadow-sm rounded-2xl bg-card/40">
          <h3 className="text-xl font-serif text-primary mb-6 flex items-center">
            {t("dashboard.animalsBySpecies")}
            <InfoTooltip text={isEn ? "Number of animals per species on this farm." : "Cantidad de animales por especie en esta finca."} />
          </h3>
          <div className="h-64 w-full">
            {!statsLoading && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted)/0.3)" }}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                    formatter={(value: number) => [value, isEn ? "Animals" : "Animales"]}
                    labelFormatter={(label: string) => label}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.count === 0 ? "hsl(var(--muted))" : colors[index % colors.length]}
                        opacity={entry.count === 0 ? 0.4 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* ── Alert row: Medical Events + Low Stock ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming medical events */}
        <Card className="p-6 border-border/50 shadow-sm rounded-2xl bg-card/40 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-serif text-primary flex items-center gap-2">
              <Syringe className="h-4 w-4 text-accent" />
              {t("dashboard.upcomingTasks")}
            </h3>
            <div className="flex items-center gap-2">
              {(stats?.upcomingMedicalCount ?? 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                  {stats?.upcomingMedicalCount}
                </span>
              )}
              <button
                onClick={() => navigate("/calendar")}
                className="text-xs text-primary/70 hover:text-primary font-medium flex items-center gap-0.5 transition-colors"
              >
                {isEn ? "View all" : "Ver todo"} <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex-1">
          {upcomingMedical.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("dashboard.noUpcomingEvents")}</p>
          ) : (
            <ul className="space-y-1.5">
              {upcomingMedical.map((evt) => {
                const evtAny = evt as typeof evt & { animalName?: string; animalTag?: string; animalId?: string };
                const dueDate = evt.nextDueDate || evt.recordDate;
                const dateStr = dueDate
                  ? format(new Date(dueDate), isEn ? "MMM d" : "d 'de' MMM", isEn ? {} : { locale: es })
                  : "—";
                const typeLabel = RECORD_TYPE_LABELS[evt.recordType]?.[isEn ? "en" : "es"] ?? evt.recordType;
                return (
                  <li key={evt.id}>
                    <button
                      onClick={() => evtAny.animalId && navigate(`/animals/${evtAny.animalId}`)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-accent/5 transition-colors group/item text-left"
                    >
                      <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight truncate">
                          {isEn ? (MEDICAL_TITLE_EN[evt.title] ?? evt.title) : evt.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {evtAny.animalTag || evtAny.animalName || "—"} · {dateStr}
                        </p>
                      </div>
                      <div className="flex items-center flex-shrink-0">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent/80 capitalize">
                          {typeLabel}
                        </span>
                        <span className="overflow-hidden w-0 group-hover/item:w-[14px] opacity-0 group-hover/item:opacity-100 transition-all duration-200 flex items-center flex-shrink-0">
                          <ArrowRight className="h-3 w-3 text-accent/50 ml-1 flex-shrink-0" />
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
          <button
            onClick={() => navigate("/animals")}
            className="flex items-center gap-1 mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground/50 hover:text-accent transition-colors w-full"
          >
            <ArrowRight className="h-3 w-3" />
            {isEn ? "View all animals" : "Ver todos los animales"}
          </button>

        </Card>

        {/* Low stock items */}
        <Card
          className="p-6 border-border/50 shadow-sm rounded-2xl bg-card/40 cursor-pointer hover:shadow-md transition-all hover:border-border group flex flex-col"
          onClick={() => navigate("/inventory")}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-serif text-primary flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t("dashboard.lowStock")}
            </h3>
            {lowStockItems.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                {lowStockItems.length}
              </span>
            )}
          </div>
          <div className="flex-1">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{t("dashboard.allStockOk")}</p>
            ) : (
              <ul className="space-y-3">
                {lowStockItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === "expired" ? "bg-destructive" : "bg-amber-500"}`} />
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      item.status === "expired"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}>
                      {item.status === "expired"
                        ? (isEn ? "Expired" : "Vencido")
                        : `${item.quantity} ${item.unit}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/30 text-xs text-muted-foreground/50 group-hover:text-accent transition-colors">
            <ArrowRight className="h-3 w-3" />
            {isEn ? "Go to inventory" : "Ver inventario"}
          </div>
        </Card>
      </div>

      {/* ── Recent Activity ──────────────────────────────────── */}
      <Card className="p-6 border-border/50 shadow-sm rounded-2xl bg-card/40">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif text-primary flex items-center">
            <Activity className="h-4 w-4 text-primary mr-2" />
            {t("dashboard.recentActivity")}
            <InfoTooltip text={isEn
              ? "Latest actions on your farm: animal updates, inventory changes, and more."
              : "Últimas acciones en tu finca: animales, inventario, y más."
            } />
          </h3>
          <div className="flex items-center gap-2">
            {(stats?.recentActivityCount ?? 0) > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium tabular-nums">
                {stats?.recentActivityCount}
              </span>
            )}
            <button
              onClick={() => navigate("/activity")}
              className="text-xs text-primary/70 hover:text-primary font-medium flex items-center gap-0.5 transition-colors"
            >
              {isEn ? "View all" : "Ver todo"} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="space-y-5">
          {displayActivity && displayActivity.length > 0 ? displayActivity.map((item, i) => {
            const dotColor =
              item.actionType === "deleted"
                ? "bg-destructive"
                : item.actionType === "created" || item.actionType === "inventory_added"
                  ? "bg-emerald-500"
                  : item.actionType?.startsWith("inventory_")
                    ? "bg-accent"
                    : "bg-secondary";
            return (
              <div key={`${item._farmName}-${item.id}`} className="relative pl-6">
                {i !== displayActivity.length - 1 && (
                  <div className="absolute left-[7px] top-6 bottom-[-20px] w-0.5 bg-border/60" />
                )}
                <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-background ${dotColor}`} />
                <p className="text-sm font-medium text-foreground">
                  {(() => {
                    const label = ACTIVITY_LABELS[item.actionType ?? ""]?.[item.entityType ?? ""];
                    if (isEn && label) return label.en;
                    if (!isEn && label) return label.es;
                    return item.description || item.actionType;
                  })()}
                  {item._farmName && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/8 text-primary/60 font-sans font-normal">
                      {item._farmName}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(item.createdAt || ""), "dd MMM, HH:mm")} · {item.profile?.fullName || (isEn ? "User" : "Usuario")}
                </p>
              </div>
            );
          }) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t("dashboard.noActivity")}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
