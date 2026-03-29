import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette } from "lucide-react";
import { useStore, type SidebarTheme } from "@/lib/store";

const THEMES: {
  id: SidebarTheme;
  label: string;
  swatch: string;
  swatchB?: string;
  emoji: string;
}[] = [
  { id: "tierra",  label: "Tierra",  swatch: "#3B1F10", emoji: "🌾" },
  { id: "bosque",  label: "Bosque",  swatch: "#0A2115", emoji: "🌿" },
  { id: "oceano",  label: "Océano",  swatch: "#0C1533", emoji: "🌊" },
  { id: "vaca",    label: "Vaca",    swatch: "#F4EFE4", swatchB: "#111111", emoji: "🐄" },
];

export function SidebarThemePicker() {
  const { sidebarTheme, setSidebarTheme } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-12 left-4 z-40 flex flex-col items-start gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -12, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="bg-card border border-border/40 rounded-2xl shadow-2xl p-4 w-56 mb-1"
          >
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Tema del panel
            </p>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((theme) => {
                const isActive = sidebarTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => { setSidebarTheme(theme.id); setOpen(false); }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                      isActive
                        ? "border-primary/50 bg-primary/5 shadow-sm"
                        : "border-border/30 hover:border-border/60 hover:bg-muted/30"
                    }`}
                  >
                    <div className="relative w-8 h-8 rounded-full overflow-hidden shadow-md ring-2 ring-offset-1 ring-white/50 flex-shrink-0">
                      {theme.id === "vaca" ? (
                        <div className="w-full h-full flex">
                          <div className="w-1/2 h-full" style={{ backgroundColor: theme.swatch }} />
                          <div className="w-1/2 h-full" style={{ backgroundColor: theme.swatchB }} />
                        </div>
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: theme.swatch }} />
                      )}
                      {isActive && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-foreground/80">{theme.emoji} {theme.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(o => !o)}
        title="Tema del panel lateral"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm transition-all border border-white/10 ${
          open
            ? "bg-primary text-primary-foreground"
            : "bg-primary/90 hover:bg-primary text-primary-foreground"
        }`}
      >
        <Palette className="h-3.5 w-3.5" />
        Tema
      </button>
    </div>
  );
}
