import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp, CheckCircle2, Flame, Baby, Milk } from "lucide-react";
import {
  deriveLifecycleStage, hasLifecycle, LIFECYCLE_STAGES,
  type LifecycleStage, type LifecycleAnimal,
} from "@/lib/lifecycle";

interface Props {
  animals: LifecycleAnimal[];
  selectedStage: LifecycleStage | null;
  onSelect: (stage: LifecycleStage | null) => void;
  selectedMale?: boolean;
  onSelectMale?: (v: boolean) => void;
}

const STAGE_LABELS: Record<LifecycleStage, [string, string]> = {
  growing: ["Crecimiento", "Growing"],
  can_breed: ["Puede reproducir", "Can Breed"],
  in_heat: ["En celo", "In Heat"],
  pregnant: ["Preñada", "Pregnant"],
  nursing: ["Lactancia", "Nursing"],
};

const STAGE_ICONS: Record<LifecycleStage, React.FC<{ className?: string }>> = {
  growing:   TrendingUp,
  can_breed: CheckCircle2,
  in_heat:   Flame,
  pregnant:  Baby,
  nursing:   Milk,
};

export function LifecycleSummaryChips({ animals, selectedStage, onSelect, selectedMale, onSelectMale }: Props) {
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

  const maleCount = useMemo(() =>
    animals.filter(a => a.sex === "male").length,
  [animals]);

  if (totalTracked === 0 && maleCount === 0) return null;

  type ChipDef =
    | { kind: "stage"; stage: LifecycleStage; count: number }
    | { kind: "male"; count: number };

  const chips = useMemo((): ChipDef[] => {
    const all: ChipDef[] = LIFECYCLE_STAGES.map(stage => ({
      kind: "stage" as const,
      stage,
      count: counts[stage] ?? 0,
    }));
    if (onSelectMale && maleCount > 0) {
      all.push({ kind: "male" as const, count: maleCount });
    }
    return all.sort((a, b) => b.count - a.count);
  }, [counts, maleCount, onSelectMale]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-6 pl-6 pr-2 md:mx-0 md:pl-0 md:pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {/* All chip — only shown when there are female-tracked animals */}
      {totalTracked > 0 && (
        <button
          onClick={() => { onSelect(null); onSelectMale?.(false); }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all shrink-0 ${
            selectedStage === null && !selectedMale
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-card border-border/50 text-muted-foreground hover:border-border"
          }`}
        >
          <span>{isEn ? "All" : "Todas"}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
            selectedStage === null && !selectedMale
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-foreground/10 text-muted-foreground"
          }`}>
            {totalTracked}
          </span>
        </button>
      )}

      {chips.map(chip => {
        if (chip.kind === "stage") {
          const { stage, count } = chip;
          const active = selectedStage === stage;
          const [labelEs, labelEn] = STAGE_LABELS[stage];
          const Icon = STAGE_ICONS[stage];
          return (
            <button
              key={stage}
              onClick={() => { onSelect(active ? null : stage); onSelectMale?.(false); }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all shrink-0 ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : count === 0
                    ? "bg-card border-border/30 text-muted-foreground/40"
                    : "bg-card border-border/50 text-muted-foreground hover:border-border"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{isEn ? labelEn : labelEs}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                active
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-foreground/10 text-muted-foreground"
              }`}>
                {count}
              </span>
            </button>
          );
        }

        return (
          <button
            key="male"
            onClick={() => { onSelectMale!(!selectedMale); if (!selectedMale) onSelect(null); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all shrink-0 ${
              selectedMale
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card border-border/50 text-muted-foreground hover:border-border"
            }`}
          >
            <span className="text-base leading-none">♂</span>
            <span>{isEn ? "Male" : "Machos"}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              selectedMale
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-foreground/10 text-muted-foreground"
            }`}>
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
