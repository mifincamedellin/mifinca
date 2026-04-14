import { useState, useRef } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { formatCurrency, currencyInputDisplay, currencyInputRaw } from "@/lib/currency";
import { useGetAnimal, useListWeightRecords, useUpdateAnimal, useCreateWeightRecord, useCreateMedicalRecord } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { ArrowLeft, Edit, Activity, Scale, Syringe, Calendar, CalendarClock, GitBranch, Camera, Upload, X, Droplets, Plus, TrendingUp, Trash2, Baby, CheckCircle2, Skull } from "lucide-react";
import { LifecycleActionCard } from "@/components/lifecycle/LifecycleActionCard";
import { MarkInHeatCard, MarkPregnantCard } from "@/components/lifecycle/LifecycleHeatPregnancyCards";
import { hasLifecycle, deriveLifecycleStage, type LifecycleAnimal } from "@/lib/lifecycle";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AnimalLineage } from "./AnimalLineage";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";

const SPECIES_EMOJI: Record<string, string> = {
  cattle: "🐄", pig: "🐖", horse: "🐴",
  goat: "🐐", sheep: "🐑", chicken: "🐔", other: "🐾",
};
const ALL_SPECIES = ["cattle", "pig", "horse", "goat", "sheep", "chicken", "other"];

const RECORD_TYPES = ["vaccination", "treatment", "checkup", "surgery", "deworming", "other"] as const;

const medicalSchema = z.object({
  recordType: z.enum(RECORD_TYPES),
  title: z.string().min(1),
  recordDate: z.string().min(1),
  description: z.string().optional(),
  vetName: z.string().optional(),
  costCop: z.coerce.number().nonnegative().optional().or(z.literal("")),
  nextDueDate: z.string().optional(),
});
type MedicalForm = z.infer<typeof medicalSchema>;

const weightSchema = z.object({
  weightKg: z.coerce.number().positive(),
  recordedAt: z.string().min(1),
  notes: z.string().optional(),
});
type WeightForm = z.infer<typeof weightSchema>;

const milkSchema = z.object({
  amountLiters: z.coerce.number().positive(),
  recordedAt: z.string().min(1),
  session: z.enum(["morning", "afternoon", "evening", "full_day"]).optional(),
  notes: z.string().optional(),
});
type MilkForm = z.infer<typeof milkSchema>;

const pregnancySchema = z.object({
  pregnancyStartDate: z.string().min(1),
  pregnancyDueDate: z.string().min(1),
});
type PregnancyForm = z.infer<typeof pregnancySchema>;

const CATTLE_GESTATION_DAYS = 283;

const DEATH_CAUSES = [
  "disease", "accident", "old_age", "difficult_birth", "predator", "unknown", "other",
] as const;
type DeathCause = typeof DEATH_CAUSES[number];

const deathSchema = z.object({
  deathDate: z.string().min(1),
  deathCause: z.enum(DEATH_CAUSES).optional(),
  deathCauseOther: z.string().optional(),
});
type DeathForm = z.infer<typeof deathSchema>;

