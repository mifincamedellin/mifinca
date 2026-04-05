import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore, type SidebarTheme } from "@/lib/store";

const THEMES: {
  id: SidebarTheme;
  labelKey: string;
  swatch: string;
  emoji: string;
}[] = [
  { id: "tierra", labelKey: "theme.tierra", swatch: "#3B1F10", emoji: "🌾" },
  { id: "bosque", labelKey: "theme.bosque", swatch: "#0A2115", emoji: "🌿" },
  { id: "oceano", labelKey: "theme.oceano", swatch: "#0C1533", emoji: "🌊" },
  { id: "vaca",   labelKey: "theme.vaca",   swatch: "#111111", emoji: "🌙" },
];

export function SidebarThemePicker() {
  const { t } = useTranslation();
  const { sidebarTheme, setSidebarTheme } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 z-50 bg-card border border-border/40 rounded-2xl shadow-2xl p-4 w-56"
            >
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                {t("sidebar.theme")}
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
                        <div className="w-full h-full" style={{ backgroundColor: theme.swatch }} />
                        {isActive && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-medium text-foreground/80">{theme.emoji} {t(theme.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(o => !o)}
        title={t("sidebar.theme")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md transition-all border border-white/10 ${
          open
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-sidebar-accent/80 hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
        }`}
      >
        <Palette className="h-3.5 w-3.5" />
        {t("sidebar.theme")}
      </button>
    </div>
  );
}
