import { useTranslation } from "react-i18next";
import { LIFECYCLE_STAGES, getStageIcon, type LifecycleStage } from "@/lib/lifecycle";

interface Props {
  currentStage: LifecycleStage;
}

const STAGE_LABELS: Record<LifecycleStage, [string, string]> = {
  growing:   ["Crecimiento",      "Growing"],
  can_breed: ["Puede reproducir", "Can Breed"],
  in_heat:   ["En celo",          "In Heat"],
  pregnant:  ["Preñada",          "Pregnant"],
  nursing:   ["Lactancia",        "Nursing"],
};

export function LifecycleBar({ currentStage }: Props) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  return (
    <div className="flex items-start gap-1 w-full">
      {LIFECYCLE_STAGES.map((stage) => {
        const isCurrent = stage === currentStage;
        const [labelEs, labelEn] = STAGE_LABELS[stage];

        return (
          <div key={stage} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`h-2 w-full rounded-full transition-all ${
                isCurrent ? "bg-primary" : "bg-primary/20"
              }`}
            />
            <span className={`text-[10px] leading-tight text-center font-medium ${
              isCurrent ? "text-foreground" : "text-muted-foreground/50"
            }`}>
              {isEn ? labelEn : labelEs}
            </span>
          </div>
        );
      })}
    </div>
  );
}
