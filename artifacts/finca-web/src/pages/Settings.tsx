import { useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetFarm, useUpdateFarm } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings as SettingsIcon, AlertTriangle, User, CreditCard,
  Star, Check, Plus, Trash2, Mail, Lock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

const farmSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional(),
  totalHectares: z.coerce.number().optional(),
});

const accountSchema = z.object({
  fullName: z.string().min(1),
});

const PLAN_DEFS = [
  {
    key: "seed",
    labelEs: "Semilla",
    labelEn: "Seed",
    priceEs: "Gratis",
    priceEn: "Free",
    features: ["1 finca", "10 animales", "1 empleado", "1 contacto"],
    featuresEn: ["1 farm", "10 animals", "1 employee", "1 contact"],
  },
  {
    key: "farm",
    labelEs: "Farm",
    labelEn: "Farm",
    priceEs: "400.000 COP/mes",
    priceEn: "400,000 COP/mo",
    features: ["1 finca", "Animales ilimitados", "Empleados ilimitados", "Asesor IA incluido", "Soporte estándar"],
    featuresEn: ["1 farm", "Unlimited animals", "Unlimited employees", "AI Advisor included", "Standard support"],
  },
  {
    key: "pro",
    labelEs: "Pro",
    labelEn: "Pro",
    priceEs: "4.000.000 COP/año",
    priceEn: "4,000,000 COP/yr",
    features: ["Fincas ilimitadas", "Animales ilimitados", "Reportes personalizados", "Soporte prioritario"],
    featuresEn: ["Unlimited farms", "Unlimited animals", "Custom reports", "Priority support"],
  },
];

type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

const DEMO_PAYMENT_METHODS: PaymentMethod[] = [];