const editSchema = z.object({
  name: z.string().optional(),
  customTag: z.string().optional(),
  species: z.string().optional(),
  breed: z.string().optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  status: z.enum(["active", "sold", "deceased"]).optional(),
  dateOfBirth: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.coerce.number().positive().optional().or(z.literal("")),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;


export function AnimalDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { activeFarmId, currency } = useStore();
  const isEn = i18n.language === "en";
  const qc = useQueryClient();

  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editOpen, setEditOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [editingMedical, setEditingMedical] = useState<any | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: animal, isLoading, refetch } = useGetAnimal(activeFarmId || '', id || '', {
    query: { enabled: !!(activeFarmId && id) }
  });

  const { data: weights } = useListWeightRecords(activeFarmId || '', id || '', {
    query: { enabled: !!(activeFarmId && id) }
  });

  const updateAnimal = useUpdateAnimal();
  const createWeightRecord = useCreateWeightRecord();
  const createMedicalRecord = useCreateMedicalRecord();

  const [milkOpen, setMilkOpen] = useState(false);
  const [editingMilk, setEditingMilk] = useState<any | null>(null);
  const [pregnancyOpen, setPregnancyOpen] = useState(false);
  const [deathOpen, setDeathOpen] = useState(false);

  const { data: milkRecords = [], refetch: refetchMilk } = useQuery<any[]>({
    queryKey: [`/api/farms/${activeFarmId}/animals/${id}/milk`],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals/${id}/milk`);
      if (!res.ok) throw new Error("fetch milk failed");
      return res.json();
    },
    enabled: !!(activeFarmId && id && animal?.species === "cattle"),
  });

  const milkForm = useForm<MilkForm>({
    resolver: zodResolver(milkSchema),
    defaultValues: { amountLiters: undefined as any, recordedAt: new Date().toISOString().split("T")[0], session: undefined, notes: "" },
  });

  const createMilkRecord = useMutation({
    mutationFn: async (data: MilkForm) => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals/${id}/milk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("create milk failed");
      return res.json();
    },
    onSuccess: () => { setMilkOpen(false); milkForm.reset(); refetchMilk(); },
  });

  const updateMilkRecord = useMutation({
    mutationFn: async ({ recordId, data }: { recordId: string; data: MilkForm }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals/${id}/milk/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("update milk failed");
      return res.json();
    },
    onSuccess: () => { setMilkOpen(false); setEditingMilk(null); milkForm.reset(); refetchMilk(); },
  });

  const openEditMilk = (record: any) => {
    setEditingMilk(record);
    milkForm.reset({
      amountLiters: Number(record.amountLiters),
      recordedAt: record.recordedAt,
      session: record.session || undefined,
      notes: record.notes || "",
    });
    setMilkOpen(true);
  };

  const onMilkSubmit = (data: MilkForm) => {
    if (editingMilk) {
      updateMilkRecord.mutate({ recordId: editingMilk.id, data });
    } else {
      createMilkRecord.mutate(data);
    }
  };

  const pregnancyForm = useForm<PregnancyForm>({
    resolver: zodResolver(pregnancySchema),
    defaultValues: { pregnancyStartDate: "", pregnancyDueDate: "" },
  });

  const setPregnancy = useMutation({
    mutationFn: async (payload: { isPregnant: boolean; pregnancyStartDate?: string | null; pregnancyDueDate?: string | null }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals/${id}/pregnancy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("update pregnancy failed");
      return res.json();
    },
    onSuccess: () => { setPregnancyOpen(false); pregnancyForm.reset(); refetch(); },
  });

  const onPregnancySubmit = (data: PregnancyForm) => {
    setPregnancy.mutate({ isPregnant: true, pregnancyStartDate: data.pregnancyStartDate, pregnancyDueDate: data.pregnancyDueDate });
  };

  const clearPregnancy = () => {
    setPregnancy.mutate({ isPregnant: false, pregnancyStartDate: null, pregnancyDueDate: null });
  };

  const deathForm = useForm<DeathForm>({
    resolver: zodResolver(deathSchema),
    defaultValues: { deathDate: new Date().toISOString().split("T")[0], deathCause: undefined, deathCauseOther: "" },
  });
  const watchedDeathCause = deathForm.watch("deathCause");

  const recordDeath = useMutation({
    mutationFn: async (payload: { deathDate: string; deathCause?: string }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals/${id}/death`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("record death failed");
      return res.json();
    },
    onSuccess: () => {
      setDeathOpen(false);
      deathForm.reset();
      refetch();
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/animals`] });
    },
  });

  const onDeathSubmit = (data: DeathForm) => {
    const cause = data.deathCause === "other" ? (data.deathCauseOther || "other") : data.deathCause;
    recordDeath.mutate({ deathDate: data.deathDate, deathCause: cause });
  };

  const DEATH_CAUSE_LABELS: Record<string, { es: string; en: string }> = {
    disease:        { es: "Enfermedad", en: "Disease" },
    accident:       { es: "Accidente", en: "Accident" },
    old_age:        { es: "Vejez", en: "Old age" },
    difficult_birth:{ es: "Parto difícil", en: "Difficult birth" },
    predator:       { es: "Depredador", en: "Predator" },
    unknown:        { es: "Desconocida", en: "Unknown" },
    other:          { es: "Otra", en: "Other" },
  };

  const updateMedicalRecord = useMutation({
    mutationFn: async ({ recordId, data }: { recordId: string; data: any }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals/${id}/medical/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("update failed");
      return res.json();
    },
  });

  const deleteAnimal = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/animals`] });
      setLocation("/animals");
    },
  });

  const weightForm = useForm<WeightForm>({
    resolver: zodResolver(weightSchema),
    defaultValues: { weightKg: undefined as any, recordedAt: new Date().toISOString().split("T")[0], notes: "" },
  });

  const onWeightSubmit = (data: WeightForm) => {
    if (!activeFarmId || !id) return;
    createWeightRecord.mutate(
      { farmId: activeFarmId, animalId: id, data: { weightKg: data.weightKg, recordedAt: data.recordedAt, notes: data.notes } },
      {
        onSuccess: () => {
          setWeightOpen(false);
          weightForm.reset({ weightKg: undefined as any, recordedAt: new Date().toISOString().split("T")[0], notes: "" });
          refetch();
          qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/animals/${id}/weights`] });
        }
      }
    );
  };

  const medicalForm = useForm<MedicalForm>({
    resolver: zodResolver(medicalSchema),
    defaultValues: { recordType: "checkup", title: "", recordDate: new Date().toISOString().split("T")[0], description: "", vetName: "", costCop: "", nextDueDate: "" },
  });

  const openEditMedical = (record: any) => {
    setEditingMedical(record);
    medicalForm.reset({
      recordType: record.recordType,
      title: record.title,
      recordDate: record.recordDate ? record.recordDate.split("T")[0] : new Date().toISOString().split("T")[0],
      description: record.description ?? "",
      vetName: record.vetName ?? "",
      costCop: record.costCop ? String(record.costCop) : "",
      nextDueDate: record.nextDueDate ? record.nextDueDate.split("T")[0] : "",
    });
    setMedicalOpen(true);
  };

  const onMedicalSubmit = (data: MedicalForm) => {
    if (!activeFarmId || !id) return;
    const payload = { ...data, costCop: data.costCop !== "" && data.costCop != null ? Number(data.costCop) : undefined };
    const resetDefaults = { recordType: "checkup" as const, title: "", recordDate: new Date().toISOString().split("T")[0], description: "", vetName: "", costCop: "" as any, nextDueDate: "" };

    if (editingMedical) {
      updateMedicalRecord.mutate(
        { recordId: editingMedical.id, data: payload },
        {
          onSuccess: () => {
            setMedicalOpen(false);
            setEditingMedical(null);
            medicalForm.reset(resetDefaults);
            refetch();
          }
        }
      );
    } else {
      createMedicalRecord.mutate(
        { farmId: activeFarmId, animalId: id, data: payload as any },
        {
          onSuccess: () => {
            setMedicalOpen(false);
            medicalForm.reset(resetDefaults);
            refetch();
          }
        }
      );
    }
  };

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: animal ? {
      name: animal.name ?? "",
      customTag: animal.customTag ?? "",
      species: animal.species ?? "cattle",
      breed: animal.breed ?? "",
      sex: (animal.sex as any) ?? "unknown",
      status: (animal.status as any) ?? "active",
      dateOfBirth: animal.dateOfBirth ? animal.dateOfBirth.split("T")[0] : "",
      purchaseDate: (animal as any).purchaseDate ? (animal as any).purchaseDate.split("T")[0] : "",
      purchasePrice: (animal as any).purchasePrice ? String((animal as any).purchasePrice) : "",
      notes: (animal as any).notes ?? "",
      photoUrl: animal.photoUrl ?? "",
    } : {},
  });

  const watchedSpecies = form.watch("species") ?? "cattle";

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoPreview(dataUrl);
      form.setValue("photoUrl", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (data: EditForm) => {
    if (!activeFarmId || !id) return;
    const payload = {
      ...data,
      purchasePrice: data.purchasePrice !== "" && data.purchasePrice != null ? Number(data.purchasePrice) : null,
      purchaseDate: data.purchaseDate || null,
    };
    updateAnimal.mutate(
      { farmId: activeFarmId, animalId: id, data: payload as any },
      {
        onSuccess: () => {
          setEditOpen(false);
          setPhotoPreview(null);
          refetch();
          qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/animals`] });
        }
      }
    );
  };

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 hover-elevate"
            onClick={() => { setPhotoPreview(null); setEditOpen(true); }}
          >
            <Edit className="h-4 w-4 mr-2" /> {t('animals.edit')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/8 hover-elevate"
            onClick={() => setDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Deceased banner */}
      {(animal as any).status === "deceased" && (
        <div className="rounded-2xl bg-stone-100 border border-stone-300 p-4 flex items-start gap-3">
          <Skull className="h-5 w-5 text-stone-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-stone-700">
              {isEn ? "Deceased" : "Fallecida/o"}
            </p>
            <p className="text-sm text-stone-500 mt-0.5">
              {(animal as any).deathDate
                ? `${isEn ? "Date" : "Fecha"}: ${format(parseISO((animal as any).deathDate), "d MMMM yyyy", { locale: isEn ? undefined : es })}`
                : (isEn ? "Date not recorded" : "Fecha no registrada")}
              {(animal as any).deathCause
                ? ` · ${isEn ? "Cause" : "Causa"}: ${(animal as any).deathCause}`
                : ""}
            </p>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(false); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">{t('animals.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('animals.confirmDeleteDesc')}</p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirm(false)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              disabled={deleteAnimal.isPending}
              onClick={() => deleteAnimal.mutate()}
            >
              {t('common.delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setPhotoPreview(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">{t('animals.edit')}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-1">

              {/* Species grid */}
              <FormField control={form.control} name="species" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">{t('animals.species')}</FormLabel>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {ALL_SPECIES.map(sp => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => field.onChange(sp)}
                        className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border text-xs font-medium transition-all ${
                          field.value === sp
                            ? "bg-secondary/10 border-secondary text-secondary shadow-sm"
                            : "bg-muted/30 border-border/40 text-muted-foreground hover:border-secondary/40"
                        }`}
                      >
                        <span className="text-2xl">{SPECIES_EMOJI[sp]}</span>
                        <span>{t(`animals.sp.${sp}`)}</span>
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />

              {/* Photo */}
              <div>
                <label className="text-sm font-semibold mb-2 block">
                  {t('animals.photo')} <span className="text-muted-foreground font-normal">({t('common.optional')})</span>
                </label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                {(photoPreview || animal.photoUrl) ? (
                  <div className="relative rounded-xl overflow-hidden h-36 bg-muted/30 border border-border/40">
                    <img src={photoPreview || animal.photoUrl!} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setPhotoPreview(null); form.setValue("photoUrl", ""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Camera className="h-3 w-3" /> {isEn ? "Change" : "Cambiar"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-36 rounded-xl border-2 border-dashed border-border/50 hover:border-secondary/50 bg-primary/5 hover:bg-primary/10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-secondary transition-all group"
                  >
                    <span className="text-5xl opacity-50 group-hover:opacity-75 transition-opacity select-none">
                      {SPECIES_EMOJI[animal.species] ?? "🐾"}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <Upload className="h-3.5 w-3.5" />
                      {t('animals.photoUpload')}
                    </span>
                  </button>
                )}
              </div>

              {/* Tag + Name */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="customTag" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID / Tag</FormLabel>
                    <FormControl><Input {...field} className="rounded-xl" placeholder="EJ: BOV-001" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.name')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl><Input {...field} className="rounded-xl" placeholder="EJ: Reina" /></FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Breed + Sex */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="breed" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.breed')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl><Input {...field} className="rounded-xl" placeholder="EJ: Brahman" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="sex" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{isEn ? "Sex" : "Sexo"}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="male">{isEn ? "Male" : "Macho"}</option>
                        <option value="female">{isEn ? "Female" : "Hembra"}</option>
                        <option value="unknown">{isEn ? "Unknown" : "Desconocido"}</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Status + Birth */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.status')}</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="active">{isEn ? "Active" : "Activo"}</option>
                        <option value="sold">{isEn ? "Sold" : "Vendido"}</option>
                        <option value="deceased">{isEn ? "Deceased" : "Fallecido"}</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.birth')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl><Input type="date" {...field} className="rounded-xl" /></FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Purchase Date + Price */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.purchaseDate')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl><Input type="date" {...field} className="rounded-xl" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.purchasePrice')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={currencyInputDisplay(String(field.value ?? ""), currency)}
                          onChange={e => field.onChange(currencyInputRaw(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="rounded-xl pr-14"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">{currency}</span>
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Notes */}
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{isEn ? "Notes" : "Notas"} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      placeholder={isEn ? "Any observations..." : "Observaciones..."}
                    />
                  </FormControl>
                </FormItem>
              )} />

              <Button type="submit" disabled={updateAnimal.isPending} className="w-full rounded-xl py-6 bg-primary hover:bg-primary/90">
                {updateAnimal.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Weight recording dialog */}
      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary flex items-center gap-2">
              <Scale className="h-5 w-5" /> {t('animals.recordWeight')}
            </DialogTitle>
          </DialogHeader>
          <Form {...weightForm}>
            <form onSubmit={weightForm.handleSubmit(onWeightSubmit)} className="space-y-4 pt-1">
              <FormField control={weightForm.control} name="weightKg" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">{isEn ? "Weight" : "Peso"}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                        className="rounded-xl pr-10 text-lg"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">kg</span>
                    </div>
                  </FormControl>
                </FormItem>
              )} />
              <FormField control={weightForm.control} name="recordedAt" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">{isEn ? "Date" : "Fecha"}</FormLabel>
                  <FormControl><Input type="date" {...field} className="rounded-xl" /></FormControl>
                </FormItem>
              )} />
              <FormField control={weightForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">{isEn ? "Notes" : "Notas"} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={2}
                      className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      placeholder={isEn ? "e.g. After vaccination..." : "Ej: Después de vacunación..."}
                    />
                  </FormControl>
                </FormItem>
              )} />
              <Button type="submit" disabled={createWeightRecord.isPending} className="w-full rounded-xl py-6 bg-primary hover:bg-primary/90">
                {createWeightRecord.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Medical record dialog */}
      <Dialog open={medicalOpen} onOpenChange={(v) => { setMedicalOpen(v); if (!v) setEditingMedical(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary flex items-center gap-2">
              <Syringe className="h-5 w-5" /> {editingMedical ? (isEn ? "Edit Record" : "Editar Registro") : t('animals.addMedical')}
            </DialogTitle>
          </DialogHeader>
          <Form {...medicalForm}>
            <form onSubmit={medicalForm.handleSubmit(onMedicalSubmit)} className="space-y-4 pt-1">

              {/* Record type */}
              <FormField control={medicalForm.control} name="recordType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">{isEn ? "Type" : "Tipo"}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-3 gap-2">
                      {RECORD_TYPES.map(rt => {
                        const labels: Record<string, [string, string]> = {
                          vaccination: ["💉", isEn ? "Vaccination" : "Vacunación"],
                          treatment: ["💊", isEn ? "Treatment" : "Tratamiento"],
                          checkup: ["🩺", isEn ? "Checkup" : "Revisión"],
                          surgery: ["🏥", isEn ? "Surgery" : "Cirugía"],
                          deworming: ["🐛", isEn ? "Deworming" : "Desparasitación"],
                          other: ["📋", isEn ? "Other" : "Otro"],
                        };
                        const [icon, label] = labels[rt];
                        return (
                          <button
                            key={rt}
                            type="button"
                            onClick={() => field.onChange(rt)}
                            className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-medium transition-all ${
                              field.value === rt
                                ? "bg-primary/10 border-primary text-primary shadow-sm"
                                : "bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            <span className="text-xl">{icon}</span>
                            <span className="text-center leading-tight">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                </FormItem>
              )} />

              {/* Title */}
              <FormField control={medicalForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">{isEn ? "Title" : "Título"}</FormLabel>
                  <FormControl><Input {...field} className="rounded-xl" placeholder={isEn ? "e.g. Aftosa vaccine" : "Ej: Vacuna aftosa"} /></FormControl>
                </FormItem>
              )} />

              {/* Date + Next due */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={medicalForm.control} name="recordDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">{isEn ? "Date" : "Fecha"}</FormLabel>
                    <FormControl><Input type="date" {...field} className="rounded-xl" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={medicalForm.control} name="nextDueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">{isEn ? "Next due" : "Próxima"} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl><Input type="date" {...field} className="rounded-xl" /></FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Vet + Cost */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={medicalForm.control} name="vetName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">{isEn ? "Vet name" : "Veterinario"} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl><Input {...field} className="rounded-xl" placeholder="Dr. López" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={medicalForm.control} name="costCop" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">{isEn ? "Cost" : "Costo"} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={currencyInputDisplay(String(field.value ?? ""), currency)}
                          onChange={e => field.onChange(currencyInputRaw(e.target.value))}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          className="rounded-xl pr-14"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">{currency}</span>
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Description */}
              <FormField control={medicalForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold">{isEn ? "Notes" : "Notas"} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={2}
                      className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      placeholder={isEn ? "Additional observations..." : "Observaciones adicionales..."}
                    />
                  </FormControl>
                </FormItem>
              )} />

              <Button type="submit" disabled={createMedicalRecord.isPending || updateMedicalRecord.isPending} className="w-full rounded-xl py-6 bg-primary hover:bg-primary/90">
                {(createMedicalRecord.isPending || updateMedicalRecord.isPending) ? t('common.saving') : t('common.save')}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Milk record dialog */}
      {animal.species === "cattle" && (
        <Dialog open={milkOpen} onOpenChange={(v) => { setMilkOpen(v); if (!v) { setEditingMilk(null); milkForm.reset(); } }}>
          <DialogContent className="sm:max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary flex items-center gap-2">
                <Droplets className="h-5 w-5 text-sky-500" />
                {editingMilk ? (isEn ? "Edit Record" : "Editar Registro") : t('animals.milk.logTitle')}
              </DialogTitle>
            </DialogHeader>
            <Form {...milkForm}>
              <form onSubmit={milkForm.handleSubmit(onMilkSubmit)} className="space-y-4 pt-1">
                <FormField control={milkForm.control} name="amountLiters" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t('animals.milk.amount')}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" min="0" placeholder="e.g. 12.5" className="rounded-xl" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={milkForm.control} name="recordedAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{isEn ? "Date" : "Fecha"}</FormLabel>
                    <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={milkForm.control} name="session" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t('animals.milk.session')} <span className="text-muted-foreground font-normal">({isEn ? "optional" : "opcional"})</span></FormLabel>
                    <FormControl>
                      <select {...field} value={field.value || ""} onChange={e => field.onChange(e.target.value || undefined)}
                        className="w-full border border-input bg-background rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option value="">{isEn ? "— Select —" : "— Seleccionar —"}</option>
                        <option value="morning">{t('animals.milk.session.morning')}</option>
                        <option value="afternoon">{t('animals.milk.session.afternoon')}</option>
                        <option value="evening">{t('animals.milk.session.evening')}</option>
                        <option value="full_day">{t('animals.milk.session.full_day')}</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={milkForm.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{t('animals.milk.notes')} <span className="text-muted-foreground font-normal">({isEn ? "optional" : "opcional"})</span></FormLabel>
                    <FormControl><Input placeholder="..." className="rounded-xl" {...field} /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" disabled={createMilkRecord.isPending || updateMilkRecord.isPending} className="w-full rounded-xl py-6 bg-primary hover:bg-primary/90">
                  {(createMilkRecord.isPending || updateMilkRecord.isPending) ? t('common.saving') : t('common.save')}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="overflow-hidden rounded-2xl border-none shadow-md bg-card">
            <div className="h-48 bg-primary/10 flex items-center justify-center">
              {animal.photoUrl ? (
                <>
                  <img
                    src={animal.photoUrl}
                    alt="Animal"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      (e.currentTarget.nextElementSibling as HTMLElement)?.removeAttribute("hidden");
                    }}
                  />
                  <span className="text-6xl" hidden>{SPECIES_EMOJI[animal.species] ?? "🐾"}</span>
                </>
              ) : (
                <span className="text-6xl">{SPECIES_EMOJI[animal.species] ?? "🐾"}</span>
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
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('animals.purchaseDate')}</p>
                <p className="font-medium text-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary/50" />
                  {(animal as any).purchaseDate
                    ? format(new Date((animal as any).purchaseDate), 'dd MMM yyyy', { locale: isEn ? undefined : es })
                    : <span className="text-muted-foreground/60 italic font-normal text-sm">{t('animals.notPurchased')}</span>}
                </p>
              </div>
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t('animals.purchasePrice')}</p>
                <p className="font-medium text-foreground">
                  {(animal as any).purchasePrice
                    ? formatCurrency(Number((animal as any).purchasePrice), currency)
                    : <span className="text-muted-foreground/60 italic font-normal text-sm">{t('animals.notPurchased')}</span>}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="md:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-transparent md:bg-card/50 p-0 md:p-1 rounded-none md:rounded-xl mb-6 flex justify-start gap-2 overflow-x-auto w-[calc(100%+3rem)] md:w-full -mx-6 pl-6 pr-2 md:mx-0 md:px-1 md:space-x-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <TabsTrigger value="overview" className="rounded-lg border border-border/50 md:border-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shrink-0 md:flex-1">
                {t('animals.tab.overview')}
              </TabsTrigger>
              <TabsTrigger value="weight" className="rounded-lg border border-border/50 md:border-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shrink-0 md:flex-1">
                {t('animals.tab.weight')}
              </TabsTrigger>
              <TabsTrigger value="medical" className="rounded-lg border border-border/50 md:border-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shrink-0 md:flex-1">
                {t('animals.tab.medical')}
              </TabsTrigger>
              <TabsTrigger value="lineage" className="rounded-lg border border-border/50 md:border-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shrink-0 md:flex-1 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                {t('animals.tab.lineage')}
              </TabsTrigger>
              {animal.species === "cattle" && (
                <TabsTrigger value="milk" className="rounded-lg border border-border/50 md:border-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary shrink-0 md:flex-1 flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5" />
                  {t('animals.tab.milk')}
                </TabsTrigger>
              )}
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

              {hasLifecycle(animal as unknown as LifecycleAnimal) && activeFarmId && (() => {
                const la = animal as unknown as LifecycleAnimal;
                const stage = deriveLifecycleStage(la);
                return (
                  <Card className="rounded-2xl border shadow-sm border-border/40 bg-card p-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                      {isEn ? "Cycle" : "Ciclo"}
                    </p>
                    <LifecycleActionCard
                      animal={{ ...(animal as any), id: id! }}
                      farmId={activeFarmId}
                      onUpdate={() => refetch()}
                    />
                    {(stage === "can_breed") && (
                      <MarkInHeatCard
                        animalId={id!}
                        farmId={activeFarmId}
                        onUpdate={() => refetch()}
                      />
                    )}
                    {(stage === "can_breed" || stage === "in_heat") && (
                      <MarkPregnantCard
                        animalId={id!}
                        farmId={activeFarmId}
                        species={animal.species}
                        onUpdate={() => refetch()}
                      />
                    )}
                  </Card>
                );
              })()}

              {/* ── Death card — all animals ── */}
              {(() => {
                const isDeceased = (animal as any).status === "deceased";
                const deathDateStr = (animal as any).deathDate as string | null;
                const deathCauseStr = (animal as any).deathCause as string | null;
                const deathDateFmt = deathDateStr
                  ? format(parseISO(deathDateStr), isEn ? "MMMM d, yyyy" : "d 'de' MMMM yyyy", { locale: isEn ? undefined : es })
                  : null;

                return (
                  <Card className={`p-5 rounded-2xl border shadow-sm ${isDeceased ? "border-stone-300 bg-gradient-to-br from-stone-50/80 to-stone-100/40" : "border-border/40 bg-card"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isDeceased ? "bg-stone-200 text-stone-600" : "bg-muted/50 text-muted-foreground"}`}>
                          <Skull className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {isEn ? "Death" : "Muerte"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isDeceased
                              ? (isEn ? "Deceased" : "Fallecida/o")
                              : (isEn ? "No death recorded" : "Sin muerte registrada")}
                          </p>
                        </div>
                      </div>
                      {!isDeceased && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            deathForm.reset({ deathDate: new Date().toISOString().split("T")[0], deathCause: undefined, deathCauseOther: "" });
                            setDeathOpen(true);
                          }}
                          className="rounded-xl h-8 px-3 text-xs border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          <Skull className="h-3.5 w-3.5 mr-1" />
                          {isEn ? "Record death" : "Registrar muerte"}
                        </Button>
                      )}
                    </div>

                    {isDeceased && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="bg-stone-100/70 rounded-xl px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-0.5">
                            {isEn ? "Date" : "Fecha"}
                          </p>
                          <p className="text-sm font-semibold text-stone-700">
                            {deathDateFmt ?? (isEn ? "Not recorded" : "Sin registrar")}
                          </p>
                        </div>
                        <div className="bg-stone-100/70 rounded-xl px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-0.5">
                            {isEn ? "Cause" : "Causa"}
                          </p>
                          <p className="text-sm font-semibold text-stone-700 capitalize">
                            {deathCauseStr
                              ? (DEATH_CAUSE_LABELS[deathCauseStr as DeathCause]
                                ? (isEn ? DEATH_CAUSE_LABELS[deathCauseStr as DeathCause]!.en : DEATH_CAUSE_LABELS[deathCauseStr as DeathCause]!.es)
                                : deathCauseStr)
                              : (isEn ? "Not recorded" : "Sin registrar")}
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })()}

            </TabsContent>

            <TabsContent value="weight" className="mt-0">
              <Card className="p-6 rounded-2xl border-border/50 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-serif text-primary">{t('animals.weightEvolution')}</h3>
                  <Button size="sm" onClick={() => setWeightOpen(true)} className="rounded-xl bg-primary hover:bg-primary/90 hover-elevate">
                    <Scale className="h-3.5 w-3.5 mr-1.5" /> {t('animals.recordWeight')}
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
                  <Button size="sm" onClick={() => setMedicalOpen(true)} className="rounded-xl bg-primary hover:bg-primary/90 hover-elevate">
                    <Syringe className="h-3.5 w-3.5 mr-1.5" /> {t('animals.addMedical')}
                  </Button>
                </div>
                {animal.medicalRecords && animal.medicalRecords.length > 0 ? (
                  <div className="space-y-4">
                    {[...animal.medicalRecords].sort((a, b) => {
                      const ad = (a as any).nextDueDate, bd = (b as any).nextDueDate;
                      if (ad && bd) return ad < bd ? -1 : ad > bd ? 1 : 0;
                      if (ad) return -1;
                      if (bd) return 1;
                      return 0;
                    }).map((record) => {
                      const nextDue = (record as any).nextDueDate as string | undefined;
                      const daysUntil = nextDue ? differenceInDays(new Date(nextDue + "T12:00:00"), new Date()) : null;
                      const isUrgent = daysUntil !== null && daysUntil <= 14;
                      return (
                      <div key={record.id} className={`p-4 rounded-xl border flex items-start gap-4 ${isUrgent ? "border-amber-300/70 bg-amber-50/40" : "border-border/40 bg-black/[0.02]"}`}>
                        <div className={`p-3 rounded-lg shadow-sm flex-shrink-0 ${isUrgent ? "bg-amber-100" : "bg-white"}`}>
                          <Syringe className={`h-5 w-5 ${isUrgent ? "text-amber-600" : "text-accent"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-primary">{record.title}</h4>
                          {record.description && <p className="text-sm text-muted-foreground mt-1">{record.description}</p>}
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground font-medium flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3"/> {format(new Date(record.recordDate + "T12:00:00"), 'dd MMM yyyy', isEn ? {} : { locale: es })}
                            </span>
                            {record.vetName && <span>• {record.vetName}</span>}
                            {(record as any).costCop && <span>• {formatCurrency(Number((record as any).costCop), currency)}</span>}
                          </div>
                          {nextDue && (
                            <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${isUrgent ? "bg-amber-500 text-white" : "bg-secondary/10 text-secondary"}`}>
                              <CalendarClock className="h-3 w-3" />
                              {isEn ? "Next due:" : "Próximo:"} {format(new Date(nextDue + "T12:00:00"), isEn ? "MMM d, yyyy" : "d 'de' MMM yyyy", isEn ? {} : { locale: es })}
                              {daysUntil !== null && daysUntil <= 14 && (
                                <span className="ml-1 opacity-90">({daysUntil === 0 ? (isEn ? "today" : "hoy") : daysUntil === 1 ? (isEn ? "tomorrow" : "mañana") : isEn ? `in ${daysUntil} days` : `en ${daysUntil} días`})</span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditMedical(record)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0 mt-0.5"
                          title={isEn ? "Edit record" : "Editar registro"}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-16 text-center text-muted-foreground flex flex-col items-center">
                    <Activity className="h-12 w-12 text-border mb-4" />
                    <p>{t('animals.noMedicalRecords')}</p>
                  </div>
                )}

                {/* Scheduled Calendar Events */}
                {(() => {
                  const calEvents = animal.linkedCalendarEvents;
                  if (!calEvents || calEvents.length === 0) return null;
                  return (
                    <div className="mt-8 pt-6 border-t border-border/40">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {isEn ? "Scheduled on Calendar" : "Programado en Calendario"}
                      </h4>
                      <div className="space-y-2">
                        {calEvents.map(evt => (
                          <div key={evt.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-black/[0.02]">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-primary truncate">{evt.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(evt.startDate + "T12:00:00"), isEn ? "MMM d, yyyy" : "d 'de' MMM yyyy", isEn ? {} : { locale: es })}
                                {evt.endDate && evt.endDate !== evt.startDate && ` → ${format(new Date(evt.endDate + "T12:00:00"), isEn ? "MMM d" : "d MMM", isEn ? {} : { locale: es })}`}
                                {evt.assignedTo && ` · ${evt.assignedTo}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setLocation(`/calendar?date=${evt.startDate}`)}
                              className="text-xs text-primary hover:underline flex-shrink-0 ml-4 font-medium"
                            >
                              {isEn ? "View" : "Ver"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </TabsContent>
            <TabsContent value="lineage" className="mt-0">
              <AnimalLineage
                animal={animal as any}
                farmId={activeFarmId!}
                onRefresh={() => refetch()}
              />
            </TabsContent>

            {animal.species === "cattle" && (
              <TabsContent value="milk" className="mt-0 space-y-6">
                {/* Stats row */}
                {(() => {
                  const today = new Date().toISOString().split("T")[0];
                  const todayTotal = milkRecords.filter(r => r.recordedAt === today).reduce((s, r) => s + Number(r.amountLiters), 0);
                  const last30 = milkRecords.filter(r => r.recordedAt >= new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);
                  const last30Total = last30.reduce((s, r) => s + Number(r.amountLiters), 0);
                  const uniqueDays30 = new Set(last30.map(r => r.recordedAt)).size;
                  const dailyAvg = uniqueDays30 > 0 ? (last30Total / uniqueDays30).toFixed(1) : "0";

                  const chartData = Object.entries(
                    milkRecords.slice(0, 60).reduce((acc: Record<string, number>, r) => {
                      acc[r.recordedAt] = (acc[r.recordedAt] || 0) + Number(r.amountLiters);
                      return acc;
                    }, {})
                  ).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({
                    date: format(new Date(date + "T12:00:00"), "dd/MM"),
                    total,
                  }));

                  return (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <Card className="p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-card shadow-sm border-border/40">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('animals.milk.totalToday')}</p>
                          <p className="text-3xl font-serif font-bold text-primary">{todayTotal.toFixed(1)}<span className="text-base font-normal text-muted-foreground ml-1">L</span></p>
                        </Card>
                        <Card className="p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-card shadow-sm border-border/40">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('animals.milk.avgDaily')}</p>
                          <p className="text-3xl font-serif font-bold text-primary">{dailyAvg}<span className="text-base font-normal text-muted-foreground ml-1">L</span></p>
                        </Card>
                        <Card className="p-5 rounded-2xl bg-gradient-to-br from-sky-50 to-card shadow-sm border-border/40">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('animals.milk.last30')}</p>
                          <p className="text-3xl font-serif font-bold text-primary">{last30Total.toFixed(1)}<span className="text-base font-normal text-muted-foreground ml-1">L</span></p>
                        </Card>
                      </div>

                      {chartData.length > 0 && (
                        <Card className="p-6 rounded-2xl shadow-sm border-border/40">
                          <h3 className="font-semibold text-primary mb-4 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />{t('animals.milk.chart')}
                          </h3>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} unit="L" />
                              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} L`, ""]} />
                              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </Card>
                      )}
                    </>
                  );
                })()}

                {/* Records list + Log button */}
                <Card className="p-6 rounded-2xl shadow-sm border-border/40">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-primary flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-sky-500" />{isEn ? "Milk Log" : "Registros"}
                    </h3>
                    <Button size="sm" onClick={() => { setEditingMilk(null); milkForm.reset({ amountLiters: undefined as any, recordedAt: new Date().toISOString().split("T")[0], session: undefined, notes: "" }); setMilkOpen(true); }} className="rounded-xl bg-primary hover:bg-primary/90 gap-1.5">
                      <Plus className="h-4 w-4" />{t('animals.milk.logBtn')}
                    </Button>
                  </div>
                  {milkRecords.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center text-muted-foreground">
                      <Droplets className="h-10 w-10 text-border mb-3" />
                      <p className="text-sm">{t('animals.milk.noRecords')}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {milkRecords.map((record: any) => {
                        const sessionLabel: Record<string, string> = {
                          morning: t('animals.milk.session.morning'),
                          afternoon: t('animals.milk.session.afternoon'),
                          evening: t('animals.milk.session.evening'),
                          full_day: t('animals.milk.session.full_day'),
                        };
                        return (
                          <div key={record.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-black/[0.01] hover:bg-black/[0.03] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-sky-50 rounded-lg">
                                <Droplets className="h-4 w-4 text-sky-500" />
                              </div>
                              <div>
                                <p className="font-semibold text-primary text-sm">{Number(record.amountLiters).toFixed(1)} L</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {format(new Date(record.recordedAt + "T12:00:00"), isEn ? "MMM dd, yyyy" : "dd MMM yyyy", { locale: isEn ? undefined : es })}
                                  {record.session && <> · {sessionLabel[record.session] || record.session}</>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {record.notes && <p className="text-xs text-muted-foreground max-w-[120px] truncate hidden sm:block">{record.notes}</p>}
                              <button type="button" onClick={() => openEditMilk(record)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Pregnancy dialog */}
      <Dialog open={pregnancyOpen} onOpenChange={(v) => { setPregnancyOpen(v); if (!v) pregnancyForm.reset(); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary flex items-center gap-2">
              <Baby className="h-5 w-5 text-rose-500" />
              {isEn ? "Mark as Pregnant" : "Registrar Preñez"}
            </DialogTitle>
          </DialogHeader>
          <Form {...pregnancyForm}>
            <form onSubmit={pregnancyForm.handleSubmit(onPregnancySubmit)} className="space-y-4 pt-1">
              <FormField
                control={pregnancyForm.control}
                name="pregnancyStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {isEn ? "Confirmation date" : "Fecha de confirmación"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="rounded-xl"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (e.target.value) {
                            const due = addDays(parseISO(e.target.value), CATTLE_GESTATION_DAYS)
                              .toISOString().split("T")[0];
                            pregnancyForm.setValue("pregnancyDueDate", due!);
                          }
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {isEn ? "When was the pregnancy confirmed?" : "¿Cuándo se confirmó la preñez?"}
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={pregnancyForm.control}
                name="pregnancyDueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {isEn ? "Expected due date" : "Fecha probable de parto"}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" className="rounded-xl" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {isEn
                        ? `Auto-calculated at ${CATTLE_GESTATION_DAYS} days. Adjust if needed.`
                        : `Calculada automáticamente a ${CATTLE_GESTATION_DAYS} días. Ajusta si es necesario.`}
                    </p>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={setPregnancy.isPending}
                className="w-full rounded-xl py-6 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {setPregnancy.isPending
                  ? (isEn ? "Saving..." : "Guardando...")
                  : (isEn ? "Confirm pregnancy" : "Confirmar preñez")}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Death dialog */}
      <Dialog open={deathOpen} onOpenChange={(v) => { setDeathOpen(v); if (!v) deathForm.reset(); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary flex items-center gap-2">
              <Skull className="h-5 w-5 text-stone-500" />
              {isEn ? "Record death" : "Registrar muerte"}
            </DialogTitle>
          </DialogHeader>
          <Form {...deathForm}>
            <form onSubmit={deathForm.handleSubmit(onDeathSubmit)} className="space-y-4 pt-1">
              <FormField
                control={deathForm.control}
                name="deathDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {isEn ? "Date of death" : "Fecha de muerte"}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" className="rounded-xl" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={deathForm.control}
                name="deathCause"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {isEn ? "Cause of death" : "Causa de muerte"}{" "}
                      <span className="text-muted-foreground font-normal text-xs">({isEn ? "optional" : "opcional"})</span>
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {DEATH_CAUSES.map((cause) => (
                        <button
                          key={cause}
                          type="button"
                          onClick={() => field.onChange(field.value === cause ? undefined : cause)}
                          className={`px-3 py-2 rounded-xl border text-sm font-medium transition-all text-left ${
                            field.value === cause
                              ? "bg-stone-700 text-white border-stone-700 shadow-sm"
                              : "bg-muted/30 border-border/40 text-muted-foreground hover:border-stone-400 hover:text-stone-700"
                          }`}
                        >
                          {isEn ? DEATH_CAUSE_LABELS[cause]?.en : DEATH_CAUSE_LABELS[cause]?.es}
                        </button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />

              {watchedDeathCause === "other" && (
                <FormField
                  control={deathForm.control}
                  name="deathCauseOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {isEn ? "Specify cause" : "Especifica la causa"}
                      </FormLabel>
                      <FormControl>
                        <Input className="rounded-xl" placeholder={isEn ? "Describe the cause..." : "Describe la causa..."} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <div className="pt-1 space-y-2">
                <Button
                  type="submit"
                  disabled={recordDeath.isPending}
                  className="w-full rounded-xl py-6 bg-stone-700 hover:bg-stone-800 text-white"
                >
                  {recordDeath.isPending
                    ? (isEn ? "Saving..." : "Guardando...")
                    : (isEn ? "Confirm death" : "Confirmar muerte")}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {isEn
                    ? "The animal will be marked as deceased. This can be undone by editing its status."
                    : "El animal será marcado como fallecido. Puedes revertirlo editando su estado."}
                </p>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
