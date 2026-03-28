import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetFarmStats, useListActivity, useListFarms } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, AlertTriangle, Syringe, PawPrint } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  
  const { data: farms } = useListFarms({ query: { enabled: true } });
  const activeFarm = farms?.find(f => f.id === activeFarmId);

  const { data: stats, isLoading: statsLoading } = useGetFarmStats(activeFarmId || '', {
    query: { enabled: !!activeFarmId }
  });

  const { data: activity } = useListActivity(activeFarmId || '', { limit: 5 }, {
    query: { enabled: !!activeFarmId }
  });

  if (!activeFarmId) return <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: i18n.language === 'es' ? es : undefined });
  const colors = ['#4A6741', '#C4956A', '#2C1810', '#6B8F61', '#E8D5BF'];

  const statCards = [
    { title: t('dashboard.totalAnimals'), value: stats?.totalAnimals || 0, icon: PawPrint, color: "text-secondary", bg: "bg-secondary/10" },
    { title: t('dashboard.lowStock'), value: stats?.lowStockCount || 0, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { title: t('dashboard.upcomingTasks'), value: stats?.upcomingMedicalCount || 0, icon: Syringe, color: "text-accent", bg: "bg-accent/10" },
    { title: t('dashboard.recentActivity'), value: stats?.recentActivityCount || activity?.length || 0, icon: Activity, color: "text-primary", bg: "bg-primary/10" },
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
                    <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
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
          <h3 className="text-xl font-serif text-primary mb-6">{t('dashboard.animalsBySpecies')}</h3>
          <div className="h-72 w-full">
            {stats?.animalsBySpecies && stats.animalsBySpecies.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.animalsBySpecies} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="species" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Bar dataKey="count" radius={[6, 6, 6, 6]} barSize={40}>
                    {stats.animalsBySpecies.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <img src={`${import.meta.env.BASE_URL}images/empty-farm.png`} className="h-32 object-contain opacity-50 mb-4" alt="Empty" />
                <p>No hay datos disponibles</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 border-border/50 shadow-sm rounded-2xl bg-card/40 flex flex-col">
          <h3 className="text-xl font-serif text-primary mb-6">{t('dashboard.recentActivity')}</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-5">
            {activity && activity.length > 0 ? activity.map((item, i) => (
              <div key={item.id} className="relative pl-6">
                {/* Timeline line */}
                {i !== activity.length - 1 && (
                  <div className="absolute left-[7px] top-6 bottom-[-20px] w-0.5 bg-border/60" />
                )}
                {/* Timeline dot */}
                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-background bg-secondary" />
                
                <p className="text-sm font-medium text-foreground">{item.description || item.actionType}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(item.createdAt || ''), 'dd MMM, HH:mm')} • {item.profile?.fullName || 'Usuario'}
                </p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sin actividad reciente</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
