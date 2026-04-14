import { LIFECYCLE_STAGES, type LifecycleStage } from "@/lib/lifecycle";

interface Props {
  currentStage: LifecycleStage;
}

export function LifecycleBar({ currentStage }: Props) {
  const currentIdx = LIFECYCLE_STAGES.indexOf(currentStage);

  return (
    <div className="flex items-center gap-1 w-full">
      {LIFECYCLE_STAGES.map((stage, idx) => {
        const isCurrent = stage === currentStage;
        const isPast = idx < currentIdx;

        return (
          <div
            key={stage}
            className={`h-2 flex-1 rounded-full transition-all ${
              isCurrent
                ? "bg-primary"
                : isPast
                  ? "bg-primary/30"
                  : "bg-muted/40"
            }`}
          />
        );
      })}
    </div>
  );
}
