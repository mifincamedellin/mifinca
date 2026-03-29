import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetFarm, useUpdateFarm } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Settings as SettingsIcon, AlertTriangle, User, CreditCard,
  Star, Check, Plus, Trash2, Mail, Pencil, X,
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

const emailSchema = z.object({
  email: z.string().email(),
});

const PLANS = [
  {
    key: "basic",
    labelEs: "Básico",
    labelEn: "Basic",
    price: "Gratis",
    color: "bg-muted/60 text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
    features: ["1 finca", "Hasta 50 animales", "Inventario básico", "Soporte comunitario"],
    featuresEn: ["1 farm", "Up to 50 animals", "Basic inventory", "Community support"],
    current: true,
  },
  {
    key: "pro",
    labelEs: "Pro",
    labelEn: "Pro",
    price: "$29/mes",
    color: "bg-secondary/10 border-secondary",
    badge: "bg-secondary text-white",
    features: ["Fincas ilimitadas", "Animales ilimitados", "IA Asistente avanzada", "Finanzas y reportes", "Soporte prioritario"],
    featuresEn: ["Unlimited farms", "Unlimited animals", "Advanced AI Assistant", "Finances & reports", "Priority support"],
    current: false,
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
  const [editingEmail, setEditingEmail] = useState(false);
  const [paymentMethods] = useState<PaymentMethod[]>(DEMO_PAYMENT_METHODS);

  const { data: farm } = useGetFarm(activeFarmId || '', {
    query: { enabled: !!activeFarmId }
  });

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ id: string; fullName: string; email: string; role: string; preferredLanguage: string }>;
    },
  });

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

  const updateEmail = useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await fetch("/api/auth/email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "failed");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchProfile();
      setEditingEmail(false);
      toast({ title: t("settings.saved"), description: t("settings.emailSavedDesc") });
    },
    onError: (err: Error) => {
      const msg = err.message === "Email already in use"
        ? t("settings.emailInUse")
        : t("settings.errorDesc");
      toast({ variant: "destructive", title: t("common.error"), description: msg });
    },
  });

  const farmForm = useForm<z.infer<typeof farmSchema>>({
    resolver: zodResolver(farmSchema),
    defaultValues: { name: "", location: "", totalHectares: 0 }
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { fullName: "" }
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" }
  });

  useEffect(() => {
    if (farm) farmForm.reset({ name: farm.name, location: farm.location || "", totalHectares: farm.totalHectares || 0 });
  }, [farm]);

  useEffect(() => {
    if (profile) {
      accountForm.reset({ fullName: profile.fullName || "" });
      emailForm.reset({ email: profile.email || "" });
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
                  className="rounded-xl bg-primary hover:bg-primary/90 px-6 py-6"
                >
                  {updateProfile.isPending ? t("settings.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          </form>

          {/* Email */}
          <div className="space-y-2">
            <Label className="text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" /> {t("settings.email")}
            </Label>
            {editingEmail ? (
              <form onSubmit={emailForm.handleSubmit((d) => updateEmail.mutate(d))} className="flex gap-3">
                <Input
                  {...emailForm.register("email")}
                  type="email"
                  className="rounded-xl py-6 bg-white/50 flex-1"
                  placeholder="correo@ejemplo.com"
                />
                <Button
                  type="submit"
                  disabled={updateEmail.isPending}
                  className="rounded-xl bg-primary hover:bg-primary/90 px-6 py-6"
                >
                  {updateEmail.isPending ? t("settings.saving") : t("common.save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl py-6 px-4"
                  onClick={() => { setEditingEmail(false); emailForm.reset({ email: profile?.email || "" }); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl border border-border/50 bg-muted/30 px-4 py-[14px] text-sm text-foreground">
                  {profile?.email ?? "—"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl py-6 px-4 border-border/50"
                  onClick={() => setEditingEmail(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── SUBSCRIPTION PLAN ── */}
      <Card className="p-8 rounded-2xl border-none shadow-md bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
          <Star className="h-5 w-5 text-secondary" />
          <h2 className="text-2xl font-serif text-primary">{t("settings.plan")}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl border-2 p-6 transition-all ${
                plan.current
                  ? "border-primary/30 bg-primary/5"
                  : "border-secondary/30 bg-secondary/5 hover:border-secondary/60"
              }`}
            >
              {plan.current && (
                <Badge className="absolute top-4 right-4 bg-primary/10 text-primary border-primary/20 text-xs">
                  {t("settings.currentPlan")}
                </Badge>
              )}
              <p className="text-lg font-bold text-foreground mb-1">
                {lang === "en" ? plan.labelEn : plan.labelEs}
              </p>
              <p className="text-2xl font-serif text-primary mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-6">
                {(lang === "en" ? plan.featuresEn : plan.features).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-secondary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!plan.current && (
                <Button className="w-full rounded-xl bg-secondary hover:bg-secondary/90 text-white">
                  {t("settings.upgrade")}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* ── PAYMENT METHODS ── */}
      <Card className="p-8 rounded-2xl border-none shadow-md bg-card/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-serif text-primary">{t("settings.paymentMethods")}</h2>
          </div>
          <Button variant="outline" className="rounded-xl border-secondary/40 text-secondary hover:bg-secondary/5 gap-2">
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
    </div>
  );
}
