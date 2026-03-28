import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetAnimal, useListWeightRecords } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Activity, Scale, Syringe, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function AnimalDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { activeFarmId } = useStore();
  const isEn = i18n.language === "en";

  const { data: animal, isLoading } = useGetAnimal(activeFarmId || '', id || '', {
    query: { enabled: !!(activeFarmId && id) }
  });

  const { data: weights } = useListWeightRecords(activeFarmId || '', id || '', {
    query: { enabled: !!(activeFarmId && id) }
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">{t('animals.loadingDetails')}</div>;
  if (!animal) return <div className="p-8 text-center text-destructive">{t('animals.notFound')}</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Link href="/animals">
          <Button variant="ghost" size="icon" className="rounded-full hover-elevate bg-card border-none shadow-sm h-10 w-10">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
            {animal.name || `Animal ${animal.customTag}`}
            <span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full font-sans tracking-wide">
              {animal.customTag || t('animals.noTag')}
            </span>
          </h1>
          <p className="text-muted-foreground capitalize mt-1">
            {animal.species} • {animal.sex || t('animals.unknownSex')}
          </p>
        </div>
        <Button variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 hover-elevate">
          <Edit className="h-4 w-4 mr-2" /> {t('animals.edit')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="overflow-hidden rounded-2xl border-none shadow-md bg-card">
            <div className="h-48 bg-primary/10 flex items-center justify-center">
              {animal.photoUrl ? (
                <img src={animal.photoUrl} alt="Animal" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl text-primary/30 font-serif">{t('animals.noPhoto')}</span>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('animals.status')}</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${animal.status === 'active' ? 'bg-secondary' : 'bg-muted-foreground'}`}></div>
                  <span className="font-medium capitalize">{animal.status}</span>
                </div>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('animals.breed')}</p>
                <p className="font-medium text-foreground">{animal.breed || t('animals.breedUnknown')}</p>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('animals.birth')}</p>
                <p className="font-medium text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary/50" />
                  {animal.dateOfBirth
                    ? format(new Date(animal.dateOfBirth), 'dd MMM yyyy', { locale: isEn ? undefined : es })
                    : t('animals.birthUnknown')}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="md:col-span-3">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-card/50 p-1 rounded-xl mb-6 flex space-x-2">
              <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1">
                {t('animals.tab.overview')}
              </TabsTrigger>
              <TabsTrigger value="weight" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1">
                {t('animals.tab.weight')}
              </TabsTrigger>
              <TabsTrigger value="medical" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1">
                {t('animals.tab.medical')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="p-6 rounded-2xl bg-gradient-to-br from-card to-card/50 shadow-sm border-border/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">{t('animals.currentWeight')}</p>
                      <h3 className="text-4xl font-serif text-primary font-bold">
                        {animal.currentWeight || 0} <span className="text-xl text-muted-foreground">kg</span>
                      </h3>
                    </div>
                    <div className="p-3 bg-secondary/10 rounded-xl text-secondary">
                      <Scale className="h-6 w-6" />
                    </div>
                  </div>
                </Card>
                <Card className="p-6 rounded-2xl bg-gradient-to-br from-card to-card/50 shadow-sm border-border/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">{t('animals.treatments')}</p>
                      <h3 className="text-4xl font-serif text-primary font-bold">{animal.medicalRecords?.length || 0}</h3>
                    </div>
                    <div className="p-3 bg-accent/10 rounded-xl text-accent">
                      <Syringe className="h-6 w-6" />
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="weight" className="mt-0">
              <Card className="p-6 rounded-2xl border-border/50 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-serif text-primary">{t('animals.weightEvolution')}</h3>
                  <Button size="sm" className="rounded-xl bg-secondary hover:bg-secondary/90 hover-elevate">
                    {t('animals.recordWeight')}
                  </Button>
                </div>
                {weights && weights.length > 0 ? (
                  <div className="h-80 w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weights} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="recordedAt" 
                          tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                          axisLine={false} tickLine={false}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip 
                          labelFormatter={(val) => format(new Date(val), 'dd MMM yyyy')}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line type="monotone" dataKey="weightKg" stroke="hsl(var(--secondary))" strokeWidth={3}
                          dot={{ r: 6, fill: 'hsl(var(--secondary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-16 text-center text-muted-foreground flex flex-col items-center">
                    <Scale className="h-12 w-12 text-border mb-4" />
                    <p>{t('animals.noWeightRecords')}</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="medical" className="mt-0">
              <Card className="p-6 rounded-2xl border-border/50 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-serif text-primary">{t('animals.tab.medical')}</h3>
                  <Button size="sm" className="rounded-xl bg-accent hover:bg-accent/90 hover-elevate text-accent-foreground">
                    {t('animals.addMedical')}
                  </Button>
                </div>
                {animal.medicalRecords && animal.medicalRecords.length > 0 ? (
                  <div className="space-y-4">
                    {animal.medicalRecords.map((record) => (
                      <div key={record.id} className="p-4 rounded-xl border border-border/40 bg-black/[0.02] flex items-start gap-4">
                        <div className="p-3 bg-white rounded-lg shadow-sm">
                          <Syringe className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-primary">{record.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{record.description}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3"/> {format(new Date(record.recordDate), 'dd MMM yyyy')}
                            </span>
                            {record.vetName && <span>• Vet: {record.vetName}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center text-muted-foreground flex flex-col items-center">
                    <Activity className="h-12 w-12 text-border mb-4" />
                    <p>{t('animals.noMedicalRecords')}</p>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
