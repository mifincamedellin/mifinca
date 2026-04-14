import { useTranslation } from "react-i18next";
import { LIFECYCLE_STAGES, type LifecycleStage } from "@/lib/lifecycle";

interface Props {
  currentStage: LifecycleStage;
}

const STAGE_LABELS: Record<LifecycleStage, [string, string]> = {
  growing: ["Crecimiento", "Growing"],
  can_breed: ["Puede reproducir", "Can Breed"],
  in_heat: ["En celo", "In Heat"],
  pregnant: ["Preñada", "Pregnant"],
  nursing: ["Lactancia", "Nursing"],
};

const STAGE_COLORS: Record<LifecycleStage, string> = {
  growing: "bg-blue-500",
  can_breed: "bg-emerald-500",
  in_heat: "bg-orange-500",
  pregnant: "bg-rose-500",
  nursing: "bg-purple-500",
};

const STAGE_LIGHT: Record<LifecycleStage, string> = {
  growing: "bg-blue-100 text-blue-700",
  can_breed: "bg-emerald-100 text-emerald-700",
  in_heat: "bg-orange-100 text-orange-700",
  pregnant: "bg-rose-100 text-rose-700",
  nursing: "bg-purple-100 text-purple-700",
};

export function LifecycleBar({ currentStage }: Props) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";
  const currentIdx = LIFECYCLE_STAGES.indexOf(currentStage);

  return (
    <div className="flex items-center gap-0 w-full">
      {LIFECYCLE_STAGES.map((stage, idx) => {
        const isCurrent = stage === currentStage;
        const isPast = idx < currentIdx;
        const [labelEs, labelEn] = STAGE_LABELS[stage];

        return (
          <div key={stage} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <div
                className={`w-full h-2 rounded-full transition-all ${
                  isCurrent
                    ? STAGE_COLORS[stage]
                    : isPast
                      ? `${STAGE_COLORS[stage]} opacity-30`
                      : "bg-muted/40"
                }`}
              />
              <span
                className={`text-[10px] font-medium text-center leading-tight truncate w-full px-0.5 ${
                  isCurrent
                    ? `font-bold ${STAGE_LIGHT[stage].split(" ")[1]}`
                    : isPast
                      ? "text-muted-foreground"
                      : "text-muted-foreground/40"
                }`}
              >
                {isEn ? labelEn : labelEs}
              </span>
            </div>
            {idx < LIFECYCLE_STAGES.length - 1 && (
              <div className={`w-1 h-0.5 shrink-0 mt-[-12px] ${
                idx < currentIdx ? "bg-muted-foreground/20" : "bg-muted/30"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
