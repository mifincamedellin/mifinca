import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Stethoscope, CheckCircle2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { getConfigForSpecies, type LifecycleAnimal } from "@/lib/lifecycle";

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

export function LifecyclePregnantCard({ animal, farmId, onUpdate }: Props) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [dialogAction, setDialogAction] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  const now = new Date();
  const pregStart = toDate(animal.pregnancyStartedAt);
  const delivery = toDate(animal.expectedDeliveryAt);

  if (!pregStart) return null;

  const cfg = getConfigForSpecies(animal.species);
  const daysAlong = Math.max(0, differenceInDays(now, pregStart));
  const total = delivery ? differenceInDays(delivery, pregStart) : cfg.pregnancyDurationDays;
  const daysLeft = delivery ? Math.max(0, differenceInDays(delivery, now)) : null;
  const pct = clamp(Math.round((daysAlong / total) * 100), 0, 100);
  const dateFmt = (d: Date) => format(d, isEn ? "MMM d, yyyy" : "d MMM yyyy", { locale: isEn ? undefined : es });

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

  return (
    <>
      <Card className="rounded-2xl border shadow-sm border-rose-100 bg-gradient-to-br from-rose-50/60 to-pink-50/40 p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center justify-center p-2.5 text-base leading-none">🤰</span>
          <p className="text-sm font-semibold text-foreground">
            {isEn ? "Pregnancy" : "Preñez"}
          </p>
        </div>

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

        <div className="grid grid-cols-2 gap-3 mt-3">
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

        <div className="mt-4 pt-3 border-t border-rose-100 flex items-center justify-between gap-2">
          <div>
            {!animal.pregnancyCheckCompletedAt && (
              <Button
                size="sm"
                className="rounded-xl h-8 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                disabled={loading}
                onClick={() => { setNotesInput(""); setDialogAction("record-check"); }}
              >
                <Stethoscope className="h-3.5 w-3.5 mr-1" />
                {isEn ? "Record Check" : "Registrar chequeo"}
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-8 px-3 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
            disabled={loading}
            onClick={() => { setDateInput(new Date().toISOString().split("T")[0]!); setDialogAction("mark-delivered"); }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {isEn ? "Mark Delivered" : "Registrar parto"}
          </Button>
        </div>
      </Card>

      <Dialog open={dialogAction === "mark-delivered"} onOpenChange={(o) => !o && setDialogAction(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{isEn ? "Record Delivery" : "Registrar parto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">{isEn ? "Delivery date" : "Fecha de parto"}</label>
              <Input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <Button
              className="w-full rounded-xl bg-purple-500 hover:bg-purple-600"
              disabled={!dateInput || loading}
              onClick={() => doAction("mark-delivered", { date: dateInput })}
            >
              {isEn ? "Confirm" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAction === "record-check"} onOpenChange={(o) => !o && setDialogAction(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{isEn ? "Record Pregnancy Check" : "Registrar chequeo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">{isEn ? "Notes (optional)" : "Notas (opcional)"}</label>
              <Input
                value={notesInput}
                onChange={e => setNotesInput(e.target.value)}
                className="mt-1 rounded-xl"
                placeholder={isEn ? "Everything looks good..." : "Todo se ve bien..."}
              />
            </div>
            <Button
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600"
              disabled={loading}
              onClick={() => doAction("record-check", { notes: notesInput || undefined })}
            >
              {isEn ? "Confirm" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
