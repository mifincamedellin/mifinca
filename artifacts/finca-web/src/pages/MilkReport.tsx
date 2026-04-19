import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useStore, ALL_FARMS_ID } from "@/lib/store";
import { useListFarms } from "@workspace/api-client-react";
import { useFarmPermissions } from "@/lib/useFarmPermissions";
import { exportFarmMilkToPdf } from "@/lib/exportPdf";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplets, FileDown, X, TrendingUp, TrendingDown, Minus, Hash, PawPrint } from "lucide-react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface MilkAnimal {
  id: string;
  name: string | null;
  customTag: string | null;
  status: string | null;
  totalLiters: number;
  recordCount: number;
  dailyAvg: number;
  lastRecordedAt: string | null;
  trend: "up" | "down" | "flat";
}

interface MilkReportData {
  animals: MilkAnimal[];
  summary: { totalLiters: number; totalRecords: number; from: string | null; to: string | null };
}

export function MilkReport() {
  const { t } = useTranslation();
  const { activeFarmId } = useStore();
  const { can } = useFarmPermissions();
  const { data: farms } = useListFarms();

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split("T")[0];

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [selectedAnimalId, setSelectedAnimalId] = useState("__all__");

  const isEn = t("nav.dashboard") === "Dashboard";

  const farmsList = (farms as Array<{ id: string; name: string }> | undefined) ?? [];
  const isAllFarms = activeFarmId === ALL_FARMS_ID;
  const farmIds = farmsList.map(f => f.id);
  const activeFarm = farmsList.find(f => f.id === activeFarmId);
  const farmName = activeFarm?.name;

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (!isAllFarms && selectedAnimalId !== "__all__") qs.set("animalId", selectedAnimalId);

  const { data: singleData, isLoading: singleLoading } = useQuery<MilkReportData>({
    queryKey: [`/api/farms/${activeFarmId}/milk`, from, to, selectedAnimalId],
    enabled: !!activeFarmId && !isAllFarms && can("can_view_animals"),
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/milk?${qs.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const { data: allFarmsData, isLoading: allLoading } = useQuery<MilkReportData>({
    queryKey: ["all-farms-milk", farmIds.join(","), from, to],
    enabled: isAllFarms && farmIds.length > 0,
    queryFn: async () => {
      const allQs = new URLSearchParams();
      if (from) allQs.set("from", from);
      if (to) allQs.set("to", to);
      const results = await Promise.all(
        farmIds.map((id, i) =>
          fetch(`/api/farms/${id}/milk?${allQs.toString()}`).then(r =>
            r.ok ? r.json().then((d: MilkReportData) => ({
              ...d,
              animals: d.animals.map(a => ({ ...a, _farmName: farmsList[i]?.name ?? "" })),
            })) : null
          )
        )
      );
      const valid = results.filter(Boolean) as (MilkReportData & { animals: (MilkAnimal & { _farmName?: string })[] })[];
      const merged = valid.flatMap(d => d.animals);
      merged.sort((a, b) => b.totalLiters - a.totalLiters);
      const totalLiters = valid.reduce((s, d) => s + (d.summary?.totalLiters ?? 0), 0);
      const totalRecords = valid.reduce((s, d) => s + (d.summary?.totalRecords ?? 0), 0);
      return {
        animals: merged as MilkAnimal[],
        summary: { totalLiters, totalRecords, from, to },
      };
    },
  });

  const data = isAllFarms ? allFarmsData : singleData;
  const isLoading = isAllFarms ? allLoading : singleLoading;

  const allAnimals = useMemo(() => data?.animals ?? [], [data]);
  const summary = data?.summary ?? { totalLiters: 0, totalRecords: 0, from: null, to: null };

  const chartData = useMemo(
    () =>
      allAnimals
        .filter(a => a.totalLiters > 0)
        .slice(0, 15)
        .map(a => ({
          label: a.customTag || a.name || "—",
          liters: a.totalLiters,
        })),
    [allAnimals]
  );

  const animalOptions = useMemo(
    () => allAnimals.map(a => ({ id: a.id, label: a.customTag ? `${a.customTag}${a.name ? ` · ${a.name}` : ""}` : (a.name ?? a.id) })),
    [allAnimals]
  );

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return format(new Date(d + "T12:00:00"), isEn ? "MMM dd, yyyy" : "dd MMM yyyy", { locale: isEn ? undefined : es });
  }

  function handleExport() {
    exportFarmMilkToPdf({
      animals: allAnimals,
      summary,
      farmName,
      isEn,
    });
  }

  function clearFilter() {
    setFrom(thirtyDaysAgo);
    setTo(today);
    setSelectedAnimalId("__all__");
  }

  const hasFilter = from !== thirtyDaysAgo || to !== today || selectedAnimalId !== "__all__";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary flex items-center gap-2">
            <Droplets className="h-6 w-6 text-sky-500" />
            {t("milk.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("milk.subtitle")}</p>
        </div>
        {allAnimals.length > 0 && (
          <Button
            variant="outline"
            className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 gap-1.5 shrink-0"
            onClick={handleExport}
          >
            <FileDown className="h-4 w-4" />
            {t("milk.exportPdf")}
          </Button>
        )}
      </div>

      <Card className="p-4 rounded-2xl border-border/40 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">{t("milk.dateFrom")}</label>
            <Input
              type="date"
              value={from}
              max={to || today}
              onChange={e => setFrom(e.target.value)}
              className="rounded-xl h-9 text-sm w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">{t("milk.dateTo")}</label>
            <Input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={e => setTo(e.target.value)}
              className="rounded-xl h-9 text-sm w-40"
            />
          </div>
          {!isAllFarms && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">{t("milk.animalLabel")}</label>
              <Select value={selectedAnimalId} onValueChange={setSelectedAnimalId}>
                <SelectTrigger className="rounded-xl h-9 text-sm w-52">
                  <SelectValue placeholder={t("milk.filterAnimal")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("milk.filterAnimal")}</SelectItem>
                  {animalOptions.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {hasFilter && (
            <Button variant="ghost" size="sm" className="rounded-xl h-9 gap-1 text-muted-foreground" onClick={clearFilter}>
              <X className="h-3.5 w-3.5" />
              {t("milk.clearFilter")}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 rounded-2xl shadow-sm border-border/40 flex items-center gap-4">
          <div className="p-3 bg-sky-50 rounded-xl">
            <Droplets className="h-5 w-5 text-sky-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("milk.totalProduced")}</p>
            <p className="text-2xl font-bold text-primary font-serif">{summary.totalLiters.toFixed(1)} L</p>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl shadow-sm border-border/40 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <Hash className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("milk.totalRecords")}</p>
            <p className="text-2xl font-bold text-primary font-serif">{summary.totalRecords}</p>
          </div>
        </Card>
        <Card className="p-5 rounded-2xl shadow-sm border-border/40 flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl">
            <PawPrint className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("milk.cattleWithRecords")}</p>
            <p className="text-2xl font-bold text-primary font-serif">{allAnimals.filter(a => a.recordCount > 0).length}</p>
          </div>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card className="p-5 rounded-2xl shadow-sm border-border/40">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-primary text-sm">{isEn ? "Production by Animal" : "Producción por Animal"}</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit=" L" />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} L`, isEn ? "Total" : "Total"]} />
              <Bar dataKey="liters" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card className="rounded-2xl shadow-sm border-border/40 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm">{isEn ? "Loading…" : "Cargando…"}</div>
        ) : allAnimals.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center text-muted-foreground">
            <Droplets className="h-10 w-10 text-border mb-3" />
            <p className="text-sm">{t("milk.noCattle")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{t("milk.colTag")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{t("milk.colName")}</th>
                  {isAllFarms && <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{isEn ? "Farm" : "Finca"}</th>}
                  <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{t("milk.colTotal")}</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{t("milk.colDailyAvg")}</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{t("milk.colRecords")}</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{t("milk.colLast")}</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{t("milk.colTrend")}</th>
                </tr>
              </thead>
              <tbody>
                {allAnimals.map((animal, i) => (
                  <tr
                    key={animal.id}
                    className={`border-b border-border/20 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/animals/${animal.id}`}>
                        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-lg cursor-pointer hover:bg-primary/20 transition-colors">
                          {animal.customTag ?? "—"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{animal.name ?? <span className="text-muted-foreground">—</span>}</td>
                    {isAllFarms && (
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {(animal as any)._farmName || "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`font-semibold ${animal.totalLiters > 0 ? "text-sky-600" : "text-muted-foreground"}`}>
                        {animal.totalLiters.toFixed(1)} L
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">{animal.dailyAvg.toFixed(1)} L</td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">{animal.recordCount}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(animal.lastRecordedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      {animal.recordCount === 0 ? (
                        <span className="text-muted-foreground/40">—</span>
                      ) : animal.trend === "up" ? (
                        <span className="inline-flex items-center justify-center gap-1 text-emerald-600 font-semibold text-xs" title={isEn ? "Improving ≥10%" : "Mejorando ≥10%"}>
                          <TrendingUp className="h-4 w-4" />
                        </span>
                      ) : animal.trend === "down" ? (
                        <span className="inline-flex items-center justify-center gap-1 text-red-500 font-semibold text-xs" title={isEn ? "Declining ≥10%" : "Bajando ≥10%"}>
                          <TrendingDown className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-1 text-muted-foreground text-xs" title={isEn ? "Stable" : "Estable"}>
                          <Minus className="h-4 w-4" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allAnimals.every(a => a.recordCount === 0) && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Droplets className="h-8 w-8 text-border mx-auto mb-2" />
                {t("milk.noData")}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
