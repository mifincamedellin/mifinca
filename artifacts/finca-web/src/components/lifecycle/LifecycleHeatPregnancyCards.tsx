import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Flame, Baby } from "lucide-react";
import { LIFECYCLE_CONFIG } from "@/lib/lifecycle";

async function lifecycleAction(farmId: string, animalId: string, action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`/api/farms/${farmId}/animals/${animalId}/lifecycle/${action}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`lifecycle action failed: ${action}`);
  return res.json();
}

interface BaseProps {
  animalId: string;
  farmId: string;
  onUpdate: () => void;
}

interface PregnantProps extends BaseProps {
  species: string;
}

export function MarkInHeatCard({ animalId, farmId, onUpdate }: BaseProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [loading, setLoading] = useState(false);

  const doAction = async () => {
    setLoading(true);
    try {
      await lifecycleAction(farmId, animalId, "mark-in-heat", { date: dateInput });
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals/${animalId}`] });
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals`] });
      onUpdate();
    } finally {
      setLoading(false);
      setOpen(false);
      setDateInput("");
    }
  };

  return (
    <>
      <Card className="rounded-2xl border shadow-sm border-border/40 bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isEn ? "Heat" : "Celo"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEn ? "No heat cycle recorded" : "Sin celo registrado"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setDateInput(new Date().toISOString().split("T")[0]!); setOpen(true); }}
            className="rounded-xl h-8 px-3 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800 shrink-0"
          >
            <Flame className="h-3.5 w-3.5 mr-1" />
            {isEn ? "Mark In Heat" : "Marcar en celo"}
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {isEn ? "Mark In Heat" : "Marcar en celo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">
                {isEn ? "Heat start date" : "Fecha de inicio del celo"}
              </label>
              <Input
                type="date"
                value={dateInput}
                onChange={e => setDateInput(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <Button
              className="w-full rounded-xl bg-orange-500 hover:bg-orange-600"
              disabled={!dateInput || loading}
              onClick={doAction}
            >
              {isEn ? "Confirm" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const CONCEPTION_METHODS = [
  { value: "natural", labelEs: "Monta natural", labelEn: "Natural mating" },
  { value: "ai", labelEs: "Inseminación artificial", labelEn: "Artificial insemination" },
  { value: "ivf", labelEs: "FIV / Transferencia de embriones", labelEn: "In-vitro fertilization (IVF) / Embryo transfer" },
] as const;

type ConceptionMethod = typeof CONCEPTION_METHODS[number]["value"];

export function MarkPregnantCard({ animalId, farmId, species, onUpdate }: PregnantProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dateInput, setDateInput] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [conception, setConception] = useState<ConceptionMethod | "">("");
  const [loading, setLoading] = useState(false);

  const gestationDays = LIFECYCLE_CONFIG[species]?.female?.pregnancyDurationDays
    ?? LIFECYCLE_CONFIG["cattle"]!.female.pregnancyDurationDays;

  const handleConceptionDateChange = (val: string) => {
    setDateInput(val);
    if (val) {
      const due = new Date(val + "T12:00:00");
      due.setDate(due.getDate() + gestationDays);
      setDueDateInput(due.toISOString().split("T")[0]!);
    }
  };

  const doAction = async () => {
    setLoading(true);
    try {
      await lifecycleAction(farmId, animalId, "mark-pregnant", {
        date: dateInput,
        ...(dueDateInput ? { dueDate: dueDateInput } : {}),
        ...(conception ? { conceptionMethod: conception } : {}),
      });
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals/${animalId}`] });
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals`] });
      onUpdate();
    } finally {
      setLoading(false);
      setOpen(false);
      setDateInput("");
      setDueDateInput("");
      setConception("");
    }
  };

  return (
    <>
      <Card className="rounded-2xl border shadow-sm border-border/40 bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <Baby className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isEn ? "Pregnancy" : "Preñez"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEn ? "No pregnancy recorded" : "Sin preñez registrada"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setDateInput(new Date().toISOString().split("T")[0]!); setDueDateInput(""); setConception(""); setOpen(true); }}
            className="rounded-xl h-8 px-3 text-xs border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 shrink-0"
          >
            <Baby className="h-3.5 w-3.5 mr-1" />
            {isEn ? "Mark Pregnant" : "Marcar preñada"}
          </Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {isEn ? "Mark Pregnant" : "Marcar preñada"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">
                {isEn ? "Confirmation date" : "Fecha de confirmación"}
              </label>
              <Input
                type="date"
                value={dateInput}
                onChange={e => handleConceptionDateChange(e.target.value)}
                className="mt-1 rounded-xl"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isEn ? "When was the pregnancy confirmed?" : "¿Cuándo se confirmó la preñez?"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">
                {isEn ? "Expected due date" : "Fecha probable de parto"}
              </label>
              <Input
                type="date"
                value={dueDateInput}
                onChange={e => setDueDateInput(e.target.value)}
                className="mt-1 rounded-xl"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isEn
                  ? `Auto-calculated at ${gestationDays} days. Adjust if needed.`
                  : `Calculada automáticamente a ${gestationDays} días. Ajusta si es necesario.`}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">
                {isEn ? "Conception method" : "Método de concepción"}
              </label>
              <div className="space-y-2">
                {CONCEPTION_METHODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setConception(m.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      conception === m.value
                        ? "bg-rose-50 border-rose-300 text-rose-800 font-medium"
                        : "bg-muted/30 border-border/50 text-foreground hover:border-border hover:bg-muted/50"
                    }`}
                  >
                    {isEn ? m.labelEn : m.labelEs}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full rounded-xl bg-rose-500 hover:bg-rose-600"
              disabled={!dateInput || loading}
              onClick={doAction}
            >
              {isEn ? "Confirm" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
