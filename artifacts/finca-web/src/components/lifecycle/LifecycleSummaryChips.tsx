import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  deriveLifecycleStage, hasLifecycle, LIFECYCLE_STAGES, getStageColor, getStageIcon,
  type LifecycleStage, type LifecycleAnimal,
} from "@/lib/lifecycle";

interface Props {
  animals: LifecycleAnimal[];
  selectedStage: LifecycleStage | null;
  onSelect: (stage: LifecycleStage | null) => void;
}

const STAGE_LABELS: Record<LifecycleStage, [string, string]> = {
  growing: ["Crecimiento", "Growing"],
  can_breed: ["Puede reproducir", "Can Breed"],
  in_heat: ["En celo", "In Heat"],
  pregnant: ["Preñada", "Pregnant"],
  nursing: ["Lactancia", "Nursing"],
};

export function LifecycleSummaryChips({ animals, selectedStage, onSelect }: Props) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    LIFECYCLE_STAGES.forEach(s => { c[s] = 0; });
    animals.forEach(a => {
      if (!hasLifecycle(a)) return;
      const stage = deriveLifecycleStage(a);
      if (stage) c[stage] = (c[stage] ?? 0) + 1;
    });
    return c;
  }, [animals]);

  const totalTracked = useMemo(() =>
    animals.filter(a => hasLifecycle(a)).length,
  [animals]);

  if (totalTracked === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-6 pl-6 pr-2 md:mx-0 md:pl-0 md:pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {/* All chip */}
      <button
        onClick={() => onSelect(null)}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all shrink-0 ${
          selectedStage === null
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-card border-border/50 text-muted-foreground hover:border-border"
        }`}
      >
        <span>{isEn ? "All" : "Todas"}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
          selectedStage === null ? "bg-white/20" : "bg-muted text-muted-foreground"
        }`}>
          {totalTracked}
        </span>
      </button>

      {LIFECYCLE_STAGES.map(stage => {
        const count = counts[stage] ?? 0;
        const active = selectedStage === stage;
        const colors = getStageColor(stage);
        const [labelEs, labelEn] = STAGE_LABELS[stage];
        return (
          <button
            key={stage}
            onClick={() => onSelect(active ? null : stage)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all shrink-0 ${
              active
                ? `${colors} border-current shadow-sm`
                : count === 0
                  ? "bg-card border-border/30 text-muted-foreground/40"
                  : "bg-card border-border/50 text-muted-foreground hover:border-border"
            }`}
          >
            <span>{getStageIcon(stage)}</span>
            <span>{isEn ? labelEn : labelEs}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              active ? "bg-current/10" : "bg-muted text-muted-foreground"
            }`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
