import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Milk, AlertTriangle, TrendingUp, CheckCircle2, Flame, Baby } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  deriveLifecycleStage, getLifecycleAlerts, getConfigForSpecies,
  type LifecycleAnimal, type LifecycleStage,
} from "@/lib/lifecycle";

const STAGE_ICONS: Record<LifecycleStage, React.FC<{ className?: string }>> = {
  growing:   TrendingUp,
  can_breed: CheckCircle2,
  in_heat:   Flame,
  pregnant:  Baby,
  nursing:   Milk,
};

interface Props {
  animal: LifecycleAnimal & { id: string };
  farmId: string;
  onUpdate: () => void;
}

async function lifecycleAction(farmId: string, animalId: string, action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`/api/farms/${farmId}/animals/${animalId}/lifecycle/${action}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`lifecycle action failed: ${action}`);
  return res.json();
}

function toDate(v?: string | Date | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function LifecycleActionCard({ animal, farmId, onUpdate }: Props) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const stage = deriveLifecycleStage(animal);
  const alerts = getLifecycleAlerts(animal);

  if (!stage || stage === "pregnant" || stage === "can_breed") return null;

  const doAction = async (action: string, body: Record<string, unknown> = {}) => {
    setLoading(true);
    try {
      await lifecycleAction(farmId, animal.id, action, body);
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals/${animal.id}`] });
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals`] });
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const renderStageInfo = () => {
    const now = new Date();
    switch (stage) {
      case "nursing": {
        const nursStart = toDate(animal.nursingStartedAt);
        const nursEnd = toDate(animal.nursingEndsAt);
        if (!nursStart) return null;
        const cfg = getConfigForSpecies(animal.species);
        const elapsed = Math.max(0, differenceInDays(now, nursStart));
        const total = nursEnd ? differenceInDays(nursEnd, nursStart) : cfg.nursingDurationDays;
        const remaining = nursEnd ? Math.max(0, differenceInDays(nursEnd, now)) : null;
        const pct = clamp(Math.round((elapsed / total) * 100), 0, 100);
        return (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{isEn ? `${elapsed} days nursing` : `${elapsed} días de lactancia`}</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{pct}%</span>
              </div>
              <div className="h-2.5 bg-purple-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            {remaining !== null && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-purple-500/10 dark:bg-purple-500/15 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-purple-500 dark:text-purple-400 uppercase tracking-wide mb-0.5">
                    {isEn ? "Nursing since" : "Desde"}
                  </p>
                  <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    {format(nursStart, isEn ? "MMM d, yyyy" : "d MMM yyyy", { locale: isEn ? undefined : es })}
                  </p>
                </div>
                <div className="bg-violet-500/10 dark:bg-violet-500/15 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-violet-500 dark:text-violet-400 uppercase tracking-wide mb-0.5">
                    {isEn ? "Weaning in" : "Destete en"}
                  </p>
                  <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    {remaining === 0
                      ? (isEn ? "Today" : "Hoy")
                      : isEn ? `${remaining} days` : `${remaining} días`}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      }
      case "in_heat": {
        const heatStart = toDate(animal.heatStartedAt);
        const heatEnd = toDate(animal.heatEndsAt);
        if (!heatEnd) return null;
        const cfg = getConfigForSpecies(animal.species);
        const total = heatStart ? differenceInDays(heatEnd, heatStart) : cfg.heatDurationDays;
        const remaining = Math.max(0, differenceInDays(heatEnd, now));
        const elapsed = Math.max(0, total - remaining);
        const pct = clamp(Math.round((elapsed / total) * 100), 0, 100);
        return (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{isEn ? `${remaining} day${remaining !== 1 ? "s" : ""} remaining` : `${remaining} día${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">{pct}%</span>
              </div>
              <div className="h-2.5 bg-orange-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="bg-orange-500/10 dark:bg-orange-500/15 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wide mb-0.5">
                {isEn ? "Heat ends" : "Celo termina"}
              </p>
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                {format(heatEnd, isEn ? "MMM d, yyyy" : "d MMM yyyy", { locale: isEn ? undefined : es })}
              </p>
            </div>
          </div>
        );
      }
      case "growing": {
        const w = animal.currentWeightKg != null
          ? (typeof animal.currentWeightKg === "string" ? parseFloat(animal.currentWeightKg) : animal.currentWeightKg)
          : null;
        if (w == null) return null;
        const cfg = getConfigForSpecies(animal.species);
        const target = animal.minimumBreedingWeightKg != null
          ? (typeof animal.minimumBreedingWeightKg === "string" ? parseFloat(animal.minimumBreedingWeightKg as string) : animal.minimumBreedingWeightKg)
          : cfg.minimumBreedingWeightKg;
        const pct = clamp(Math.round((w / target) * 100), 0, 100);
        const remaining = Math.max(0, Math.round(target - w));
        return (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{isEn ? `${Math.round(w)} of ${Math.round(target)} kg` : `${Math.round(w)} de ${Math.round(target)} kg`}</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{pct}%</span>
              </div>
              <div className="h-2.5 bg-blue-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-blue-500/10 dark:bg-blue-500/15 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wide mb-0.5">
                  {isEn ? "Current weight" : "Peso actual"}
                </p>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{Math.round(w)} kg</p>
              </div>
              <div className="bg-sky-500/10 dark:bg-sky-500/15 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-sky-500 dark:text-sky-400 uppercase tracking-wide mb-0.5">
                  {isEn ? "Still needs" : "Faltan"}
                </p>
                <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
                  {remaining > 0 ? `${remaining} kg` : (isEn ? "Ready!" : "¡Lista!")}
                </p>
              </div>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const renderActions = () => {
    switch (stage) {
      case "growing":
        return null;
      case "in_heat":
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" variant="outline" className="rounded-xl h-8 px-3 text-xs"
              disabled={loading}
              onClick={() => doAction("end-heat")}
            >
              {isEn ? "End Heat" : "Terminar celo"}
            </Button>
          </div>
        );
      case "nursing":
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" className="rounded-xl h-8 px-3 text-xs bg-purple-500 hover:bg-purple-600 text-white border-0"
              disabled={loading}
              onClick={() => doAction("wean")}
            >
              <Milk className="h-3.5 w-3.5 mr-1" />
              {isEn ? "Wean Calf" : "Destetar"}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const stageInfo = renderStageInfo();
  const actions = renderActions();

  const stageLabels: Record<string, { en: string; es: string }> = {
    growing: { en: "Growing", es: "Crecimiento" },
    in_heat: { en: "In Heat", es: "En celo" },
    nursing: { en: "Nursing", es: "Lactancia" },
  };

  return (
    <Card className="rounded-2xl border shadow-sm border-border/40 bg-card p-5">
      <div className="flex items-center gap-2">
        {(() => { const Icon = STAGE_ICONS[stage]; return Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null; })()}
        <p className="text-sm font-semibold text-foreground">
          {isEn ? stageLabels[stage]?.en : stageLabels[stage]?.es}
        </p>
      </div>

      {stageInfo}

      {alerts.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {alerts.slice(0, 3).map((alert) => (
            <div key={alert.type} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              alert.severity === "urgent"
                ? "bg-red-500/10 text-red-700 dark:text-red-400"
                : alert.severity === "warning"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
            }`}>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="font-medium">{isEn ? alert.labelEn : alert.label}</span>
            </div>
          ))}
        </div>
      )}

      {actions && (
        <div className="mt-4 pt-3 border-t border-border/30">
          {actions}
        </div>
      )}
    </Card>
  );
}
