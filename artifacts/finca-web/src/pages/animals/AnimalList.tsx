import { useState, useMemo, useRef } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { currencyInputDisplay, currencyInputRaw } from "@/lib/currency";
import { useUpgradeStore } from "@/lib/upgradeStore";
import { useListAnimals, useCreateAnimal, useGetFarmStats } from "@workspace/api-client-react";
import type { Animal, CreateAnimalRequest } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, ArrowRight, PawPrint, X, Camera, Upload, Bell } from "lucide-react";
import { LifecycleSummaryChips } from "@/components/lifecycle/LifecycleSummaryChips";
import { deriveLifecycleStage, hasLifecycle, type LifecycleStage, type LifecycleAnimal } from "@/lib/lifecycle";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const createAnimalSchema = z.object({
  species: z.enum(["cattle", "chicken", "pig", "goat", "sheep", "horse", "other"]),
  customTag: z.string().optional(),
  name: z.string().optional(),
  breed: z.string().optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  animalType: z.string().optional(),
  initialWeight: z.coerce.number().positive().optional().or(z.literal("")),
  purchaseDate: z.string().optional(),
  purchasePrice: z.coerce.number().positive().optional().or(z.literal("")),
  photoUrl: z.string().optional(),
});

const ANIMAL_TYPE_SUGGESTIONS: Record<string, string[]> = {
  cattle:  ["animals.types.meat", "animals.types.milk", "animals.types.dual"],
  pig:     ["animals.types.meat", "animals.types.breeding", "animals.types.fattening"],
  horse:   ["animals.types.work", "animals.types.saddle", "animals.types.sport", "animals.types.pack"],
  goat:    ["animals.types.meat", "animals.types.milk"],
  sheep:   ["animals.types.meat", "animals.types.wool", "animals.types.milk"],
  chicken: ["animals.types.egg", "animals.types.broiler"],
  other:   [],
};

const SPECIES_EMOJI: Record<string, string> = {
  cattle: "🐄",
  pig: "🐖",
  horse: "🐴",
  goat: "🐐",
  sheep: "🐑",
  chicken: "🐔",
  other: "🐾",
};


