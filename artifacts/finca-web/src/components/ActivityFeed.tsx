import { useQuery } from "@tanstack/react-query";
import { listActivity } from "@workspace/api-client-react";
import type { ActivityEntry } from "@workspace/api-client-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ActivityFeedProps {
  farmId: string;
  entityId: string;
  limit?: number;
  bgColor?: string;
}

const dotColor = (actionType: string | null | undefined) => {
  if (actionType === "deleted") return "bg-destructive";
  if (actionType === "created" || actionType === "inventory_added") return "bg-emerald-500";
  if (actionType?.startsWith("inventory_")) return "bg-accent";
  return "bg-secondary";
};

export function ActivityFeed({ farmId, entityId, limit = 20, bgColor = "#FDFAF5" }: ActivityFeedProps) {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";

  const { data: entries = [], isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["activity", farmId, entityId, limit],
    queryFn: () => listActivity(farmId, { entityId, limit }),
    enabled: !!farmId && !!entityId,
  });

  if (isLoading) {
    return (
      <div className="space-y-5 p-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="relative pl-6 animate-pulse">
            <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-muted" />
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground gap-3">
        <Activity className="h-8 w-8 opacity-30" />
        <p className="text-sm">{isEn ? "No activity recorded yet." : "Sin actividad registrada aún."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-1">
      {entries.map((item, i) => {
        const isLast = i === entries.length - 1;
        return (
          <div key={item.id} className="relative pl-6">
            {!isLast && (
              <div className="absolute left-[7px] top-6 bottom-[-20px] w-0.5 bg-border/60" />
            )}
            <div
              className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 ${dotColor(item.actionType)}`}
              style={{ borderColor: bgColor }}
            />
            <p className="text-sm font-medium text-foreground leading-snug">
              {item.description || item.actionType}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(
                new Date(item.createdAt || ""),
                "dd MMM yyyy, HH:mm",
                isEn ? {} : { locale: es }
              )}{" "}
              · {item.profile?.fullName || (isEn ? "User" : "Usuario")}
            </p>
          </div>
        );
      })}
    </div>
  );
}
