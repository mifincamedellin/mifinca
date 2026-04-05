import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useListFarms } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Users, Plus, Pencil, Trash2, Phone, Mail, CalendarDays,
  Banknote, Building2, TrendingUp, Loader2, ChevronDown, ChevronUp,
  HeartPulse, ShieldCheck, Receipt, Coins, Calculator,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type Employee = {
  id: string; farmId: string; name: string; phone?: string | null;
  email?: string | null; startDate?: string | null; monthlySalary?: string | null;
  bankName?: string | null; bankAccount?: string | null; notes?: string | null;
  pension?: string | null; salud?: string | null; arl?: string | null;
  primas?: string | null; cesantias?: string | null;
};

const EMPTY_FORM = {
  name: "", phone: "", email: "", startDate: "",
  monthlySalary: "", bankName: "Bancolombia", bankAccount: "", notes: "",
  pension: "", salud: "", arl: "", primas: "", cesantias: "",
};

// Colombian legal percentages (employer portion)
const COL_RATES = {
  pension: 0.12,    // 12% employer
  salud: 0.085,     // 8.5% employer
  arl: 0.0052,      // 0.52% basic risk (Class I)
  primas: 0.5,      // 1 month/year → 0.5 months per semester payment
  cesantias: 1.0,   // 1 month/year
};

function autoCalcBenefits(salary: string) {
  const s = parseFloat(salary) || 0;
  return {
    pension: Math.round(s * COL_RATES.pension).toString(),
    salud: Math.round(s * COL_RATES.salud).toString(),
    arl: Math.round(s * COL_RATES.arl).toString(),
    primas: Math.round(s * COL_RATES.primas).toString(),
    cesantias: Math.round(s * COL_RATES.cesantias).toString(),
  };
}

function daysUntilPayday(payDay: number): number {
  const today = new Date();
  const d = today.getDate();
  if (d < payDay) return payDay - d;
  const next = new Date(today.getFullYear(), today.getMonth() + 1, payDay);
  return Math.ceil((next.getTime() - today.getTime()) / 86400000);
}

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function num(v?: string | null) { return parseFloat(v ?? "0") || 0; }

