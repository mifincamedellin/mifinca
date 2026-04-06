import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetAnimal, useListWeightRecords, useUpdateAnimal, useCreateWeightRecord, useCreateMedicalRecord } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { ArrowLeft, Edit, Activity, Scale, Syringe, Calendar, GitBranch, Camera, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AnimalLineage } from "./AnimalLineage";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

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
  const { activeFarmId } = useStore();
  const isEn = i18n.language === "en";
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
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

  const onMedicalSubmit = (data: MedicalForm) => {
    if (!activeFarmId || !id) return;
    createMedicalRecord.mutate(
      { farmId: activeFarmId, animalId: id, data: { ...data, costCop: data.costCop !== "" && data.costCop != null ? Number(data.costCop) : undefined } as any },
      {
        onSuccess: () => {
          setMedicalOpen(false);
          medicalForm.reset({ recordType: "checkup", title: "", recordDate: new Date().toISOString().split("T")[0], description: "", vetName: "", costCop: "", nextDueDate: "" });
          refetch();
        }
      }
    );
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
        <Button
          variant="outline"
          className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 hover-elevate"
          onClick={() => { setPhotoPreview(null); setEditOpen(true); }}
        >
          <Edit className="h-4 w-4 mr-2" /> {t('animals.edit')}
        </Button>
      </div>

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
                    className="w-full h-28 rounded-xl border-2 border-dashed border-border/50 hover:border-secondary/50 bg-muted/20 hover:bg-secondary/5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-secondary transition-all"
                  >
                    <Upload className="h-6 w-6" />
                    <span className="text-sm">{t('animals.photoUpload')}</span>
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
                          type="number"
                          min="0"
                          step="1000"
                          {...field}
                          value={field.value ?? ""}
                          className="rounded-xl pr-14"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">COP</span>
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
      <Dialog open={medicalOpen} onOpenChange={setMedicalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary flex items-center gap-2">
              <Syringe className="h-5 w-5" /> {t('animals.addMedical')}
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
                        <Input type="number" min="0" step="1000" {...field} value={field.value ?? ""} className="rounded-xl pr-14" placeholder="0" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">COP</span>
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

              <Button type="submit" disabled={createMedicalRecord.isPending} className="w-full rounded-xl py-6 bg-primary hover:bg-primary/90">
                {createMedicalRecord.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
                    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number((animal as any).purchasePrice))
                    : <span className="text-muted-foreground/60 italic font-normal text-sm">{t('animals.notPurchased')}</span>}
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
              <TabsTrigger value="lineage" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                {t('animals.tab.lineage')}
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
            <TabsContent value="lineage" className="mt-0">
              <AnimalLineage
                animal={animal as any}
                farmId={activeFarmId!}
                onRefresh={() => refetch()}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
