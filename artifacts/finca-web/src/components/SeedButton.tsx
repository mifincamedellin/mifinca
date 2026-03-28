import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Sprout, Trash2, Loader2, FlaskConical } from "lucide-react";

type Phase = "idle" | "seeding" | "clearing" | "seeded" | "cleared";

export function SeedButton() {
  const { activeFarmId } = useStore();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [open, setOpen] = useState(false);

  const seed = async () => {
    if (!activeFarmId || phase === "seeding") return;
    setPhase("seeding");
    try {
      const res = await fetch(`/api/farms/${activeFarmId}/seed`, { method: "POST" });
      if (!res.ok) throw new Error("seed failed");
      qc.invalidateQueries();
      setPhase("seeded");
      setTimeout(() => setPhase("idle"), 3000);
    } catch {
      setPhase("idle");
    }
  };

  const clear = async () => {
    if (!activeFarmId || phase === "clearing") return;
    setPhase("clearing");
    try {
      const res = await fetch(`/api/farms/${activeFarmId}/seed`, { method: "DELETE" });
      if (!res.ok) throw new Error("clear failed");
      qc.invalidateQueries();
      setPhase("cleared");
      setTimeout(() => setPhase("idle"), 3000);
    } catch {
      setPhase("idle");
    }
  };

  const busy = phase === "seeding" || phase === "clearing";

  return (
    <div className="fixed bottom-24 left-4 z-40 flex flex-col items-start gap-2">
      {/* Toggle pill */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-semibold shadow-lg backdrop-blur-sm transition-all border border-white/10"
        title="Demo data tools"
      >
        <FlaskConical className="h-3.5 w-3.5" />
        Dev
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -12, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-card border border-border/40 rounded-2xl shadow-2xl p-4 w-64"
          >
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Datos de prueba
            </p>

            <div className="space-y-2">
              <button
                onClick={seed}
                disabled={busy}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 text-sm font-medium transition-all disabled:opacity-50"
              >
                {phase === "seeding" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sprout className="h-4 w-4" />
                )}
                {phase === "seeding" ? "Cargando..." :
                 phase === "seeded" ? "✓ Datos cargados" :
                 "Cargar datos de ejemplo"}
              </button>

              <button
                onClick={clear}
                disabled={busy}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-sm font-medium transition-all disabled:opacity-50"
              >
                {phase === "clearing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {phase === "clearing" ? "Limpiando..." :
                 phase === "cleared" ? "✓ Datos eliminados" :
                 "Limpiar todos los datos"}
              </button>
            </div>

            <p className="text-xs text-muted-foreground/60 mt-3 leading-relaxed">
              Carga animales, inventario, finanzas y contactos de ejemplo para tu finca activa.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
