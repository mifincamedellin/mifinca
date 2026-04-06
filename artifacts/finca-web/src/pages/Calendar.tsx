import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, X, Trash2 } from "lucide-react";

type FarmEvent = {
  id: string;
  farmId: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay: boolean;
  category?: string | null;
  assignedTo?: string | null;
  color?: string | null;
  createdAt?: string;
};

const CATEGORY_COLORS: Record<string, { pill: string; dot: string; label: string; labelEs: string }> = {
  feeding:     { pill: "bg-green-100 text-green-800 border-green-200",   dot: "bg-green-500",   label: "Feeding",      labelEs: "Alimentación" },
  health:      { pill: "bg-rose-100 text-rose-800 border-rose-200",      dot: "bg-rose-500",    label: "Health",       labelEs: "Salud" },
  harvest:     { pill: "bg-amber-100 text-amber-800 border-amber-200",   dot: "bg-amber-500",   label: "Harvest",      labelEs: "Cosecha" },
  maintenance: { pill: "bg-blue-100 text-blue-800 border-blue-200",      dot: "bg-blue-500",    label: "Maintenance",  labelEs: "Mantenimiento" },
  meeting:     { pill: "bg-violet-100 text-violet-800 border-violet-200",dot: "bg-violet-500",  label: "Meeting",      labelEs: "Reunión" },
  other:       { pill: "bg-slate-100 text-slate-700 border-slate-200",   dot: "bg-slate-400",   label: "Other",        labelEs: "Otro" },
};

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  category: z.enum(["feeding", "health", "harvest", "maintenance", "meeting", "other"]).default("other"),
  assignedTo: z.string().optional(),
});
type EventForm = z.infer<typeof eventSchema>;

const WEEKDAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Calendar() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const qc = useQueryClient();
  const isEn = i18n.language === "en";

  const now = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FarmEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthLabel = format(currentDate, isEn ? "MMMM yyyy" : "MMMM yyyy", { locale: isEn ? undefined : es });

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const firstDayOfWeek = getDay(days[0]);
  const paddingDays = Array(firstDayOfWeek).fill(null);

  const { data: events = [] } = useQuery<FarmEvent[]>({
    queryKey: [`/api/farms/${activeFarmId}/events`, year, month],
    queryFn: async () => {
      const from = format(startOfMonth(currentDate), "yyyy-MM-dd");
      const to = format(endOfMonth(currentDate), "yyyy-MM-dd");
      const res = await fetch(`/api/farms/${activeFarmId}/events?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("fetch events failed");
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: "", description: "", startDate: "", endDate: "", category: "other", assignedTo: "" },
  });

  const openCreate = (dateStr?: string) => {
    setEditingEvent(null);
    form.reset({ title: "", description: "", startDate: dateStr || format(new Date(), "yyyy-MM-dd"), endDate: "", category: "other", assignedTo: "" });
    setDialogOpen(true);
  };

  const openEdit = (event: FarmEvent) => {
    setEditingEvent(event);
    form.reset({
      title: event.title,
      description: event.description || "",
      startDate: event.startDate,
      endDate: event.endDate || "",
      category: (event.category as any) || "other",
      assignedTo: event.assignedTo || "",
    });
    setDialogOpen(true);
  };

  const createEvent = useMutation({
    mutationFn: async (data: EventForm) => {
      const res = await fetch(`/api/farms/${activeFarmId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, allDay: true }),
      });
      if (!res.ok) throw new Error("create failed");
      return res.json();
    },
    onSuccess: () => { setDialogOpen(false); invalidate(); },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EventForm }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, allDay: true }),
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

  const invalidate = () => qc.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/events`, year, month] });

  const onSubmit = (data: EventForm) => {
    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, data });
    } else {
      createEvent.mutate(data);
    }
  };

  const eventsForDay = (date: Date): FarmEvent[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter(e => {
      if (e.startDate === dateStr) return true;
      if (e.endDate && e.startDate <= dateStr && e.endDate >= dateStr) return true;
      return false;
    });
  };

  const weekdays = isEn ? WEEKDAYS_EN : WEEKDAYS_ES;

  const catLabel = (cat: string | null | undefined) => {
    const c = CATEGORY_COLORS[cat || "other"];
    return isEn ? c.label : c.labelEs;
  };

  const isPending = createEvent.isPending || updateEvent.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{isEn ? "Calendar" : "Calendario"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{isEn ? "Plan and track farm activities" : "Planifica y registra actividades de la finca"}</p>
        </div>
        <Button onClick={() => openCreate()} className="rounded-xl bg-primary hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" />
          {isEn ? "New Event" : "Nuevo Evento"}
        </Button>
      </div>

      <Card className="rounded-2xl shadow-sm border-border/40 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 rounded-xl hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-serif font-semibold text-primary capitalize">{monthLabel}</h2>
            <button
              onClick={() => setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1))}
              className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
            >
              {isEn ? "Today" : "Hoy"}
            </button>
          </div>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 rounded-xl hover:bg-black/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border/40 bg-muted/20">
          {weekdays.map((wd) => (
            <div key={wd} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {wd}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {paddingDays.map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[110px] border-b border-r border-border/20 bg-muted/5" />
          ))}

          {days.map((day, idx) => {
            const isLastCol = (firstDayOfWeek + idx) % 7 === 6;
            const todayClass = isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground";
            const dayEvents = eventsForDay(day);
            const dateStr = format(day, "yyyy-MM-dd");

            return (
              <div
                key={dateStr}
                className={`min-h-[110px] border-b border-border/20 ${isLastCol ? "" : "border-r"} p-2 cursor-pointer hover:bg-primary/[0.03] transition-colors group`}
                onClick={() => openCreate(dateStr)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${isToday(day) ? "bg-primary text-primary-foreground" : "group-hover:bg-primary/10 group-hover:text-primary"}`}>
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-muted-foreground font-medium">{dayEvents.length > 3 ? `+${dayEvents.length}` : ""}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((evt) => {
                    const cat = CATEGORY_COLORS[evt.category || "other"];
                    return (
                      <button
                        key={evt.id}
                        onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                        className={`w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded-md border truncate ${cat.pill} hover:opacity-80 transition-opacity`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${cat.dot} mr-1 flex-shrink-0`} />
                        {evt.title}
                      </button>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} {isEn ? "more" : "más"}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(CATEGORY_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2.5 h-2.5 rounded-full ${val.dot}`} />
            {isEn ? val.label : val.labelEs}
          </div>
        ))}
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
                  <FormControl><Input placeholder={isEn ? "e.g. Cattle vaccination" : "ej. Vacunación ganado"} className="rounded-xl" {...field} /></FormControl>
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{isEn ? "Start date" : "Fecha inicio"} *</FormLabel>
                    <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{isEn ? "End date" : "Fecha fin"} <span className="text-muted-foreground font-normal">({isEn ? "opt." : "opc."})</span></FormLabel>
                    <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{isEn ? "Category" : "Categoría"}</FormLabel>
                  <FormControl>
                    <select {...field} className="w-full border border-input bg-background rounded-xl px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {Object.entries(CATEGORY_COLORS).map(([key, val]) => (
                        <option key={key} value={key}>{isEn ? val.label : val.labelEs}</option>
                      ))}
                    </select>
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="assignedTo" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{isEn ? "Assigned to" : "Asignado a"} <span className="text-muted-foreground font-normal">({isEn ? "opt." : "opc."})</span></FormLabel>
                  <FormControl><Input placeholder={isEn ? "e.g. Carlos, all staff" : "ej. Carlos, todos"} className="rounded-xl" {...field} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">{isEn ? "Notes" : "Notas"} <span className="text-muted-foreground font-normal">({isEn ? "opt." : "opc."})</span></FormLabel>
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
