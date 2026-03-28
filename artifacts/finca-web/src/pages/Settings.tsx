import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetFarm, useUpdateFarm } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const farmSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional(),
  totalHectares: z.coerce.number().optional(),
});

export function Settings() {
  const { t } = useTranslation();
  const { activeFarmId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: farm } = useGetFarm(activeFarmId || '', {
    query: { enabled: !!activeFarmId }
  });

  const updateFarm = useUpdateFarm();

  const form = useForm<z.infer<typeof farmSchema>>({
    resolver: zodResolver(farmSchema),
    defaultValues: { name: "", location: "", totalHectares: 0 }
  });

  useEffect(() => {
    if (farm) {
      form.reset({
        name: farm.name,
        location: farm.location || "",
        totalHectares: farm.totalHectares || 0,
      });
    }
  }, [farm, form]);

  const onSubmit = (data: z.infer<typeof farmSchema>) => {
    if (!activeFarmId) return;
    updateFarm.mutate({ 
      farmId: activeFarmId, 
      data 
    }, {
      onSuccess: () => {
        toast({ title: t('settings.saved'), description: t('settings.savedDesc') });
        queryClient.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/farms`] });
      },
      onError: () => {
        toast({ variant: "destructive", title: t('common.error'), description: t('settings.errorDesc') });
      }
    });
  };

  if (!activeFarmId) return null;

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
          <SettingsIcon className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-serif text-primary font-bold">{t('nav.settings')}</h1>
          <p className="text-muted-foreground">{t('settings.subtitle')}</p>
        </div>
      </div>

      <Card className="p-8 rounded-2xl border-none shadow-md bg-card/60 backdrop-blur-sm">
        <h2 className="text-2xl font-serif text-primary mb-6 border-b border-border/50 pb-4">{t('settings.farmDetails')}</h2>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label className="text-foreground">{t('settings.farmName')}</Label>
            <Input {...form.register("name")} className="rounded-xl py-6 bg-white/50" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-foreground">{t('settings.location')}</Label>
              <Input {...form.register("location")} placeholder="Ciudad, Región" className="rounded-xl py-6 bg-white/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t('settings.hectares')}</Label>
              <Input type="number" step="0.1" {...form.register("totalHectares")} className="rounded-xl py-6 bg-white/50" />
            </div>
          </div>
          <Button 
            type="submit" 
            disabled={updateFarm.isPending || !form.formState.isDirty} 
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6"
          >
            {updateFarm.isPending ? t('settings.saving') : t('common.save')}
          </Button>
        </form>
      </Card>

      <Card className="p-8 rounded-2xl border border-destructive/20 shadow-sm bg-destructive/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 rounded-bl-full -z-10" />
        <h2 className="text-xl font-serif text-destructive mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> {t('settings.dangerZone')}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">{t('settings.dangerDesc')}</p>
        <Button variant="destructive" className="rounded-xl hover-elevate">
          {t('settings.deleteFarm')}
        </Button>
      </Card>
    </div>
  );
}
