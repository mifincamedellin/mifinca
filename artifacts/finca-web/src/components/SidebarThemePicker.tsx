import { useTranslation } from "react-i18next";
import { useStore, type SidebarTheme } from "@/lib/store";

const THEMES: {
  id: SidebarTheme;
  label: string;
  swatch: string;
  swatchB?: string;
}[] = [
  { id: "tierra", label: "Tierra", swatch: "#3B1F10" },
  { id: "bosque", label: "Bosque", swatch: "#0A2115" },
  { id: "oceano", label: "Océano", swatch: "#0C1533" },
  { id: "vaca",   label: "Vaca",   swatch: "#F4EFE4", swatchB: "#111111" },
];

export function SidebarThemePicker() {
  const { t } = useTranslation();
  const { sidebarTheme, setSidebarTheme } = useStore();

  return (
    <div className="flex items-center justify-between px-1 py-2">
      <span className="text-[11px] font-medium text-sidebar-foreground/40 uppercase tracking-wider">
        {t("sidebar.theme")}
      </span>
      <div className="flex items-center gap-1.5">
        {THEMES.map((theme) => {
          const isActive = sidebarTheme === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => setSidebarTheme(theme.id)}
              title={theme.label}
              className={`w-5 h-5 rounded-full transition-all flex-shrink-0 overflow-hidden ${
                isActive
                  ? "ring-2 ring-white/70 ring-offset-1 ring-offset-transparent scale-110"
                  : "ring-1 ring-white/20 hover:ring-white/50 hover:scale-110"
              }`}
              style={
                theme.id === "vaca"
                  ? { background: "linear-gradient(to right, #F4EFE4 50%, #111111 50%)" }
                  : { backgroundColor: theme.swatch }
              }
            />
          );
        })}
      </div>
    </div>
  );
}
