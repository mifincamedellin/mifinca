import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Stethoscope, CheckCircle2, Baby, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { getConfigForSpecies, type LifecycleAnimal } from "@/lib/lifecycle";
import { useToast } from "@/hooks/use-toast";

interface Props {
  animal: LifecycleAnimal & { id: string };
  farmId: string;
  onUpdate: () => void;
}

interface MaleAnimal {
  id: string;
  name?: string | null;
  customTag?: string | null;
  species: string;
  sex: string;
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

async function createAnimal(farmId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/farms/${farmId}/animals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("failed to create animal");
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dialogAction, setDialogAction] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  // Newborn state
  const [registerNewborn, setRegisterNewborn] = useState(false);
  const [newbornSex, setNewbornSex] = useState<"female" | "male" | "unknown" | "">("");
  const [newbornName, setNewbornName] = useState("");
  const [newbornTag, setNewbornTag] = useState("");
  const [newbornFatherId, setNewbornFatherId] = useState("");
  const [maleAnimals, setMaleAnimals] = useState<MaleAnimal[]>([]);

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

  // Fetch male animals of same species when dialog opens
  useEffect(() => {
    if (dialogAction !== "mark-delivered") return;
    fetch(`/api/farms/${farmId}/animals?species=${animal.species}`)
      .then(r => r.ok ? r.json() : { animals: [] })
      .then(data => {
        const list: MaleAnimal[] = (data.animals ?? data ?? []).filter(
          (a: MaleAnimal) => a.sex === "male" && a.id !== animal.id
        );
        setMaleAnimals(list);
      })
      .catch(() => setMaleAnimals([]));
  }, [dialogAction, farmId, animal.species, animal.id]);

