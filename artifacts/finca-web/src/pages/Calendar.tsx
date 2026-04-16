import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isToday, isSameMonth, addMonths, subMonths, parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Trash2, User, CalendarX, Syringe, Pencil } from "lucide-react";

type FarmEvent = {
  id: string;
  farmId: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay: boolean;
  category?: string | null;
  assignedTo?: string | null;
  color?: string | null;
  animalId?: string | null;
  medicalRecordId?: string | null;
  createdAt?: string;
};

type Animal = {
  id: string;
  customTag?: string | null;
  name?: string | null;
  species?: string;
};

const CATEGORY_COLORS: Record<string, { pill: string; dot: string; bar: string; label: string; labelEs: string }> = {
  feeding:     { pill: "bg-green-500/15 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-700/50",    dot: "bg-green-500",   bar: "bg-green-500",   label: "Feeding",     labelEs: "Alimentación" },
  health:      { pill: "bg-rose-500/15 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-700/50",          dot: "bg-rose-500",    bar: "bg-rose-500",    label: "Health",      labelEs: "Salud" },
  harvest:     { pill: "bg-amber-500/15 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-700/50",    dot: "bg-amber-500",   bar: "bg-amber-500",   label: "Harvest",     labelEs: "Cosecha" },
  maintenance: { pill: "bg-blue-500/15 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-700/50",          dot: "bg-blue-500",    bar: "bg-blue-500",    label: "Maintenance", labelEs: "Mantenimiento" },
  meeting:     { pill: "bg-violet-500/15 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-700/50", dot: "bg-violet-500",  bar: "bg-violet-500",  label: "Meeting",     labelEs: "Reunión" },
  other:       { pill: "bg-muted text-muted-foreground border-border",                                                                          dot: "bg-muted-foreground",   bar: "bg-muted-foreground",   label: "Other",       labelEs: "Otro" },
};

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  category: z.enum(["feeding", "health", "harvest", "maintenance", "meeting", "other"]).default("other"),
  assignedTo: z.string().optional(),
  animalId: z.string().optional(),
});
type EventForm = z.infer<typeof eventSchema>;

const WEEKDAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Calendar() {
  const { i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const qc = useQueryClient();
  const isEn = i18n.language === "en";
  const [, setLocation] = useLocation();
  const search = useSearch();

  const evtTitle = (evt: FarmEvent) => (isEn && evt.titleEn) ? evt.titleEn : evt.title;
  const evtDesc  = (evt: FarmEvent) => (isEn && evt.descriptionEn) ? evt.descriptionEn : evt.description;

  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(() => {
    const params = new URLSearchParams(search);
    const dateParam = params.get("date");
    if (dateParam) {
      const parsed = new Date(dateParam + "T12:00:00");
      if (!isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const params = new URLSearchParams(search);
    const dateParam = params.get("date");
    if (dateParam) {
      const parsed = new Date(dateParam + "T12:00:00");
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return today;
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FarmEvent | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthLabel = format(currentDate, "MMMM yyyy", { locale: isEn ? undefined : es });

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const firstDayOfWeek = getDay(days[0]!);
  const paddingDays = Array(firstDayOfWeek).fill(null);

  const fetchFrom = format(subMonths(startOfMonth(currentDate), 1), "yyyy-MM-dd");
  const fetchTo   = format(addMonths(endOfMonth(currentDate),   1), "yyyy-MM-dd");

  const { data: events = [] } = useQuery<FarmEvent[]>({
    queryKey: [`/api/farms/${activeFarmId}/events`, year, month],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/events?from=${fetchFrom}&to=${fetchTo}`);
      if (!res.ok) throw new Error("fetch events failed");
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const { data: animals = [] } = useQuery<Animal[]>({
    queryKey: [`/api/farms/${activeFarmId}/animals`],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/animals`);
      if (!res.ok) throw new Error("fetch animals failed");
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const animalMap = useMemo(() => {
    const m = new Map<string, Animal>();
    animals.forEach(a => m.set(a.id, a));
    return m;
  }, [animals]);

  const animalLabel = (a: Animal) =>
    a.customTag ? `${a.customTag}${a.name ? ` · ${a.name}` : ""}` : (a.name ?? a.id);

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: "", description: "", startDate: "", endDate: "", category: "other", assignedTo: "", animalId: "" },
  });

  const watchedAnimalId = form.watch("animalId");

  const openCreate = (dateStr?: string) => {
    setEditingEvent(null);
    form.reset({
      title: "", description: "",
      startDate: dateStr || format(selectedDate, "yyyy-MM-dd"),
      endDate: "", category: "other", assignedTo: "", animalId: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (event: FarmEvent) => {
    if (event.animalId) {
      const tab = event.medicalRecordId ? "?tab=medical" : "";
      setLocation(`/animals/${event.animalId}${tab}`);
      return;
    }
    openEditModal(event);
  };

  const openEditModal = (event: FarmEvent) => {
    setEditingEvent(event);
    form.reset({
      title: event.title,
      description: event.description || "",
      startDate: event.startDate,
      endDate: event.endDate || "",
      category: (event.category as any) || "other",
      assignedTo: event.assignedTo || "",
      animalId: event.animalId || "",
    });
    setDialogOpen(true);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/events`, year, month] });

  const createEvent = useMutation({
    mutationFn: async (data: EventForm) => {
      const res = await fetch(`/api/farms/${activeFarmId}/events`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, allDay: true, animalId: data.animalId || null }),
      });
      if (!res.ok) throw new Error("create failed");
      return res.json();
    },
    onSuccess: () => { setDialogOpen(false); invalidate(); },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EventForm }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/events/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, allDay: true, animalId: data.animalId || null }),
      });
      if (!res.ok) throw new Error("update failed");
      return res.json();
    },
    onSuccess: () => { setDialogOpen(false); setEditingEvent(null); invalidate(); },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/farms/${activeFarmId}/events/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("delete failed");
    },
    onSuccess: () => { setDialogOpen(false); setEditingEvent(null); invalidate(); },
  });

  const onSubmit = (data: EventForm) => {
    if (editingEvent) updateEvent.mutate({ id: editingEvent.id, data });
    else createEvent.mutate(data);
  };

  const eventsForDay = (date: Date): FarmEvent[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter(e => {
      if (e.startDate === dateStr) return true;
      if (e.endDate && e.startDate <= dateStr && e.endDate >= dateStr) return true;
      return false;
    });
  };

  const goToPrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    if (!isSameMonth(day, currentDate)) {
      setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1));
    }
  };

  const weekdays = isEn ? WEEKDAYS_EN : WEEKDAYS_ES;
  const isPending = createEvent.isPending || updateEvent.isPending;

  const selectedDayEvents = eventsForDay(selectedDate);

  const selectedDateLabel = format(selectedDate, isEn ? "EEEE, MMMM d" : "EEEE, d 'de' MMMM", { locale: isEn ? undefined : es });
  const catLabel = (cat: string | null | undefined) => {
    const c = CATEGORY_COLORS[cat || "other"]!;
    return isEn ? c.label : c.labelEs;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{isEn ? "Calendar" : "Calendario"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{isEn ? "Plan and track farm activities" : "Planifica y registra actividades de la finca"}</p>
        </div>
        <Button onClick={() => openCreate()} className="rounded-xl bg-primary hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{isEn ? "New Event" : "Nuevo Evento"}</span>
          <span className="sm:hidden">{isEn ? "Add" : "Nuevo"}</span>
        </Button>
      </div>

      <Card className="rounded-2xl shadow-sm border-border/40 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border/40 bg-card">
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-xl hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-serif font-semibold text-primary capitalize">{monthLabel}</h2>
            <button
              onClick={goToToday}
              className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
            >
              {isEn ? "Today" : "Hoy"}
            </button>
          </div>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-xl hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border/40 bg-muted/20">
          {weekdays.map((wd) => (
            <div key={wd} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {paddingDays.map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[64px] sm:min-h-[100px] border-b border-r border-border/20 bg-muted/5" />
          ))}

          {days.map((day, idx) => {
            const isLastCol = (firstDayOfWeek + idx) % 7 === 6;
            const dayEvents = eventsForDay(day);
            const dateStr = format(day, "yyyy-MM-dd");
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDay = isToday(day);

            return (
              <div
                key={dateStr}
                onClick={() => handleDayClick(day)}
                className={`min-h-[64px] sm:min-h-[100px] border-b border-border/20 ${isLastCol ? "" : "border-r"} p-1.5 sm:p-2 cursor-pointer transition-colors ${isSelected ? "bg-primary/[0.06]" : "hover:bg-primary/[0.03]"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-colors
                      ${isTodayDay
                        ? "bg-primary text-primary-foreground"
                        : isSelected
                          ? "bg-primary/15 text-primary font-semibold ring-1 ring-primary/40"
                          : "text-foreground"
                      }`}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] text-muted-foreground font-medium hidden sm:block">+{dayEvents.length - 2}</span>
                  )}
                </div>

                {/* Desktop: event pills (max 2) */}
                <div className="hidden sm:flex flex-col gap-0.5">
                  {dayEvents.slice(0, 2).map((evt) => {
                    const cat = CATEGORY_COLORS[evt.category || "other"]!;
                    const isAuto = !!evt.medicalRecordId;
                    const animal = evt.animalId ? animalMap.get(evt.animalId) : null;
                    return (
                      <button
                        key={evt.id}
                        onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                        className={`w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate hover:opacity-75 transition-opacity ${isAuto ? `border border-dashed ${cat.pill}` : `border ${cat.pill}`}`}
                        title={isAuto ? (isEn ? "Auto-generated from medical record" : "Generado desde registro médico") : undefined}
                      >
                        {isAuto ? (
                          <Syringe className="inline-block h-2.5 w-2.5 mr-0.5 align-middle flex-shrink-0" />
                        ) : (
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${cat.dot} mr-1 align-middle flex-shrink-0`} />
                        )}
                        {animal?.customTag && (
                          <span className="font-bold mr-0.5">{animal.customTag}</span>
                        )}
                        {evtTitle(evt)}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile: colored dots only */}
                {dayEvents.length > 0 && (
                  <div className="sm:hidden flex gap-0.5 mt-0.5 flex-wrap">
                    {dayEvents.slice(0, 3).map((evt) => {
                      const cat = CATEGORY_COLORS[evt.category || "other"]!;
                      return <span key={evt.id} className={`w-1.5 h-1.5 rounded-full ${cat.dot} flex-shrink-0`} />;
                    })}
                    {dayEvents.length > 3 && <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Day detail panel ── */}
      <Card className="rounded-2xl shadow-sm border-border/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border/40 bg-card">
          <div>
            <p className="text-sm font-semibold text-foreground capitalize">{selectedDateLabel}</p>
            {isToday(selectedDate) && (
              <p className="text-xs text-primary font-medium mt-0.5">{isEn ? "Today" : "Hoy"}</p>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => openCreate(format(selectedDate, "yyyy-MM-dd"))}
            className="rounded-xl bg-primary hover:bg-primary/90 gap-1.5 h-8 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {isEn ? "Add" : "Agregar"}
          </Button>
        </div>

        <div className="divide-y divide-border/30">
          {selectedDayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <CalendarX className="h-8 w-8 opacity-30" />
              <p className="text-sm font-medium">{isEn ? "No events" : "Sin eventos"}</p>
              <p className="text-xs opacity-70">
                {isEn ? "Tap + to schedule something" : "Toca + para agendar algo"}
              </p>
            </div>
          ) : (
            selectedDayEvents.map((evt) => {
              const cat = CATEGORY_COLORS[evt.category || "other"]!;
              const isAuto = !!evt.medicalRecordId;
              const isManualAnimal = !!evt.animalId && !evt.medicalRecordId;
              const animal = evt.animalId ? animalMap.get(evt.animalId) : null;
              return (
                <div
                  key={evt.id}
                  className={`w-full flex items-stretch gap-0 transition-colors group ${isAuto ? "hover:bg-rose-50/50" : "hover:bg-primary/[0.04]"}`}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(evt)}
                    className="flex-1 text-left flex items-stretch gap-0"
                  >
                    <div className={`w-1 flex-shrink-0 ${cat.bar} ${isAuto ? "opacity-50" : ""} rounded-none`} />
                    <div className="flex-1 px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isAuto && <Syringe className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />}
                            {animal && (
                              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                {animal.customTag || animal.name}
                              </span>
                            )}
                            <p className="font-semibold text-sm text-foreground leading-snug">{evtTitle(evt)}</p>
                          </div>
                          {evtDesc(evt) && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{evtDesc(evt)}</p>
                          )}
                          {evt.assignedTo && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <User className="h-3 w-3 flex-shrink-0" />
                              {evt.assignedTo}
                            </p>
                          )}
                          {evt.endDate && evt.endDate !== evt.startDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {isEn ? "Until" : "Hasta"} {format(parseISO(evt.endDate), isEn ? "MMM d" : "d MMM", { locale: isEn ? undefined : es })}
                            </p>
                          )}
                          {isAuto && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">
                              {isEn ? "From medical record — click to view animal" : "Desde registro médico — clic para ver el animal"}
                            </p>
                          )}
                          {isManualAnimal && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">
                              {isEn ? "Click to view animal" : "Clic para ver el animal"}
                            </p>
                          )}
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${cat.pill} ${isAuto ? "border-dashed" : ""}`}>
                          {catLabel(evt.category)}
                        </span>
                      </div>
                    </div>
                  </button>
                  {isManualAnimal && (
                    <button
                      type="button"
                      title={isEn ? "Edit event" : "Editar evento"}
                      onClick={() => openEditModal(evt)}
                      className="flex-shrink-0 px-3 flex items-center text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {Object.entries(CATEGORY_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${val.dot}`} />
            {isEn ? val.label : val.labelEs}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Syringe className="h-3 w-3" />
          {isEn ? "Auto-generated (medical due date)" : "Auto-generado (fecha próxima médica)"}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingEvent(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {editingEvent ? (isEn ? "Edit Event" : "Editar Evento") : (isEn ? "New Event" : "Nuevo Evento")}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{isEn ? "Title" : "Título"} *</FormLabel>
                  <FormControl>
                    <Input placeholder={isEn ? "e.g. Cattle vaccination" : "ej. Vacunación ganado"} className="rounded-xl" {...field} />
                  </FormControl>
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{isEn ? "Start date" : "Fecha inicio"} *</FormLabel>
                    <FormControl>
                      <div className="h-10 overflow-hidden rounded-xl border border-input bg-background flex items-center">
                        <input type="date" {...field} className="w-full h-full px-3 bg-transparent text-sm outline-none appearance-none [&::-webkit-date-and-time-value]:text-left" />
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      {isEn ? "End date" : "Fecha fin"}
                      <span className="text-muted-foreground font-normal"> ({isEn ? "opt." : "opc."})</span>
                    </FormLabel>
                    <FormControl>
                      <div className="h-10 overflow-hidden rounded-xl border border-input bg-background flex items-center">
                        <input type="date" {...field} className="w-full h-full px-3 bg-transparent text-sm outline-none appearance-none [&::-webkit-date-and-time-value]:text-left" />
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{isEn ? "Category" : "Categoría"}</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="w-full border border-input bg-background rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {Object.entries(CATEGORY_COLORS).map(([key, val]) => (
                        <option key={key} value={key}>{isEn ? val.label : val.labelEs}</option>
                      ))}
                    </select>
                  </FormControl>
                </FormItem>
              )} />

              {/* Animal selector */}
              <FormField control={form.control} name="animalId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {isEn ? "Link to animal" : "Vincular animal"}
                    <span className="text-muted-foreground font-normal"> ({isEn ? "opt." : "opc."})</span>
                  </FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (e.target.value) {
                          form.setValue("category", "health");
                        }
                      }}
                      className="w-full border border-input bg-background rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{isEn ? "— None —" : "— Ninguno —"}</option>
                      {animals.map(a => (
                        <option key={a.id} value={a.id}>{animalLabel(a)}</option>
                      ))}
                    </select>
                  </FormControl>
                  {watchedAnimalId && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isEn ? "This event will appear on the animal's profile." : "Este evento aparecerá en el perfil del animal."}
                    </p>
                  )}
                </FormItem>
              )} />

              <FormField control={form.control} name="assignedTo" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {isEn ? "Assigned to" : "Asignado a"}
                    <span className="text-muted-foreground font-normal"> ({isEn ? "opt." : "opc."})</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={isEn ? "e.g. Carlos, all staff" : "ej. Carlos, todos"} className="rounded-xl" {...field} />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    {isEn ? "Notes" : "Notas"}
                    <span className="text-muted-foreground font-normal"> ({isEn ? "opt." : "opc."})</span>
                  </FormLabel>
                  <FormControl>
                    <textarea
                      className="w-full border border-input bg-background rounded-xl px-3 py-2 text-sm min-h-[72px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={isEn ? "Additional details..." : "Detalles adicionales..."}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )} />

              <div className="flex gap-2 pt-1">
                {editingEvent && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleteEvent.isPending}
                    onClick={() => deleteEvent.mutate(editingEvent.id)}
                    className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button type="submit" disabled={isPending} className="flex-1 rounded-xl py-6 bg-primary hover:bg-primary/90">
                  {isPending ? (isEn ? "Saving..." : "Guardando...") : (isEn ? "Save" : "Guardar")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
