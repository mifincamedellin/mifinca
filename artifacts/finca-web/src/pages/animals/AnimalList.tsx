import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useListAnimals, useCreateAnimal } from "@workspace/api-client-react";
import type { Animal, CreateAnimalRequest } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, ArrowRight, PawPrint, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

const createAnimalSchema = z.object({
  species: z.enum(["cattle", "chicken", "pig", "goat", "sheep", "horse", "other"]),
  customTag: z.string().optional(),
  name: z.string().optional(),
  breed: z.string().optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
});

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
  const { t } = useTranslation();
  const { activeFarmId } = useStore();
  const [search, setSearch] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: animals, isLoading } = useListAnimals(activeFarmId || '',
    { search: search || undefined },
    { query: { enabled: !!activeFarmId } }
  );

  const createAnimal = useCreateAnimal();

  const form = useForm<z.infer<typeof createAnimalSchema>>({
    resolver: zodResolver(createAnimalSchema),
    defaultValues: { species: "cattle" }
  });

  const onSubmit = (data: z.infer<typeof createAnimalSchema>) => {
    if (!activeFarmId) return;
    createAnimal.mutate({
      farmId: activeFarmId,
      data: { ...data, status: "active" } as CreateAnimalRequest
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/animals`] });
      }
    });
  };

  const presentSpecies = useMemo(() => {
    if (!animals) return [];
    const seen = new Set<string>();
    animals.forEach((a: Animal) => seen.add(a.species));
    return Array.from(seen).sort();
  }, [animals]);

  const filtered = useMemo(() => {
    if (!animals) return [];
    if (selectedSpecies === "all") return animals;
    return animals.filter((a: Animal) => a.species === selectedSpecies);
  }, [animals, selectedSpecies]);

  if (!activeFarmId) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-serif text-primary font-bold">{t('nav.animals')}</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl px-6 bg-secondary hover:bg-secondary/90 hover-elevate shadow-md">
              <Plus className="mr-2 h-4 w-4" /> {t('animals.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">{t('animals.add')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="species" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.species')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="rounded-xl">
                        {["cattle", "chicken", "pig", "goat", "sheep", "horse", "other"].map(s => (
                          <SelectItem key={s} value={s}>{SPECIES_EMOJI[s]} {t(`animals.sp.${s}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="customTag" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID / Tag</FormLabel>
                    <FormControl><Input {...field} className="rounded-xl" placeholder="EJ: 001" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('animals.name')}</FormLabel>
                    <FormControl><Input {...field} className="rounded-xl" placeholder={t('common.optional')} /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" disabled={createAnimal.isPending} className="w-full rounded-xl mt-6 py-6 bg-primary hover:bg-primary/90">
                  {createAnimal.isPending ? t('common.saving') : t('common.save')}
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

      {/* Species filter chips — only shown when there are animals */}
      {!isLoading && presentSpecies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedSpecies("all")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              selectedSpecies === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}
          >
            {t('animals.filter.all')}
            {selectedSpecies === "all" && animals && (
              <span className="ml-1 bg-primary-foreground/20 text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-semibold">
                {animals.length}
              </span>
            )}
          </button>

          {presentSpecies.map(sp => {
            const count = animals?.filter((a: Animal) => a.species === sp).length ?? 0;
            const active = selectedSpecies === sp;
            return (
              <button
                key={sp}
                onClick={() => setSelectedSpecies(active ? "all" : sp)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  active
                    ? "bg-secondary text-white border-secondary shadow-sm"
                    : "bg-card border-border/50 text-muted-foreground hover:border-secondary/50 hover:text-secondary"
                }`}
              >
                <span>{SPECIES_EMOJI[sp] ?? "🐾"}</span>
                <span>{t(`animals.sp.${sp}`)}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
                {active && <X className="h-3 w-3 ml-0.5 opacity-70" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Results header when filtering */}
      {selectedSpecies !== "all" && !isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? t('animals.filter.result') : t('animals.filter.results')} · {SPECIES_EMOJI[selectedSpecies]} {t(`animals.sp.${selectedSpecies}`)}
          </p>
          <button
            onClick={() => setSelectedSpecies("all")}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <X className="h-3 w-3" /> {t('animals.filter.clear')}
          </button>
        </div>
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
                    <img src={animal.photoUrl} alt={animal.name || animal.customTag} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{SPECIES_EMOJI[animal.species] ?? "🐾"}</span>
                  )}
                  <div className="absolute top-3 right-3 bg-card/80 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-semibold text-primary border border-border/50 shadow-sm">
                    {animal.customTag || 'S/N'}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-primary truncate">{animal.name || t('animals.noName')}</h3>
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
