import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Stethoscope, Milk, CheckCircle2, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  deriveLifecycleStage, getLifecycleAlerts, getConfigForSpecies,
  getStageIcon, type LifecycleAnimal,
} from "@/lib/lifecycle";
import { LifecycleBar } from "./LifecycleBar";

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
  const [dialogAction, setDialogAction] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  const stage = deriveLifecycleStage(animal);
  const alerts = getLifecycleAlerts(animal);

  if (!stage) return null;

  const doAction = async (action: string, body: Record<string, unknown> = {}) => {
    setLoading(true);
    try {
      await lifecycleAction(farmId, animal.id, action, body);
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals/${animal.id}`] });
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals`] });
      onUpdate();
    } finally {
      setLoading(false);
      setDialogAction(null);
      setDateInput("");
      setNotesInput("");
    }
  };

  const isPregnant = stage === "pregnant";
  const cardClass = isPregnant
    ? "p-5 rounded-2xl border shadow-sm border-rose-200 bg-gradient-to-br from-rose-50/60 to-pink-50/40"
    : "p-5 rounded-2xl border shadow-sm border-border/40 bg-card";

  const renderStageInfo = () => {
    const now = new Date();
    switch (stage) {
      case "pregnant": {
        const pregStart = toDate(animal.pregnancyStartedAt);
        const delivery = toDate(animal.expectedDeliveryAt);
        if (!pregStart) return null;
        const cfg = getConfigForSpecies(animal.species);
        const daysAlong = Math.max(0, differenceInDays(now, pregStart));
        const total = delivery ? differenceInDays(delivery, pregStart) : cfg.pregnancyDurationDays;
        const daysLeft = delivery ? Math.max(0, differenceInDays(delivery, now)) : null;
        const pct = clamp(Math.round((daysAlong / total) * 100), 0, 100);
        const dateFmt = (d: Date) => format(d, isEn ? "MMM d, yyyy" : "d MMM yyyy", { locale: isEn ? undefined : es });
        return (
          <div className="mt-4 space-y-3">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{isEn ? `${daysAlong} of ${total} days` : `${daysAlong} de ${total} días`}</span>
                <span className="font-semibold text-rose-600">{pct}%</span>
              </div>
              <div className="h-2.5 bg-rose-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-rose-50/70 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wide mb-0.5">
                  {isEn ? "Confirmed" : "Confirmada"}
                </p>
                <p className="text-sm font-semibold text-rose-700">{dateFmt(pregStart)}</p>
              </div>
              {delivery && (
                <div className="bg-pink-50/70 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-wide mb-0.5">
                    {isEn ? "Due date" : "Fecha probable"}
                  </p>
                  <p className="text-sm font-semibold text-pink-700">{dateFmt(delivery)}</p>
                  {daysLeft !== null && (
                    <p className="text-[10px] text-pink-500 mt-0.5">
                      {daysLeft === 0
                        ? (isEn ? "Due today!" : "¡Hoy!")
                        : isEn ? `${daysLeft} days left` : `${daysLeft} días restantes`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }
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
                <span className="font-semibold text-purple-600">{pct}%</span>
              </div>
              <div className="h-2.5 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            {remaining !== null && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-purple-50/70 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide mb-0.5">
                    {isEn ? "Nursing since" : "Desde"}
                  </p>
                  <p className="text-sm font-semibold text-purple-700">
                    {format(nursStart, isEn ? "MMM d, yyyy" : "d MMM yyyy", { locale: isEn ? undefined : es })}
                  </p>
                </div>
                <div className="bg-violet-50/70 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide mb-0.5">
                    {isEn ? "Weaning in" : "Destete en"}
                  </p>
                  <p className="text-sm font-semibold text-violet-700">
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
                <span className="font-semibold text-orange-600">{pct}%</span>
              </div>
              <div className="h-2.5 bg-orange-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="bg-orange-50/70 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide mb-0.5">
                {isEn ? "Heat ends" : "Celo termina"}
              </p>
              <p className="text-sm font-semibold text-orange-700">
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
                <span className="font-semibold text-blue-600">{pct}%</span>
              </div>
              <div className="h-2.5 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-blue-50/70 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-0.5">
                  {isEn ? "Current weight" : "Peso actual"}
                </p>
                <p className="text-sm font-semibold text-blue-700">{Math.round(w)} kg</p>
              </div>
              <div className="bg-sky-50/70 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-sky-400 uppercase tracking-wide mb-0.5">
                  {isEn ? "Still needs" : "Faltan"}
                </p>
                <p className="text-sm font-semibold text-sky-700">
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
      case "can_breed":
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
      case "pregnant":
        return (
          <div className="flex flex-wrap gap-2">
            {!animal.pregnancyCheckCompletedAt && (
              <Button
                size="sm" className="rounded-xl h-8 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                disabled={loading}
                onClick={() => { setNotesInput(""); setDialogAction("record-check"); }}
              >
                <Stethoscope className="h-3.5 w-3.5 mr-1" />
                {isEn ? "Record Check" : "Registrar chequeo"}
              </Button>
            )}
            <Button
              size="sm" variant="outline" className="rounded-xl h-8 px-3 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
              disabled={loading}
              onClick={() => { setDateInput(new Date().toISOString().split("T")[0]!); setDialogAction("mark-delivered"); }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {isEn ? "Mark Delivered" : "Registrar parto"}
            </Button>
          </div>
        );
      case "nursing":
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" className="rounded-xl h-8 px-3 text-xs bg-purple-500 hover:bg-purple-600 text-white"
              disabled={loading}
              onClick={() => doAction("wean")}
            >
              <Milk className="h-3.5 w-3.5 mr-1" />
              {isEn ? "Wean Calf" : "Destetar"}
            </Button>
          </div>
        );
    }
  };

  const stageInfo = renderStageInfo();
  const actions = renderActions();

  return (
    <>
      <Card className={cardClass}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{getStageIcon(stage)}</span>
          <p className="text-sm font-semibold text-foreground">
            {isEn
              ? { growing: "Growing", can_breed: "Can Breed", in_heat: "In Heat", pregnant: "Pregnant", nursing: "Nursing" }[stage]
              : { growing: "Crecimiento", can_breed: "Lista para reproducir", in_heat: "En celo", pregnant: "Preñada", nursing: "Lactancia" }[stage]
            }
          </p>
        </div>

        {stageInfo}

        <div className={stageInfo ? "mt-4" : "mt-4"}>
          <LifecycleBar currentStage={stage} />
        </div>

        {alerts.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {alerts.slice(0, 3).map((alert) => (
              <div key={alert.type} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                alert.severity === "urgent" ? "bg-red-50 text-red-700" :
                alert.severity === "warning" ? "bg-amber-50 text-amber-700" :
                "bg-blue-50 text-blue-700"
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

      <Dialog open={dialogAction === "mark-delivered"} onOpenChange={(o) => !o && setDialogAction(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="font-serif text-xl">{isEn ? "Record Delivery" : "Registrar parto"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">{isEn ? "Delivery date" : "Fecha de parto"}</label>
              <Input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <Button className="w-full rounded-xl bg-purple-500 hover:bg-purple-600" disabled={!dateInput || loading}
              onClick={() => doAction("mark-delivered", { date: dateInput })}>
              {isEn ? "Confirm" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAction === "record-check"} onOpenChange={(o) => !o && setDialogAction(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="font-serif text-xl">{isEn ? "Record Pregnancy Check" : "Registrar chequeo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">{isEn ? "Notes (optional)" : "Notas (opcional)"}</label>
              <Input value={notesInput} onChange={e => setNotesInput(e.target.value)} className="mt-1 rounded-xl" placeholder={isEn ? "Everything looks good..." : "Todo se ve bien..."} />
            </div>
            <Button className="w-full rounded-xl bg-amber-500 hover:bg-amber-600" disabled={loading}
              onClick={() => doAction("record-check", { notes: notesInput || undefined })}>
              {isEn ? "Confirm" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
