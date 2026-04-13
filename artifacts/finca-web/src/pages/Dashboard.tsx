import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetFarmStats, useListActivity, useListFarms, useGetMe, type FarmStats } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Activity, AlertTriangle, Syringe, PawPrint, HelpCircle,
  Users, Phone, TrendingUp, TrendingDown, ArrowRight, Plus, CalendarClock, Wallet, Baby,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

type StatsExt = FarmStats;
type FinanceRow = { id: string; type: "income" | "expense"; amount: string; date: string; category: string; description: string };

function formatCOP(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${Math.round(amount)}`;
}

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

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const isEn = i18n.language === "en";
  const [, navigate] = useLocation();

  const { data: user } = useGetMe({ query: { enabled: true } });
  const firstName = user?.isDemo
    ? (isEn ? "Owner" : "Dueño")
    : (user?.fullName?.split(" ")[0] ?? "");

  const { data: farms } = useListFarms({ query: { enabled: true } });
  const activeFarm = farms?.find(f => f.id === activeFarmId);

  const { data: rawStats, isLoading: statsLoading } = useGetFarmStats(activeFarmId || "", {
    query: { enabled: !!activeFarmId },
  });
  const stats = rawStats as StatsExt | undefined;

  const { data: activity } = useListActivity(activeFarmId || "", { limit: 5 }, {
    query: { enabled: !!activeFarmId },
  });

  const { data: finances } = useQuery<FinanceRow[]>({
    queryKey: ["finances-dashboard", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/finances`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const now = new Date();
  const thisMonth = (finances || []).filter(t => {
    const d = new Date(t.date);
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
    label: SPECIES_LABELS[entry.species]?.[isEn ? "en" : "es"] ?? entry.species,
  })) ?? [];

  const upcomingMedical = (stats?.upcomingMedical || []).slice(0, 5);
  const lowStockItems   = (stats?.lowStockItems   || []).slice(0, 5) as Array<{
    id: string; name: string; quantity: string; unit: string;
    status: string; lowStockThreshold: string | null;
  }>;

  const statCards = [
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
        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-6 pl-6 pr-2 md:mx-0 md:pl-0 md:pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => navigate("/animals")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("dashboard.newAnimal")}
          </button>
          <button
            onClick={() => navigate("/finances")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border/60 bg-card/60 text-sm font-medium text-foreground hover:bg-accent/10 hover:border-accent/40 transition-all cursor-pointer shrink-0"
          >
            <Wallet className="h-3.5 w-3.5 text-accent" />
            {t("dashboard.newTransaction")}
          </button>
          <button
            onClick={() => navigate("/animals")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border/60 bg-card/60 text-sm font-medium text-foreground hover:bg-accent/10 hover:border-accent/40 transition-all cursor-pointer shrink-0"
          >
            <CalendarClock className="h-3.5 w-3.5 text-accent" />
            {t("dashboard.medicalEvent")}
          </button>
        </div>
      </header>

      {/* ── Stat cards ──────────────────────────────────────── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Card key={i} className="h-24 animate-pulse bg-black/5 border-none" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

      {/* ── Middle row: Species chart + Finances card ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Species bar chart */}
        <Card className="lg:col-span-2 p-6 border-border/50 shadow-sm rounded-2xl bg-card/40">
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

        {/* Finances this-month card */}
        <Card
          className="p-6 border-border/50 shadow-sm rounded-2xl bg-card/40 flex flex-col cursor-pointer hover:shadow-md transition-all hover:border-border group"
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
                {formatCOP(monthIncome)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-sm text-muted-foreground">{t("dashboard.expenses")}</span>
              </div>
              <span className="font-semibold text-red-500 tabular-nums">
                {formatCOP(monthExpenses)}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-semibold text-foreground">{t("dashboard.netBalance")}</span>
              <span className={`text-xl font-serif font-bold tabular-nums ${monthNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {monthNet >= 0 ? "+" : ""}{formatCOP(monthNet)}
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
            {upcomingMedical.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                {upcomingMedical.length}
              </span>
            )}
          </div>
          <div className="flex-1">
          {upcomingMedical.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("dashboard.noUpcomingEvents")}</p>
          ) : (
            <ul className="space-y-1.5">
              {upcomingMedical.map((evt) => {
                const evtAny = evt as typeof evt & { animalName?: string; animalId?: string };
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
                        <p className="text-sm font-medium text-foreground leading-tight truncate">{evt.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {evtAny.animalName || "—"} · {dateStr}
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent/80 flex-shrink-0 capitalize">
                        {typeLabel}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover/item:text-accent/50 flex-shrink-0 transition-colors" />
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
          {activity && activity.length > 0 ? activity.map((item, i) => {
            const dotColor =
              item.actionType === "deleted"
                ? "bg-destructive"
                : item.actionType === "created" || item.actionType === "inventory_added"
                  ? "bg-emerald-500"
                  : item.actionType?.startsWith("inventory_")
                    ? "bg-accent"
                    : "bg-secondary";
            return (
              <div key={item.id} className="relative pl-6">
                {i !== activity.length - 1 && (
                  <div className="absolute left-[7px] top-6 bottom-[-20px] w-0.5 bg-border/60" />
                )}
                <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-background ${dotColor}`} />
                <p className="text-sm font-medium text-foreground">{item.description || item.actionType}</p>
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
