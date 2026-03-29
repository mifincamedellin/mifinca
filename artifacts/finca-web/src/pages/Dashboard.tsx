import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetFarmStats, useListActivity, useListFarms } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, AlertTriangle, Syringe, PawPrint, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1.5">
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
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
          >
            <div className="bg-foreground text-background text-xs rounded-xl px-3 py-2 shadow-xl max-w-[200px] text-center leading-snug whitespace-normal">
              {text}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const isEn = i18n.language === "en";
  
  const { data: farms } = useListFarms({ query: { enabled: true } });
  const activeFarm = farms?.find(f => f.id === activeFarmId);

  const { data: stats, isLoading: statsLoading } = useGetFarmStats(activeFarmId || '', {
    query: { enabled: !!activeFarmId }
  });

  const { data: activity } = useListActivity(activeFarmId || '', { limit: 5 }, {
    query: { enabled: !!activeFarmId }
  });

  if (!activeFarmId) return <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: isEn ? undefined : es });
  const colors = ['#4A6741', '#C4956A', '#2C1810', '#6B8F61', '#8FAF85', '#D4A574', '#A0A0A0'];

  const SPECIES_LABELS: Record<string, { es: string; en: string }> = {
    cattle:  { es: "Bovinos",  en: "Cattle"  },
    pig:     { es: "Porcinos", en: "Pigs"    },
    horse:   { es: "Equinos",  en: "Horses"  },
    goat:    { es: "Caprinos", en: "Goats"   },
    sheep:   { es: "Ovinos",   en: "Sheep"   },
    chicken: { es: "Aves",     en: "Poultry" },
    other:   { es: "Otros",    en: "Other"   },
  };

  const chartData = stats?.animalsBySpecies?.map(entry => ({
    ...entry,
    label: SPECIES_LABELS[entry.species]?.[isEn ? "en" : "es"] ?? entry.species,
  })) ?? [];

  const statCards = [
    {
      title: t('dashboard.totalAnimals'),
      value: stats?.totalAnimals || 0,
      icon: PawPrint,
      color: "text-secondary",
      bg: "bg-secondary/10",
      tooltip: isEn
        ? "Total number of animals registered on this farm across all species."
        : "Número total de animales registrados en esta finca, de todas las especies.",
    },
    {
      title: t('dashboard.lowStock'),
      value: stats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      tooltip: isEn
        ? "Inventory items that have fallen below their minimum stock threshold."
        : "Artículos de inventario que han caído por debajo de su stock mínimo.",
    },
    {
      title: t('dashboard.upcomingTasks'),
      value: stats?.upcomingMedicalCount || 0,
      icon: Syringe,
      color: "text-accent",
      bg: "bg-accent/10",
      tooltip: isEn
        ? "Upcoming or overdue medical events such as vaccines and check-ups."
        : "Eventos médicos próximos o vencidos, como vacunas y revisiones.",
    },
    {
      title: t('dashboard.recentActivity'),
      value: stats?.recentActivityCount || activity?.length || 0,
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
      tooltip: isEn
        ? "Number of actions logged on this farm in the last 7 days."
        : "Acciones registradas en esta finca durante los últimos 7 días.",
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-primary mb-2">
            {t('dashboard.welcome')} <span className="text-accent">{activeFarm?.name}</span>
          </h1>
          <p className="text-muted-foreground capitalize">{today}</p>
        </div>
      </header>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i} className="h-32 animate-pulse bg-black/5 border-none" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <motion.div 
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 border-border/50 shadow-sm hover:shadow-md transition-shadow bg-card/60 backdrop-blur-sm rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center">
                      {stat.title}
                      <InfoTooltip text={stat.tooltip} />
                    </p>
                    <h3 className="text-3xl font-serif text-foreground font-bold">{stat.value}</h3>
                  </div>
                  <div className={`p-4 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 border-border/50 shadow-sm rounded-2xl bg-card/40">
          <h3 className="text-xl font-serif text-primary mb-6 flex items-center">
            {t('dashboard.animalsBySpecies')}
            <InfoTooltip text={
              isEn
                ? "A breakdown of how many animals you have per species on this farm."
                : "Distribución de cuántos animales tienes por especie en esta finca."
            } />
          </h3>
          <div className="h-72 w-full">
            {!statsLoading && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [value, isEn ? "Animals" : "Animales"]}
                    labelFormatter={(label: string) => label}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.count === 0 ? 'hsl(var(--muted))' : colors[index % colors.length]}
                        opacity={entry.count === 0 ? 0.5 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 border-border/50 shadow-sm rounded-2xl bg-card/40 flex flex-col">
          <h3 className="text-xl font-serif text-primary mb-6 flex items-center">
            {t('dashboard.recentActivity')}
            <InfoTooltip text={
              isEn
                ? "The latest actions recorded on your farm — animal updates, inventory changes, and more."
                : "Las últimas acciones registradas en tu finca: actualizaciones de animales, cambios de inventario y más."
            } />
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
            {activity && activity.length > 0 ? activity.map((item, i) => (
              <div key={item.id} className="relative pl-6">
                {i !== activity.length - 1 && (
                  <div className="absolute left-[7px] top-6 bottom-[-20px] w-0.5 bg-border/60" />
                )}
                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-background bg-secondary" />
                <p className="text-sm font-medium text-foreground">{item.description || item.actionType}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(item.createdAt || ''), 'dd MMM, HH:mm')} • {item.profile?.fullName || (isEn ? 'User' : 'Usuario')}
                </p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-10">
                {isEn ? "No recent activity" : "Sin actividad reciente"}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
