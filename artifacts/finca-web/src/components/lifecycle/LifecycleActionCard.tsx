import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Heart, Baby, Stethoscope, Milk, Flame, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  deriveLifecycleStage, getLifecycleStatus, getLifecycleAlerts,
  getStageColor, getStageIcon, type LifecycleAnimal, type LifecycleStage,
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

export function LifecycleActionCard({ animal, farmId, onUpdate }: Props) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [dialogAction, setDialogAction] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  const stage = deriveLifecycleStage(animal);
  const status = getLifecycleStatus(animal);
  const alerts = getLifecycleAlerts(animal);

  if (!stage || !status) return null;

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
      setDueDateInput("");
      setNotesInput("");
    }
  };

  const stageColor = getStageColor(stage);

  const renderActions = () => {
    switch (stage) {
      case "growing":
        return null;
      case "can_breed":
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" className="rounded-xl h-8 px-3 text-xs bg-orange-500 hover:bg-orange-600 text-white"
              disabled={loading}
              onClick={() => { setDateInput(new Date().toISOString().split("T")[0]!); setDialogAction("mark-in-heat"); }}
            >
              <Flame className="h-3.5 w-3.5 mr-1" />
              {isEn ? "Mark In Heat" : "Marcar en celo"}
            </Button>
            <Button
              size="sm" variant="outline" className="rounded-xl h-8 px-3 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
              disabled={loading}
              onClick={() => { setDateInput(new Date().toISOString().split("T")[0]!); setDueDateInput(""); setDialogAction("mark-pregnant"); }}
            >
              <Baby className="h-3.5 w-3.5 mr-1" />
              {isEn ? "Mark Pregnant" : "Marcar preñada"}
            </Button>
          </div>
        );
      case "in_heat":
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" className="rounded-xl h-8 px-3 text-xs bg-rose-500 hover:bg-rose-600 text-white"
              disabled={loading}
              onClick={() => { setDateInput(new Date().toISOString().split("T")[0]!); setDueDateInput(""); setDialogAction("mark-pregnant"); }}
            >
              <Baby className="h-3.5 w-3.5 mr-1" />
              {isEn ? "Mark Pregnant" : "Marcar preñada"}
            </Button>
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

  return (
    <>
      <Card className={`p-5 rounded-2xl border shadow-sm border-border/40 bg-card`}>
        <LifecycleBar currentStage={stage} />

        <div className="mt-5 grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">
              {isEn ? "Stage" : "Etapa"}
            </p>
            <p className="text-sm font-bold flex items-center gap-1.5">
              <span>{getStageIcon(stage)}</span>
              {isEn ? status.stageLabelEn : status.stageLabel}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">
              {isEn ? "Progress" : "Progreso"}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {isEn ? status.progressEn : status.progress || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide mb-1">
              {isEn ? "Next Event" : "Próximo evento"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isEn ? status.nextEventEn : status.nextEvent || "—"}
            </p>
          </div>
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

        <div className="mt-4 pt-3 border-t border-border/30">
          {renderActions()}
          {stage === "growing" && (
            <p className="text-xs text-muted-foreground/60">
              {isEn ? "No breeding actions available yet" : "Aún no hay acciones de reproducción disponibles"}
            </p>
          )}
        </div>
      </Card>

      <Dialog open={dialogAction === "mark-in-heat"} onOpenChange={(o) => !o && setDialogAction(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="font-serif text-xl">{isEn ? "Mark In Heat" : "Marcar en celo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">{isEn ? "Heat start date" : "Fecha de inicio del celo"}</label>
              <Input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <Button className="w-full rounded-xl bg-orange-500 hover:bg-orange-600" disabled={!dateInput || loading}
              onClick={() => doAction("mark-in-heat", { date: dateInput })}>
              {isEn ? "Confirm" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogAction === "mark-pregnant"} onOpenChange={(o) => !o && setDialogAction(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="font-serif text-xl">{isEn ? "Mark Pregnant" : "Marcar preñada"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">{isEn ? "Pregnancy start date" : "Fecha de inicio de preñez"}</label>
              <Input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium">{isEn ? "Due date (optional)" : "Fecha probable de parto (opcional)"}</label>
              <Input type="date" value={dueDateInput} onChange={e => setDueDateInput(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <Button className="w-full rounded-xl bg-rose-500 hover:bg-rose-600" disabled={!dateInput || loading}
              onClick={() => doAction("mark-pregnant", { date: dateInput, ...(dueDateInput ? { dueDate: dueDateInput } : {}) })}>
              {isEn ? "Confirm" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