export function Employees() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const qc = useQueryClient();
  const isEn = i18n.language === "en";

  const { data: farms } = useListFarms({ query: { enabled: !!activeFarmId } });
  const activeFarm = farms?.find((f: any) => f.id === activeFarmId);
  const payDay: number = (activeFarm as any)?.payDay ?? 30;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/employees`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const createEmployee = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const res = await fetch(`/api/farms/${activeFarmId}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees", activeFarmId] }); closeDialog(); },
  });

  const updateEmployee = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM & { id: string }) => {
      const { id, ...body } = data;
      const res = await fetch(`/api/farms/${activeFarmId}/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees", activeFarmId] }); closeDialog(); },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/farms/${activeFarmId}/employees/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees", activeFarmId] }); setDeleteConfirm(null); },
  });

  const openAdd = () => {
    setEditEmployee(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp);
    setForm({
      name: emp.name,
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      startDate: emp.startDate ?? "",
      monthlySalary: emp.monthlySalary ?? "",
      bankName: emp.bankName ?? "Bancolombia",
      bankAccount: emp.bankAccount ?? "",
      notes: emp.notes ?? "",
      pension: emp.pension ?? "",
      salud: emp.salud ?? "",
      arl: emp.arl ?? "",
      primas: emp.primas ?? "",
      cesantias: emp.cesantias ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditEmployee(null); setForm(EMPTY_FORM); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editEmployee) {
      updateEmployee.mutate({ ...form, id: editEmployee.id });
    } else {
      createEmployee.mutate(form);
    }
  };

  const handleAutoCalc = () => {
    const benefits = autoCalcBenefits(form.monthlySalary);
    setForm(f => ({ ...f, ...benefits }));
  };

  // ── Totals ──
  const totals = useMemo(() => ({
    monthly: employees.reduce((s, e) => s + num(e.monthlySalary), 0),
    pension: employees.reduce((s, e) => s + num(e.pension), 0),
    salud: employees.reduce((s, e) => s + num(e.salud), 0),
    arl: employees.reduce((s, e) => s + num(e.arl), 0),
    primas: employees.reduce((s, e) => s + num(e.primas), 0),
    cesantias: employees.reduce((s, e) => s + num(e.cesantias), 0),
  }), [employees]);

  const daysUntil = daysUntilPayday(payDay);
  const isPending = createEmployee.isPending || updateEmployee.isPending;

  // ── Summary rows ──
  const topCards = [
    { icon: CalendarDays, color: "text-accent", bg: "bg-accent/10", label: t("emp.daysUntil"), value: t("emp.daysCount", { count: daysUntil }) },
    { icon: Banknote, color: "text-secondary", bg: "bg-secondary/10", label: t("emp.monthlyPayroll"), value: formatCOP(totals.monthly) },
    { icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100/60", label: t("emp.annualPayroll"), value: formatCOP(totals.monthly * 12) },
  ];

  const benefitCards = [
    { icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-100/60", label: t("emp.totalPension"), value: formatCOP(totals.pension), sub: t("emp.perMonth") },
    { icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-100/60", label: t("emp.totalSalud"), value: formatCOP(totals.salud), sub: t("emp.perMonth") },
    { icon: ShieldCheck, color: "text-orange-500", bg: "bg-orange-100/60", label: t("emp.totalArl"), value: formatCOP(totals.arl), sub: t("emp.perMonth") },
    { icon: Receipt, color: "text-violet-600", bg: "bg-violet-100/60", label: t("emp.totalPrimas"), value: formatCOP(totals.primas), sub: t("emp.perSemester") },
    { icon: Coins, color: "text-amber-600", bg: "bg-amber-100/60", label: t("emp.totalCesantias"), value: formatCOP(totals.cesantias), sub: t("emp.perYear") },
  ];

  return (
    <div className="space-y-8 pb-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-primary mb-1">{t("emp.title")}</h1>
          <p className="text-muted-foreground">{t("emp.subtitle")}</p>
        </div>
        <Button onClick={openAdd} className="rounded-xl bg-primary hover:bg-primary/90 shadow-sm hover-elevate">
          <Plus className="h-4 w-4 mr-2" /> {t("emp.addEmployee")}
        </Button>
      </header>

      {/* ── Top summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {topCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm bg-card/60 h-full">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${card.bg} flex-shrink-0`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{card.label}</p>
                  <p className="text-2xl font-serif font-bold text-foreground leading-tight">{card.value}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Prestaciones sociales totals ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("emp.obligationsTitle")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {benefitCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
              <Card className="p-4 rounded-2xl border-border/50 shadow-sm bg-card/60 h-full">
                <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center mb-2`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{card.label}</p>
                <p className="text-base font-serif font-bold text-foreground leading-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground/70">{card.sub}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Employee list ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : employees.length === 0 ? (
        <Card className="rounded-2xl border-border/50 p-16 flex flex-col items-center text-center text-muted-foreground gap-4">
          <div className="p-5 bg-muted/30 rounded-2xl">
            <Users className="h-10 w-10 text-border" />
          </div>
          <div>
            <p className="font-semibold text-foreground/70 mb-1">{t("emp.noEmployees")}</p>
            <p className="text-sm">{t("emp.noEmployeesDesc")}</p>
          </div>
          <Button onClick={openAdd} variant="outline" className="mt-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5">
            <Plus className="h-4 w-4 mr-2" /> {t("emp.addEmployee")}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {employees.map((emp, i) => {
            const isExpanded = expandedId === emp.id;
            const hasBenefits = num(emp.pension) + num(emp.salud) + num(emp.arl) + num(emp.primas) + num(emp.cesantias) > 0;
            return (
              <motion.div key={emp.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow bg-card/60 overflow-hidden">
                  {/* Main row */}
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-serif font-bold text-primary">
                            {emp.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-lg leading-tight">{emp.name}</p>
                          {emp.startDate && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {t("emp.since")} {format(new Date(emp.startDate + "T12:00:00"), isEn ? "MMM d, yyyy" : "d 'de' MMMM yyyy", { locale: isEn ? undefined : es })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Contact info */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm flex-shrink-0">
                        {emp.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{emp.phone}</span>
                          </div>
                        )}
                        {emp.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                        )}
                        {emp.bankAccount && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{emp.bankName} · {emp.bankAccount}</span>
                          </div>
                        )}
                      </div>

                      {/* Salary + actions */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("emp.monthly")}</p>
                          <p className="text-lg font-serif font-bold text-secondary">
                            {formatCOP(num(emp.monthlySalary))}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasBenefits && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                              className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
                              title={isExpanded ? t("emp.hideBenefits") : t("emp.viewBenefits")}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}
                          <button onClick={() => openEdit(emp)} className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteConfirm(emp.id)} className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable benefits panel */}
                  <AnimatePresence>
                    {isExpanded && hasBenefits && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <Separator />
                        <div className="px-5 py-4 bg-muted/20">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("emp.benefitsSection")}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {[
                              { label: t("emp.pension"), value: num(emp.pension), sub: t("emp.perMonth"), icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-100/60" },
                              { label: t("emp.salud"), value: num(emp.salud), sub: t("emp.perMonth"), icon: HeartPulse, color: "text-rose-500", bg: "bg-rose-100/60" },
                              { label: t("emp.arl"), value: num(emp.arl), sub: t("emp.perMonth"), icon: ShieldCheck, color: "text-orange-500", bg: "bg-orange-100/60" },
                              { label: t("emp.primas"), value: num(emp.primas), sub: t("emp.perSemester"), icon: Receipt, color: "text-violet-600", bg: "bg-violet-100/60" },
                              { label: t("emp.cesantias"), value: num(emp.cesantias), sub: t("emp.perYear"), icon: Coins, color: "text-amber-600", bg: "bg-amber-100/60" },
                            ].map(b => (
                              <div key={b.label} className="bg-card/70 rounded-xl px-3 py-2.5 border border-border/30 flex items-start gap-2">
                                <div className={`p-1.5 rounded-lg ${b.bg} mt-0.5 flex-shrink-0`}>
                                  <b.icon className={`h-3.5 w-3.5 ${b.color}`} />
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">{b.label}</p>
                                  <p className="text-sm font-semibold text-foreground">{formatCOP(b.value)}</p>
                                  <p className="text-xs text-muted-foreground/60">{b.sub}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-primary text-xl">
              {editEmployee ? t("emp.editEmployee") : t("emp.addEmployee")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Basic info */}
            <div>
              <Label>{t("emp.name")} *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="rounded-xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("emp.phone")}</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl mt-1" placeholder="+57 300 000 0000" />
              </div>
              <div>
                <Label>{t("emp.email")}</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="rounded-xl mt-1" placeholder="correo@ejemplo.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("emp.startDate")}</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label>{t("emp.salary")}</Label>
                <Input type="number" value={form.monthlySalary} onChange={e => setForm(f => ({ ...f, monthlySalary: e.target.value }))} className="rounded-xl mt-1" placeholder="0" min={0} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("emp.bankName")}</Label>
                <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label>{t("emp.bankAccount")}</Label>
                <Input value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} className="rounded-xl mt-1" placeholder="000-000000-00" />
              </div>
            </div>
            <div>
              <Label>{t("emp.notes")}</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl mt-1" />
            </div>

            {/* ── Prestaciones Sociales ── */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{t("emp.benefitsSection")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 border-secondary/30 text-secondary hover:bg-secondary/5"
                  onClick={handleAutoCalc}
                  disabled={!form.monthlySalary}
                >
                  <Calculator className="h-3.5 w-3.5" />
                  {t("emp.autoCalc")}
                </Button>
              </div>
              {!form.monthlySalary && (
                <p className="text-xs text-muted-foreground">{t("emp.autoCalcHint")}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                    {t("emp.pension")} <span className="text-muted-foreground font-normal">{t("emp.perMonth")}</span>
                  </Label>
                  <Input type="number" value={form.pension} onChange={e => setForm(f => ({ ...f, pension: e.target.value }))} className="rounded-xl mt-1" placeholder="0" min={0} />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                    {t("emp.salud")} <span className="text-muted-foreground font-normal">{t("emp.perMonth")}</span>
                  </Label>
                  <Input type="number" value={form.salud} onChange={e => setForm(f => ({ ...f, salud: e.target.value }))} className="rounded-xl mt-1" placeholder="0" min={0} />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-orange-500" />
                    {t("emp.arl")} <span className="text-muted-foreground font-normal">{t("emp.perMonth")}</span>
                  </Label>
                  <Input type="number" value={form.arl} onChange={e => setForm(f => ({ ...f, arl: e.target.value }))} className="rounded-xl mt-1" placeholder="0" min={0} />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-violet-600" />
                    {t("emp.primas")} <span className="text-muted-foreground font-normal">{t("emp.perSemester")}</span>
                  </Label>
                  <Input type="number" value={form.primas} onChange={e => setForm(f => ({ ...f, primas: e.target.value }))} className="rounded-xl mt-1" placeholder="0" min={0} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-amber-600" />
                    {t("emp.cesantias")} <span className="text-muted-foreground font-normal">{t("emp.perYear")}</span>
                  </Label>
                  <Input type="number" value={form.cesantias} onChange={e => setForm(f => ({ ...f, cesantias: e.target.value }))} className="rounded-xl mt-1" placeholder="0" min={0} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={closeDialog}>{t("common.cancel")}</Button>
              <Button type="submit" className="flex-1 rounded-xl bg-primary hover:bg-primary/90" disabled={isPending || !form.name.trim()}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">{t("emp.confirmDelete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("emp.confirmDeleteDesc")}</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirm(null)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              onClick={() => deleteConfirm && deleteEmployee.mutate(deleteConfirm)}
              disabled={deleteEmployee.isPending}
            >
              {deleteEmployee.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t("emp.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