export function Settings() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEMO_PAYMENT_METHODS);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardSaving, setCardSaving] = useState(false);

  const search = useSearch();
  useEffect(() => {
    if (search.includes("section=plan")) {
      const el = document.getElementById("subscription-plan");
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [search]);

  const formatCardNumber = (val: string) =>
    val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    return digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  const detectBrand = (num: string) => {
    const n = num.replace(/\s/g, "");
    if (/^4/.test(n)) return "visa";
    if (/^5[1-5]/.test(n)) return "mastercard";
    if (/^3[47]/.test(n)) return "amex";
    return "card";
  };

  const handleAddCard = () => {
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 16 || !cardHolder.trim() || cardExpiry.length < 5 || cardCvv.length < 3) return;
    setCardSaving(true);
    setTimeout(() => {
      const [month, year] = cardExpiry.split("/");
      const newCard: PaymentMethod = {
        id: crypto.randomUUID(),
        brand: detectBrand(cardNumber),
        last4: digits.slice(-4),
        expMonth: parseInt(month, 10),
        expYear: parseInt(`20${year}`, 10),
        isDefault: paymentMethods.length === 0,
      };
      setPaymentMethods((prev) => [...prev, newCard]);
      setCardNumber(""); setCardHolder(""); setCardExpiry(""); setCardCvv("");
      setCardSaving(false);
      setAddCardOpen(false);
      toast({ title: t("settings.addCard"), description: `•••• ${newCard.last4}` });
    }, 800);
  };

  const { data: farm } = useGetFarm(activeFarmId || '', {
    query: { enabled: !!activeFarmId }
  });

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ id: string; fullName: string; email: string; role: string; preferredLanguage: string; plan: string }>;
    },
  });

  const { data: farmStats } = useQuery({
    queryKey: [`/api/farms/${activeFarmId}/stats`],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/stats`);
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ totalAnimals: number; employeeCount: number; contactCount: number }>;
    },
    enabled: !!activeFarmId,
  });

  const { data: farms } = useQuery({
    queryKey: ["/api/farms"],
    queryFn: async () => {
      const res = await fetch("/api/farms");
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ id: string }[]>;
    },
  });

  const currentPlanKey = (profile?.plan ?? "seed") as "seed" | "farm" | "pro";
  const planUsage = {
    farms: farms?.length ?? 0,
    animals: farmStats?.totalAnimals ?? 0,
    employees: farmStats?.employeeCount ?? 0,
    contacts: farmStats?.contactCount ?? 0,
  };
  const planLimits = { seed: { farms: 1, animals: 10, employees: 1, contacts: 1 }, farm: { farms: 1, animals: null, employees: null, contacts: null }, pro: { farms: null, animals: null, employees: null, contacts: null } };

  const updateFarm = useUpdateFarm();

  const updateProfile = useMutation({
    mutationFn: async (data: { fullName: string }) => {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => {
      refetchProfile();
      toast({ title: t("settings.saved"), description: t("settings.accountSavedDesc") });
    },
    onError: () => toast({ variant: "destructive", title: t("common.error"), description: t("settings.errorDesc") }),
  });

  const farmForm = useForm<z.infer<typeof farmSchema>>({
    resolver: zodResolver(farmSchema),
    defaultValues: { name: "", location: "", totalHectares: 0 }
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { fullName: "" }
  });

  useEffect(() => {
    if (farm) farmForm.reset({ name: farm.name, location: farm.location || "", totalHectares: farm.totalHectares || 0 });
  }, [farm]);

  useEffect(() => {
    if (profile) {
      accountForm.reset({ fullName: profile.fullName || "" });
    }
  }, [profile]);

  const onFarmSubmit = (data: z.infer<typeof farmSchema>) => {
    if (!activeFarmId) return;
    updateFarm.mutate({ farmId: activeFarmId, data }, {
      onSuccess: () => {
        toast({ title: t("settings.saved"), description: t("settings.savedDesc") });
        queryClient.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/farms`] });
      },
      onError: () => toast({ variant: "destructive", title: t("common.error"), description: t("settings.errorDesc") }),
    });
  };

  if (!activeFarmId) return null;
  const lang = i18n.language === "en" ? "en" : "es";

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
          <SettingsIcon className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">{t("nav.settings")}</h1>
          <p className="text-muted-foreground">{t("settings.subtitle")}</p>
        </div>
      </div>

      {/* ── FARM DETAILS ── */}
      <Card className="p-8 rounded-2xl border-none shadow-md bg-card/60 backdrop-blur-sm">
        <h2 className="text-2xl font-serif text-primary mb-6 border-b border-border/50 pb-4">{t("settings.farmDetails")}</h2>
        <form onSubmit={farmForm.handleSubmit(onFarmSubmit)} className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label className="text-foreground">{t("settings.farmName")}</Label>
            <Input {...farmForm.register("name")} className="rounded-xl py-6 bg-white/50" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-foreground">{t("settings.location")}</Label>
              <Input {...farmForm.register("location")} placeholder="Ciudad, Región" className="rounded-xl py-6 bg-white/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t("settings.hectares")}</Label>
              <Input type="number" step="0.1" {...farmForm.register("totalHectares")} className="rounded-xl py-6 bg-white/50" />
            </div>
          </div>
          <Button
            type="submit"
            disabled={updateFarm.isPending || !farmForm.formState.isDirty}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6"
          >
            {updateFarm.isPending ? t("settings.saving") : t("common.save")}
          </Button>
        </form>
      </Card>

      {/* ── ACCOUNT ── */}
      <Card className="p-8 rounded-2xl border-none shadow-md bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-serif text-primary">{t("settings.account")}</h2>
        </div>

        <div className="space-y-6 max-w-2xl">
          {/* Name */}
          <form onSubmit={accountForm.handleSubmit((d) => updateProfile.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">{t("settings.fullName")}</Label>
              <div className="flex gap-3">
                <Input {...accountForm.register("fullName")} className="rounded-xl py-6 bg-white/50 flex-1" />
                <Button
                  type="submit"
                  disabled={updateProfile.isPending || !accountForm.formState.isDirty}
                  className="rounded-xl bg-primary hover:bg-primary/90 px-6 self-stretch"
                >
                  {updateProfile.isPending ? t("settings.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          </form>

          {/* Email — read-only (managed by Google) */}
          <div className="space-y-2">
            <Label className="text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" /> {t("settings.email")}
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-xl border border-border/50 bg-muted/30 px-4 py-[14px] text-sm text-foreground">
                {profile?.email ?? "—"}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                <img src="https://www.google.com/favicon.ico" alt="Google" className="h-3.5 w-3.5 rounded-sm" />
                {lang === "en" ? "Managed by Google" : "Gestionado por Google"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── SUBSCRIPTION PLAN ── */}
      <Card id="subscription-plan" className="p-8 rounded-2xl border-none shadow-md bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
          <Star className="h-5 w-5 text-secondary" />
          <h2 className="text-2xl font-serif text-primary">{t("settings.plan")}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
          {PLAN_DEFS.map((plan) => {
            const isCurrent = plan.key === currentPlanKey;
            const limits = planLimits[plan.key as keyof typeof planLimits];
            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all ${
                  isCurrent
                    ? "border-secondary/50 bg-secondary/5"
                    : "border-primary bg-primary text-primary-foreground"
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20 text-xs">
                    {t("settings.currentPlan")}
                  </Badge>
                )}
                <p className={`text-lg font-bold mb-1 ${isCurrent ? "text-foreground" : "text-primary-foreground"}`}>
                  {lang === "en" ? plan.labelEn : plan.labelEs}
                </p>
                <p className={`text-2xl font-serif mb-4 ${isCurrent ? "text-primary" : "text-primary-foreground"}`}>
                  {lang === "en" ? plan.priceEn : plan.priceEs}
                </p>
                <ul className="space-y-2 flex-1">
                  {(lang === "en" ? plan.featuresEn : plan.features).map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${isCurrent ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
                      <Check className={`h-4 w-4 flex-shrink-0 ${isCurrent ? "text-secondary" : "text-primary-foreground"}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Usage bars — only shown on current Seed plan */}
                {isCurrent && plan.key === "seed" && (
                  <div className="mt-5 pt-4 border-t border-border/50 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {lang === "en" ? "Usage" : "Uso"}
                    </p>
                    {([
                      { label: lang === "en" ? "Farms" : "Fincas", used: planUsage.farms, max: limits.farms },
                      { label: lang === "en" ? "Animals" : "Animales", used: planUsage.animals, max: limits.animals },
                      { label: lang === "en" ? "Employees" : "Empleados", used: planUsage.employees, max: limits.employees },
                      { label: lang === "en" ? "Contacts" : "Contactos", used: planUsage.contacts, max: limits.contacts },
                    ] as { label: string; used: number; max: number | null }[]).map(({ label, used, max }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={`font-semibold ${max !== null && used >= max ? "text-destructive" : "text-foreground"}`}>
                            {used} / {max ?? "∞"}
                          </span>
                        </div>
                        {max !== null && (
                          <div className="w-full bg-border/40 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all ${used >= max ? "bg-destructive" : "bg-secondary"}`}
                              style={{ width: `${Math.min(100, (used / max) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!isCurrent && (
                  <Button
                    className="mt-5 w-full rounded-xl bg-white text-primary hover:bg-white/90 font-medium"
                    onClick={() => {}}
                  >
                    {lang === "en"
                      ? `Upgrade to ${plan.labelEn}`
                      : `Actualizar a ${plan.labelEs}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── PAYMENT METHODS ── */}
      <Card className="p-8 rounded-2xl border-none shadow-md bg-card/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-serif text-primary">{t("settings.paymentMethods")}</h2>
          </div>
          <Button variant="outline" onClick={() => setAddCardOpen(true)} className="rounded-xl border-secondary/40 text-secondary hover:bg-secondary/5 gap-2">
            <Plus className="h-4 w-4" /> {t("settings.addCard")}
          </Button>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t("settings.noPaymentMethods")}</p>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">{t("settings.noPaymentMethodsDesc")}</p>
            <Button
              variant="outline"
              onClick={() => setAddCardOpen(true)}
              className="mt-4 rounded-xl border-secondary/40 text-secondary hover:bg-secondary/5 gap-2"
            >
              <Plus className="h-4 w-4" /> {t("settings.addCard")}
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {paymentMethods.map((pm) => (
              <li key={pm.id} className="flex items-center justify-between rounded-xl border border-border/40 bg-white/50 px-5 py-4">
                <div className="flex items-center gap-4">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm capitalize">{pm.brand} •••• {pm.last4}</p>
                    <p className="text-xs text-muted-foreground">{t("settings.expires")} {pm.expMonth}/{pm.expYear}</p>
                  </div>
                  {pm.isDefault && (
                    <Badge variant="secondary" className="text-xs">{t("settings.default")}</Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive rounded-xl">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── DANGER ZONE ── */}
      <Card className="p-8 rounded-2xl border border-destructive/20 shadow-sm bg-destructive/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 rounded-bl-full -z-10" />
        <h2 className="text-xl font-serif text-destructive mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> {t("settings.dangerZone")}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">{t("settings.dangerDesc")}</p>
        <Button variant="destructive" className="rounded-xl hover-elevate">
          {t("settings.deleteFarm")}
        </Button>
      </Card>

      {/* ── ADD CARD DIALOG ── */}
      <Dialog open={addCardOpen} onOpenChange={setAddCardOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> {t("settings.addCardTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Card number */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("settings.cardNumber")}</Label>
              <div className="relative">
                <Input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder={t("settings.cardNumberPlaceholder")}
                  className="rounded-xl pr-12 tracking-widest font-mono"
                  inputMode="numeric"
                  maxLength={19}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium uppercase">
                  {detectBrand(cardNumber) !== "card" ? detectBrand(cardNumber) : ""}
                </span>
              </div>
            </div>

            {/* Cardholder */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("settings.cardHolder")}</Label>
              <Input
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                placeholder={t("settings.cardHolderPlaceholder")}
                className="rounded-xl uppercase tracking-wide"
                maxLength={26}
              />
            </div>

            {/* Expiry + CVV */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">{t("settings.cardExpiry")}</Label>
                <Input
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder={t("settings.cardExpiryPlaceholder")}
                  className="rounded-xl font-mono"
                  inputMode="numeric"
                  maxLength={5}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  {t("settings.cardCvv")}
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </Label>
                <Input
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="•••"
                  className="rounded-xl font-mono"
                  inputMode="numeric"
                  type="password"
                  maxLength={4}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setAddCardOpen(false)}
                disabled={cardSaving}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="flex-1 rounded-xl bg-secondary hover:bg-secondary/90 text-white"
                onClick={handleAddCard}
                disabled={
                  cardSaving ||
                  cardNumber.replace(/\s/g, "").length < 16 ||
                  !cardHolder.trim() ||
                  cardExpiry.length < 5 ||
                  cardCvv.length < 3
                }
              >
                {cardSaving ? t("common.saving") : t("settings.cardSave")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
