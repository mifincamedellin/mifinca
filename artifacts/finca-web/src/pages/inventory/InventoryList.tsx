import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useListInventoryItems, useCreateInventoryItem } from "@workspace/api-client-react";
import type { InventoryItem, CreateInventoryItemRequest } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, PackageOpen, AlertCircle, ArrowUpCircle, ArrowDownCircle, Info, Trash2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

const createItemSchema = z.object({
  name: z.string().min(2),
  category: z.enum(["feed", "medicine", "tools", "supplies"]),
  quantity: z.coerce.number().min(0),
  unit: z.enum(["kg", "liters", "units", "bags", "doses", "other"]),
  lowStockThreshold: z.coerce.number().optional(),
});

type AdjustItem = { id: string; name: string; quantity: string; unit: string };

export function InventoryList() {
  const { t } = useTranslation();
  const { activeFarmId } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<AdjustItem | null>(null);
  const [adjustOp, setAdjustOp] = useState<"add" | "use">("add");
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/farms/${activeFarmId}/inventory/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/inventory`] });
      setDeleteConfirm(null);
    },
  });

  const adjustMut = useMutation({
    mutationFn: async ({ itemId, change, notes }: { itemId: string; change: number; notes: string }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/inventory/${itemId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: change > 0 ? "add" : "use", quantityChange: change, notes }),
      });
      if (!res.ok) throw new Error("adjust failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/farms/${activeFarmId}/inventory`] });
      setAdjustItem(null);
      setAdjustAmt("");
      setAdjustNotes("");
    },
  });

  const handleAdjust = () => {
    if (!adjustItem || !adjustAmt || parseFloat(adjustAmt) <= 0) return;
    const change = adjustOp === "add" ? parseFloat(adjustAmt) : -parseFloat(adjustAmt);
    adjustMut.mutate({ itemId: adjustItem.id, change, notes: adjustNotes });
  };

  const openAdjust = (item: InventoryItem) => {
    setAdjustItem({ id: item.id, name: item.name, quantity: String(item.quantity), unit: item.unit });
    setAdjustOp("add");
    setAdjustAmt("");
    setAdjustNotes("");
  };

  const newQty = adjustItem && adjustAmt && parseFloat(adjustAmt) > 0
    ? Math.max(0, parseFloat(adjustItem.quantity) + (adjustOp === "add" ? parseFloat(adjustAmt) : -parseFloat(adjustAmt)))
    : null;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{t('nav.inventory')}</h1>
          <p className="text-muted-foreground mt-1">{t('inventory.subtitle')}</p>
        </div>
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
                      <FormLabel className="flex items-center gap-1.5">
                        {t('inventory.quantity')}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px] whitespace-pre-line leading-snug">
                            {t('inventory.quantityTip')}
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl><Input type="number" {...field} className="rounded-xl"/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        {t('inventory.minAlert')}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px] whitespace-pre-line leading-snug">
                            {t('inventory.minAlertTip')}
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
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
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-accent hover:bg-accent/10 rounded-lg"
                          onClick={() => openAdjust(item)}
                        >
                          {t('inventory.adjust')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8"
                          onClick={() => setDeleteConfirm(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      {/* Adjust Quantity Modal */}
      <AnimatePresence>
        {adjustItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setAdjustItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-border/30"
            >
              {/* Header */}
              <div className="mb-5">
                <h2 className="text-xl font-serif font-bold text-primary">{t('inventory.adjust')}</h2>
                <p className="text-muted-foreground text-sm mt-0.5 truncate">{adjustItem.name}</p>
              </div>

              {/* Current qty display */}
              <div className="bg-muted/30 rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('inventory.quantity')} actual</span>
                <span className="font-mono font-bold text-lg text-foreground">
                  {parseFloat(adjustItem.quantity)} <span className="text-sm font-normal text-muted-foreground">{adjustItem.unit}</span>
                </span>
              </div>

              {/* Operation toggle */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                <button
                  onClick={() => setAdjustOp("add")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    adjustOp === "add"
                      ? "bg-secondary/10 border-secondary text-secondary shadow-sm"
                      : "border-border/40 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  {t('inventory.adjust.add')}
                </button>
                <button
                  onClick={() => setAdjustOp("use")}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    adjustOp === "use"
                      ? "bg-destructive/10 border-destructive/60 text-destructive shadow-sm"
                      : "border-border/40 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <ArrowDownCircle className="h-4 w-4" />
                  {t('inventory.adjust.use')}
                </button>
              </div>

              {/* Amount input */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-1.5 block">
                  {adjustOp === "add" ? t('inventory.adjust.amtAdd') : t('inventory.adjust.amtUse')} ({adjustItem.unit})
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={adjustAmt}
                  onChange={e => setAdjustAmt(e.target.value)}
                  placeholder="0"
                  className="rounded-xl text-lg h-12 font-mono"
                  autoFocus
                />
              </div>

              {/* Notes */}
              <div className="mb-5">
                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">{t('inventory.adjust.notes')}</label>
                <Input
                  value={adjustNotes}
                  onChange={e => setAdjustNotes(e.target.value)}
                  placeholder={t('inventory.adjust.notesPlaceholder')}
                  className="rounded-xl"
                />
              </div>

              {/* New qty preview */}
              {newQty !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mb-5 rounded-xl px-4 py-3 flex items-center justify-between border"
                  style={{
                    background: adjustOp === "add" ? "rgb(74 103 65 / 0.06)" : "rgb(239 68 68 / 0.05)",
                    borderColor: adjustOp === "add" ? "rgb(74 103 65 / 0.2)" : "rgb(239 68 68 / 0.2)",
                  }}
                >
                  <span className="text-sm text-muted-foreground">{t('inventory.adjust.newQty')}</span>
                  <span className={`font-mono font-bold text-lg ${adjustOp === "add" ? "text-secondary" : "text-destructive"}`}>
                    {newQty} <span className="text-sm font-normal text-muted-foreground">{adjustItem.unit}</span>
                  </span>
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setAdjustItem(null)}
                  className="flex-1 rounded-xl"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleAdjust}
                  disabled={adjustMut.isPending || !adjustAmt || parseFloat(adjustAmt) <= 0}
                  className={`flex-1 rounded-xl text-white ${adjustOp === "add" ? "bg-secondary hover:bg-secondary/90" : "bg-destructive hover:bg-destructive/90"}`}
                >
                  {adjustMut.isPending ? t('common.saving') : t('inventory.adjust.confirm')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">{t('inventory.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('inventory.confirmDeleteDesc')}</p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              disabled={deleteItem.isPending}
              onClick={() => deleteConfirm && deleteItem.mutate(deleteConfirm)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
