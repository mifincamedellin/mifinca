import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useUpgradeStore, type UpgradeResource } from "@/lib/upgradeStore";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  PawPrint,
  Users,
  UserCheck,
  Map,
  Check,
  X,
  Sprout,
  Tractor,
  Star,
  ArrowRight,
} from "lucide-react";

const RESOURCE_META: Record<UpgradeResource, { icon: React.ElementType; colorClass: string }> = {
  animals:   { icon: PawPrint,  colorClass: "text-emerald-600" },
  employees: { icon: UserCheck, colorClass: "text-blue-600" },
  contacts:  { icon: Users,     colorClass: "text-purple-600" },
  farms:     { icon: Map,       colorClass: "text-orange-600" },
};

interface FeatureRow {
  labelEs: string;
  labelEn: string;
  seed: string;
  paid: string;
  highlight?: boolean;
}

const FEATURES: FeatureRow[] = [
  { labelEs: "Animales",       labelEn: "Animals",    seed: "10",         paid: "Ilimitados / Unlimited", highlight: false },
  { labelEs: "Empleados",      labelEn: "Employees",  seed: "1",          paid: "Ilimitados / Unlimited", highlight: false },
  { labelEs: "Contactos",      labelEn: "Contacts",   seed: "1",          paid: "Ilimitados / Unlimited", highlight: false },
  { labelEs: "Fincas",         labelEn: "Farms",      seed: "1",          paid: "Ilimitadas / Unlimited", highlight: false },
  { labelEs: "Finanzas",       labelEn: "Finances",   seed: "✓",          paid: "✓",                      highlight: false },
  { labelEs: "Inventario",     labelEn: "Inventory",  seed: "✓",          paid: "✓",                      highlight: false },
  { labelEs: "Soporte",        labelEn: "Support",    seed: "Básico",     paid: "Prioritario / Priority", highlight: false },
];

export function UpgradeModal() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { open, resource, limit, closeUpgradeModal } = useUpgradeStore();
  const isEn = i18n.language === "en";

  const meta = resource ? RESOURCE_META[resource] : null;
  const Icon = meta?.icon ?? Sprout;

  const resourceLabel: Record<UpgradeResource, { es: string; en: string }> = {
    animals:   { es: "animales",  en: "animals" },
    employees: { es: "empleados", en: "employees" },
    contacts:  { es: "contactos", en: "contacts" },
    farms:     { es: "fincas",    en: "farms" },
  };

  const triggerLabel = resource ? (isEn ? resourceLabel[resource].en : resourceLabel[resource].es) : "";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) closeUpgradeModal(); }}>
      <DialogContent className="p-0 rounded-3xl overflow-hidden max-w-lg border-0 shadow-2xl gap-0">

        {/* ── Header ── */}
        <div className="relative bg-gradient-to-br from-primary via-primary/90 to-secondary/80 px-8 pt-8 pb-10 text-primary-foreground overflow-hidden">
          {/* decorative circles */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />

          <div className="relative flex flex-col items-center text-center gap-3">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 mb-1">
              <Icon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-serif font-bold leading-snug">
              {isEn ? "Unlock your farm's full potential" : "Desbloquea todo el potencial de tu finca"}
            </h2>
            {resource && limit !== null && (
              <p className="text-sm text-white/75 max-w-xs leading-relaxed">
                {isEn
                  ? `You've reached the ${limit}-${triggerLabel} limit on the Seed plan.`
                  : `Llegaste al límite de ${limit} ${triggerLabel} del plan Semilla.`}
                {" "}
                {isEn ? "Upgrade to keep growing." : "Actualiza para seguir creciendo."}
              </p>
            )}
          </div>
        </div>

        {/* ── Feature comparison ── */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {isEn ? "What you unlock" : "Qué desbloqueas"}
          </p>
          <div className="rounded-2xl border border-border/60 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-3 bg-muted/40 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
              <span>{isEn ? "Feature" : "Función"}</span>
              <span className="text-center flex items-center justify-center gap-1">
                <Sprout className="h-3 w-3" /> {isEn ? "Seed" : "Semilla"}
              </span>
              <span className="text-center flex items-center justify-center gap-1 text-primary">
                <Tractor className="h-3 w-3" /> {isEn ? "Farm / Pro" : "Finca / Pro"}
              </span>
            </div>
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 px-4 py-2.5 text-sm border-t border-border/40 ${
                  resource && (
                    (resource === "animals"   && f.labelEn === "Animals") ||
                    (resource === "employees" && f.labelEn === "Employees") ||
                    (resource === "contacts"  && f.labelEn === "Contacts") ||
                    (resource === "farms"     && f.labelEn === "Farms")
                  ) ? "bg-primary/5 font-medium" : ""
                }`}
              >
                <span className="text-foreground/80">{isEn ? f.labelEn : f.labelEs}</span>
                <span className="text-center text-muted-foreground">{f.seed}</span>
                <span className="text-center text-primary font-medium">{f.paid}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Pricing pills ── */}
        <div className="px-6 pt-4 pb-1 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border/50 bg-card p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Tractor className="h-4 w-4 text-secondary" />
              <span className="text-sm font-semibold">{isEn ? "Farm" : "Finca"}</span>
            </div>
            <p className="text-lg font-bold text-primary">400.000 <span className="text-xs font-normal text-muted-foreground">COP/{isEn ? "mo" : "mes"}</span></p>
            <ul className="mt-1 space-y-0.5">
              {["✓ Animales ilimitados", "✓ Empleados ilimitados", "✓ Multifinca"].map(b => (
                <li key={b} className="text-xs text-muted-foreground">{b}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-col gap-1 relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5" /> {isEn ? "Best value" : "Mejor valor"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <Star className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Pro</span>
            </div>
            <p className="text-lg font-bold text-primary">4.000.000 <span className="text-xs font-normal text-muted-foreground">COP/{isEn ? "yr" : "año"}</span></p>
            <ul className="mt-1 space-y-0.5">
              {["✓ Todo en Finca", "✓ Soporte prioritario", "✓ 2 meses gratis"].map(b => (
                <li key={b} className="text-xs text-muted-foreground">{b}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="px-6 pt-4 pb-6 flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={closeUpgradeModal}>
            {isEn ? "Maybe later" : "Más tarde"}
          </Button>
          <Button
            className="flex-1 rounded-xl gap-2 font-semibold"
            onClick={() => { closeUpgradeModal(); setLocation("/settings"); }}
          >
            {isEn ? "See plans" : "Ver planes"} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