export function AnimalList() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const { activeFarmId, currency } = useStore();
  const { openUpgradeModal } = useUpgradeStore();
  const [search, setSearch] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const [selectedLifecycle, setSelectedLifecycle] = useState<LifecycleStage | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: animals, isLoading } = useListAnimals(activeFarmId || '',
    { search: search || undefined },
    { query: { enabled: !!activeFarmId } }
  );

  const { data: farmStats } = useGetFarmStats(activeFarmId || '', {
    query: { enabled: !!activeFarmId },
  });
  const upcomingMedicalSet = new Set<string>(farmStats?.upcomingMedicalAnimalIds ?? []);

  const createAnimal = useCreateAnimal();

  const addWeight = useMutation({
    mutationFn: async ({ animalId, weightKg }: { animalId: string; weightKg: number }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals/${animalId}/weights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg, recordedAt: new Date().toISOString().split("T")[0] }),
      });
      if (!res.ok) throw new Error("weight failed");
    },
  });

  const form = useForm<z.infer<typeof createAnimalSchema>>({
    resolver: zodResolver(createAnimalSchema),
    defaultValues: { species: "cattle", customTag: "", name: "", breed: "", animalType: "", initialWeight: "", purchaseDate: "", purchasePrice: "", photoUrl: "" }
  });

  const watchedSpecies = form.watch("species");

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

  const onSubmit = async (data: z.infer<typeof createAnimalSchema>) => {
    if (!activeFarmId) return;
    const { initialWeight, purchaseDate, purchasePrice, ...animalData } = data;
    createAnimal.mutate({
      farmId: activeFarmId,
      data: {
        ...animalData,
        status: "active",
        purchaseDate: purchaseDate || null,
        purchasePrice: purchasePrice !== "" && purchasePrice != null ? Number(purchasePrice) : null,
      } as any
    }, {
      onSuccess: async (created) => {
        if (initialWeight && Number(initialWeight) > 0 && created?.id) {
          await addWeight.mutateAsync({ animalId: created.id, weightKg: Number(initialWeight) });
        }
        setIsDialogOpen(false);
        setPhotoPreview(null);
        form.reset();
        queryClient.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/animals`] });
      },
      onError: (err: any) => {
        if (err?.data?.error === "plan_limit") {
          openUpgradeModal("animals", err.data.limit);
        }
      }
    });
  };

  const ALL_SPECIES = ["cattle", "pig", "horse", "goat", "sheep", "chicken", "other"];

  const speciesCount = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_SPECIES.forEach(sp => { counts[sp] = 0; });
    animals?.forEach((a: Animal) => { counts[a.species] = (counts[a.species] ?? 0) + 1; });
    return counts;
  }, [animals]);

  const filtered = useMemo(() => {
    if (!animals) return [];
    let result = animals as (Animal & LifecycleAnimal)[];
    if (selectedSpecies !== "all") {
      result = result.filter(a => a.species === selectedSpecies);
    }
    if (selectedLifecycle) {
      result = result.filter(a => {
        const stage = deriveLifecycleStage(a as LifecycleAnimal);
        return stage === selectedLifecycle;
      });
    }
    return result;
  }, [animals, selectedSpecies, selectedLifecycle]);

  if (!activeFarmId) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{t('nav.animals')}</h1>
          <p className="text-muted-foreground mt-1">{t('animals.subtitle')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) { setPhotoPreview(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl px-6 hover-elevate shadow-md">
              <Plus className="mr-2 h-4 w-4" /> {t('animals.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">{t('animals.add')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">

                {/* ── SPECIES GRID ── */}
                <FormField control={form.control} name="species" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">{t('animals.species')}</FormLabel>
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {ALL_SPECIES.map(sp => (
                        <button
                          key={sp}
                          type="button"
                          onClick={() => { field.onChange(sp); form.setValue("animalType", ""); }}
                          className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border text-xs font-medium transition-all ${
                            field.value === sp
                              ? "bg-secondary/10 border-secondary text-secondary shadow-sm"
                              : "bg-muted/30 border-border/40 text-muted-foreground hover:border-secondary/40 hover:text-secondary/80"
                          }`}
                        >
                          <span className="text-2xl">{SPECIES_EMOJI[sp]}</span>
                          <span>{t(`animals.sp.${sp}`)}</span>
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── PHOTO UPLOAD ── */}
                <div>
                  <label className="text-sm font-semibold mb-2 block">{t('animals.photo')} <span className="text-muted-foreground font-normal">({t('common.optional')})</span></label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  {photoPreview ? (
                    <div className="relative rounded-xl overflow-hidden h-36 bg-muted/30 border border-border/40">
                      <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
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
                        <Camera className="h-3 w-3" /> Cambiar
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

                {/* ── ID + NAME ── */}
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

                {/* ── TYPE + BREED ── */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="animalType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('animals.type')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        disabled={(ANIMAL_TYPE_SUGGESTIONS[watchedSpecies] ?? []).length === 0}
                      >
                        <FormControl>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder={t('animals.typePlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(ANIMAL_TYPE_SUGGESTIONS[watchedSpecies] ?? []).map(opt => (
                            <SelectItem key={opt} value={opt}>{t(opt)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="breed" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('animals.breed')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                      <FormControl><Input {...field} className="rounded-xl" placeholder="EJ: Brahman" /></FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* ── WEIGHT ── */}
                <FormField control={form.control} name="initialWeight" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.initialWeight')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          {...field}
                          className="rounded-xl pr-12"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">kg</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── PURCHASE DATE + PRICE ── */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('animals.purchaseDate')} <span className="text-muted-foreground font-normal text-xs">({t('common.optional')})</span></FormLabel>
                      <FormControl><Input type="date" {...field} className="rounded-xl" /></FormControl>
                      <FormMessage />
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
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Button type="submit" disabled={createAnimal.isPending || addWeight.isPending} className="w-full rounded-xl py-6 bg-primary hover:bg-primary/90">
                  {(createAnimal.isPending || addWeight.isPending) ? t('common.saving') : t('common.save')}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + Filter row */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('animals.search')}
            className="pl-10 rounded-xl bg-card border-none shadow-sm py-6"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Species filter chips — always shown once data loads */}
      {!isLoading && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-6 pl-6 pr-2 md:mx-0 md:pl-0 md:pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setSelectedSpecies("all")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all shrink-0 ${
              selectedSpecies === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}
          >
            {t('animals.filter.all')}
            {animals && (
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                selectedSpecies === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {animals.length}
              </span>
            )}
          </button>

          {ALL_SPECIES.map(sp => {
            const count = speciesCount[sp] ?? 0;
            const active = selectedSpecies === sp;
            const isEmpty = count === 0;
            return (
              <button
                key={sp}
                onClick={() => setSelectedSpecies(active ? "all" : sp)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all shrink-0 ${
                  active
                    ? "bg-secondary text-white border-secondary shadow-sm"
                    : isEmpty
                      ? "bg-card border-border/30 text-muted-foreground/50 hover:border-secondary/30 hover:text-secondary/60"
                      : "bg-card border-border/50 text-muted-foreground hover:border-secondary/50 hover:text-secondary"
                }`}
              >
                <span className={isEmpty && !active ? "opacity-50" : ""}>{SPECIES_EMOJI[sp] ?? "🐾"}</span>
                <span>{t(`animals.sp.${sp}`)}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  active
                    ? "bg-white/20 text-white"
                    : isEmpty
                      ? "bg-muted/50 text-muted-foreground/40"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && animals && (
        <LifecycleSummaryChips
          animals={animals as LifecycleAnimal[]}
          selectedStage={selectedLifecycle}
          onSelect={setSelectedLifecycle}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => <Card key={i} className="h-48 animate-pulse bg-black/5 border-none rounded-2xl" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((animal: Animal) => (
            <Link key={animal.id} href={`/animals/${animal.id}`}>
              <Card className="group cursor-pointer overflow-hidden border-border/50 hover:border-accent/50 transition-all duration-300 hover-elevate bg-card/60 backdrop-blur-sm rounded-2xl h-full flex flex-col">
                <div className="h-32 bg-primary/5 relative flex items-center justify-center border-b border-border/30">
                  {animal.photoUrl ? (
                    <>
                      <img
                        src={animal.photoUrl}
                        alt={animal.name || animal.customTag}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          (e.currentTarget.nextElementSibling as HTMLElement)?.removeAttribute("hidden");
                        }}
                      />
                      <span className="text-4xl" hidden>{SPECIES_EMOJI[animal.species] ?? "🐾"}</span>
                    </>
                  ) : (
                    <span className="text-4xl">{SPECIES_EMOJI[animal.species] ?? "🐾"}</span>
                  )}
                  {/* Top-left: Due soon (+ Deceased if applicable) */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    {(animal as any).status === "deceased" && (
                      <div className="bg-stone-600/90 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-semibold text-white flex items-center gap-1 shadow-sm">
                        <span>✝</span>
                        {isEn ? "Deceased" : "Fallecida/o"}
                      </div>
                    )}
                    {upcomingMedicalSet.has(animal.id) && (
                      <div className="bg-amber-500/90 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-semibold text-white flex items-center gap-1 shadow-sm">
                        <Bell className="h-3 w-3" />
                        {isEn ? "Due soon" : "Próximo"}
                      </div>
                    )}
                  </div>
                  {/* Top-right: Lifecycle stage pill */}
                  {(() => {
                    const la = animal as unknown as LifecycleAnimal;
                    if (!hasLifecycle(la)) return null;
                    const stage = deriveLifecycleStage(la);
                    if (!stage) return null;
                    const cfg: Record<string, { bg: string; label: string; labelEn: string; icon: string }> = {
                      growing:   { bg: "bg-blue-500",    label: "Crecimiento",        labelEn: "Growing",    icon: "🌱" },
                      can_breed: { bg: "bg-emerald-500", label: "Puede reproducir",   labelEn: "Can Breed",  icon: "✓" },
                      in_heat:   { bg: "bg-orange-500",  label: "En celo",            labelEn: "In Heat",    icon: "🔥" },
                      pregnant:  { bg: "bg-rose-500",    label: "Preñada",            labelEn: "Pregnant",   icon: "🤰" },
                      nursing:   { bg: "bg-purple-500",  label: "Lactancia",          labelEn: "Nursing",    icon: "🍼" },
                    };
                    const s = cfg[stage];
                    if (!s) return null;
                    return (
                      <div className={`absolute top-3 right-3 ${s.bg} px-2 py-1 rounded-lg text-xs font-semibold text-white flex items-center gap-1 shadow-sm`}>
                        <span className="text-[10px] leading-none">{s.icon}</span>
                        {isEn ? s.labelEn : s.label}
                      </div>
                    );
                  })()}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-primary truncate">
                      {animal.customTag && animal.name ? (
                        <>
                          {animal.customTag}
                          <span className="text-muted-foreground"> | {animal.name}</span>
                        </>
                      ) : (
                        animal.customTag || animal.name || t('animals.noName')
                      )}
                    </h3>
                    <p className="text-muted-foreground text-sm capitalize mt-1 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
                      {t(`animals.sp.${animal.species}`)} {animal.breed ? `• ${animal.breed}` : ''}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-muted-foreground block text-xs">{t('animals.weight')}</span>
                      <span className="font-semibold text-foreground">{animal.currentWeight ? `${animal.currentWeight} kg` : '-'}</span>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-border">
          <PawPrint className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
          {selectedSpecies !== "all" ? (
            <>
              <h3 className="text-xl font-serif text-primary">{t('animals.filter.empty.title')}</h3>
              <p className="text-muted-foreground mt-2">{t('animals.filter.empty.desc')}</p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-serif text-primary">{t('animals.empty.title')}</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">{t('animals.empty.desc')}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
