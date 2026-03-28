import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useListInventoryItems, useCreateInventoryItem } from "@workspace/api-client-react";
import type { InventoryItem, CreateInventoryItemRequest } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, PackageOpen, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const createItemSchema = z.object({
  name: z.string().min(2),
  category: z.enum(["feed", "medicine", "tools", "supplies"]),
  quantity: z.coerce.number().min(0),
  unit: z.enum(["kg", "liters", "units", "bags", "doses", "other"]),
  lowStockThreshold: z.coerce.number().optional(),
});

export function InventoryList() {
  const { t } = useTranslation();
  const { activeFarmId } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useListInventoryItems(
    activeFarmId || '', 
    { 
      search: search || undefined,
      category: category !== "all" ? category : undefined 
    }, 
    { query: { enabled: !!activeFarmId } }
  );

  const createItem = useCreateInventoryItem();

  const form = useForm<z.infer<typeof createItemSchema>>({
    resolver: zodResolver(createItemSchema),
    defaultValues: { category: "feed", unit: "kg" }
  });

  const onSubmit = (data: z.infer<typeof createItemSchema>) => {
    if (!activeFarmId) return;
    createItem.mutate({ 
      farmId: activeFarmId, 
      data: data as CreateInventoryItemRequest
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/inventory`] });
      }
    });
  };

  if (!activeFarmId) return null;

  const getStatusColor = (status: string | undefined, qty: number, threshold?: number) => {
    if (status === 'expired') return 'bg-destructive/10 text-destructive border-destructive/20';
    if (status === 'low' || (threshold && qty <= threshold)) return 'bg-accent/10 text-accent border-accent/20';
    return 'bg-secondary/10 text-secondary border-secondary/20';
  };

  const getStatusLabel = (status: string | undefined, qty: number, threshold?: number) => {
    if (status === 'expired') return t('inventory.status.expired');
    if (status === 'low' || (threshold && qty <= threshold)) return t('inventory.status.low');
    return t('inventory.status.ok');
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-serif text-primary font-bold">{t('nav.inventory')}</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl px-6 bg-primary hover:bg-primary/90 hover-elevate shadow-md">
              <Plus className="mr-2 h-4 w-4" /> {t('inventory.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary">{t('inventory.add')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inventory.productName')}</FormLabel>
                    <FormControl><Input {...field} className="rounded-xl"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('inventory.category')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="feed">{t('inventory.cat.feed')}</SelectItem>
                          <SelectItem value="medicine">{t('inventory.cat.medicine')}</SelectItem>
                          <SelectItem value="tools">{t('inventory.cat.tools')}</SelectItem>
                          <SelectItem value="supplies">{t('inventory.cat.supplies')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('inventory.unit')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="kg">{t('inventory.unit.kg')}</SelectItem>
                          <SelectItem value="liters">{t('inventory.unit.liters')}</SelectItem>
                          <SelectItem value="units">{t('inventory.unit.units')}</SelectItem>
                          <SelectItem value="bags">{t('inventory.unit.bags')}</SelectItem>
                          <SelectItem value="doses">{t('inventory.unit.doses')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('inventory.quantity')}</FormLabel>
                      <FormControl><Input type="number" {...field} className="rounded-xl"/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('inventory.minAlert')}</FormLabel>
                      <FormControl><Input type="number" {...field} className="rounded-xl" placeholder={t('common.optional')}/></FormControl>
                    </FormItem>
                  )}/>
                </div>
                <Button type="submit" disabled={createItem.isPending} className="w-full rounded-xl mt-6 py-6 bg-primary hover:bg-primary/90">
                  {createItem.isPending ? t('common.saving') : t('common.save')}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <Tabs value={category} onValueChange={setCategory} className="w-full md:w-auto">
          <TabsList className="bg-card shadow-sm p-1 rounded-xl h-12 w-full md:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="all" className="rounded-lg px-4">{t('inventory.tab.all')}</TabsTrigger>
            <TabsTrigger value="feed" className="rounded-lg px-4">{t('inventory.cat.feed')}</TabsTrigger>
            <TabsTrigger value="medicine" className="rounded-lg px-4">{t('inventory.cat.medicine')}</TabsTrigger>
            <TabsTrigger value="tools" className="rounded-lg px-4">{t('inventory.cat.tools')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder={t('inventory.search')} 
            className="pl-10 rounded-xl bg-card border-none shadow-sm h-12"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="rounded-2xl border-none shadow-md bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary/5 text-primary border-b border-border/50">
                <th className="py-4 px-6 font-semibold font-sans">{t('inventory.col.product')}</th>
                <th className="py-4 px-6 font-semibold font-sans">{t('inventory.col.category')}</th>
                <th className="py-4 px-6 font-semibold font-sans">{t('inventory.col.quantity')}</th>
                <th className="py-4 px-6 font-semibold font-sans">{t('inventory.col.status')}</th>
                <th className="py-4 px-6 font-semibold font-sans text-right">{t('inventory.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">{t('inventory.loading')}</td>
                </tr>
              ) : items && items.length > 0 ? (
                items.map((item: InventoryItem) => (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-black/[0.02] transition-colors group">
                    <td className="py-4 px-6 font-medium text-foreground">{item.name}</td>
                    <td className="py-4 px-6 text-muted-foreground capitalize">{item.category}</td>
                    <td className="py-4 px-6 font-medium">
                      {item.quantity} <span className="text-muted-foreground font-normal text-sm ml-1">{item.unit}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(item.status, item.quantity, item.lowStockThreshold)}`}>
                        {(item.status === 'low' || (item.lowStockThreshold && item.quantity <= item.lowStockThreshold)) && (
                          <AlertCircle className="w-3 h-3 mr-1" />
                        )}
                        {getStatusLabel(item.status, item.quantity, item.lowStockThreshold)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <Button variant="ghost" size="sm" className="text-primary hover:text-accent hover:bg-accent/10 rounded-lg">
                        {t('inventory.adjust')}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center">
                      <PackageOpen className="h-12 w-12 text-border mb-4" />
                      <p className="text-muted-foreground">{t('inventory.empty')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