  const resetDeliveryDialog = () => {
    setRegisterNewborn(false);
    setNewbornSex("");
    setNewbornName("");
    setNewbornTag("");
    setNewbornFatherId("");
    setMaleAnimals([]);
  };

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
      resetDeliveryDialog();
    }
  };

  const handleMarkDelivered = async () => {
    setLoading(true);
    try {
      let offspringId: string | undefined;

      if (registerNewborn && newbornSex) {
        let newAnimal: Record<string, unknown>;
        try {
          newAnimal = await createAnimal(farmId, {
            species: animal.species,
            sex: newbornSex,
            name: newbornName.trim() || undefined,
            customTag: newbornTag.trim() || undefined,
            dateOfBirth: dateInput,
            motherId: animal.id,
            fatherId: newbornFatherId || undefined,
          });
        } catch {
          toast({
            variant: "destructive",
            title: isEn ? "Could not create newborn" : "Error al crear la cría",
            description: isEn
              ? "Please try again or register the calf manually."
              : "Intenta de nuevo o registra la cría manualmente.",
          });
          return;
        }

        offspringId = (newAnimal.id ?? (newAnimal.animal as Record<string, unknown>)?.id) as string | undefined;

        if (!offspringId) {
          toast({
            variant: "destructive",
            title: isEn ? "Could not create newborn" : "Error al crear la cría",
            description: isEn ? "Unexpected response from server." : "Respuesta inesperada del servidor.",
          });
          return;
        }
      }

      try {
        await lifecycleAction(farmId, animal.id, "mark-delivered", {
          date: dateInput,
          offspringId,
        });
      } catch {
        toast({
          variant: "destructive",
          title: isEn ? "Could not record delivery" : "Error al registrar el parto",
          description: isEn
            ? "Please try again."
            : "Intenta de nuevo.",
        });
        return;
      }

      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals/${animal.id}`] });
      qc.invalidateQueries({ queryKey: [`/api/farms/${farmId}/animals`] });
      onUpdate();
      setDialogAction(null);
      setDateInput("");
      resetDeliveryDialog();
    } finally {
      setLoading(false);
    }
  };

  const confirmDisabled =
    !dateInput || loading || (registerNewborn && !newbornSex);

  const sexOptions = [
    { value: "female", label: isEn ? "Female" : "Hembra" },
    { value: "male", label: isEn ? "Male" : "Macho" },
    { value: "unknown", label: isEn ? "Unknown" : "Desconocido" },
  ] as const;

  return (
    <>
      <Card className="rounded-2xl border shadow-sm border-rose-100 bg-gradient-to-br from-rose-50/60 to-pink-50/40 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100/60 text-rose-500">
              <Baby className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {isEn ? "Pregnancy" : "Preñez"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl h-8 px-3 text-xs border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              disabled={loading}
              onClick={() => {
                setDateInput(new Date().toISOString().split("T")[0]!);
                resetDeliveryDialog();
                setDialogAction("mark-delivered");
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              {isEn ? "Mark Delivered" : "Registrar parto"}
            </Button>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{isEn ? `${daysAlong} of ${total} days` : `${daysAlong} de ${total} días`}</span>
            <span className="font-semibold text-rose-600">
              {daysLeft !== null && daysLeft > 0
                ? (isEn ? `${daysLeft} days left` : `${daysLeft} días restantes`)
                : daysLeft === 0
                  ? (isEn ? "Due today!" : "¡Hoy!")
                  : `${pct}%`}
            </span>
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
            <div className="bg-pink-50/70 rounded-xl px-3 py-2.5 text-right">
              <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-wide mb-0.5">
                {isEn ? "Due date" : "Fecha probable"}
              </p>
              <p className="text-sm font-semibold text-pink-700">{dateFmt(delivery)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Mark Delivered Dialog */}
      <Dialog
        open={dialogAction === "mark-delivered"}
        onOpenChange={(o) => { if (!o) { setDialogAction(null); resetDeliveryDialog(); } }}
      >
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {isEn ? "Record Delivery" : "Registrar parto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Delivery date */}
            <div>
              <label className="text-sm font-medium">
                {isEn ? "Delivery date" : "Fecha de parto"}
              </label>
              <div className="relative mt-1">
                <Input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="rounded-xl pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Register newborn toggle */}
            <button
              type="button"
              onClick={() => setRegisterNewborn(v => !v)}
              className="w-full flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Baby className="h-4 w-4" />
                {isEn ? "Register newborn?" : "¿Registrar la cría?"}
              </span>
              {registerNewborn
                ? <ChevronUp className="h-4 w-4 text-rose-400" />
                : <ChevronDown className="h-4 w-4 text-rose-400" />}
            </button>

            {registerNewborn && (
              <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-3 space-y-3">
                {/* Sex selector */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    {isEn ? "Sex" : "Sexo"} <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {sexOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewbornSex(opt.value)}
                        className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                          newbornSex === opt.value
                            ? "bg-rose-500 text-white border-rose-500"
                            : "bg-white text-muted-foreground border-border hover:border-rose-200 hover:text-rose-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                    {isEn ? "Name (optional)" : "Nombre (opcional)"}
                  </label>
                  <Input
                    value={newbornName}
                    onChange={e => setNewbornName(e.target.value)}
                    className="rounded-xl h-8 text-sm"
                    placeholder={isEn ? "e.g. Bella" : "ej. Bella"}
                  />
                </div>

                {/* Tag */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                    {isEn ? "Ear tag (optional)" : "Arete (opcional)"}
                  </label>
                  <Input
                    value={newbornTag}
                    onChange={e => setNewbornTag(e.target.value)}
                    className="rounded-xl h-8 text-sm"
                    placeholder={isEn ? "e.g. BOV-042" : "ej. BOV-042"}
                  />
                </div>

                {/* Father */}
                {maleAnimals.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                      {isEn ? "Father (optional)" : "Padre (opcional)"}
                    </label>
                    <select
                      value={newbornFatherId}
                      onChange={e => setNewbornFatherId(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 h-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-rose-300"
                    >
                      <option value="">
                        {isEn ? "No father recorded" : "Sin padre registrado"}
                      </option>
                      {maleAnimals.map(m => (
                        <option key={m.id} value={m.id}>
                          {[m.customTag, m.name].filter(Boolean).join(" · ") || m.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full rounded-xl bg-rose-500 hover:bg-rose-600 text-white"
              disabled={confirmDisabled}
              onClick={handleMarkDelivered}
            >
              {registerNewborn
                ? (isEn ? "Confirm & Register Calf" : "Confirmar y registrar cría")
                : (isEn ? "Confirm" : "Confirmar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Pregnancy Check Dialog */}
      <Dialog open={dialogAction === "record-check"} onOpenChange={(o) => !o && setDialogAction(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {isEn ? "Record Pregnancy Check" : "Registrar chequeo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">
                {isEn ? "Notes (optional)" : "Notas (opcional)"}
              </label>
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
