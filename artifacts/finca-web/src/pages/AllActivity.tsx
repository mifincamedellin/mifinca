import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useListActivity } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const PAGE_SIZE = 20;

export function AllActivity() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { activeFarmId } = useStore();
  const isEn = i18n.language === "en";

  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: activity, isFetching } = useListActivity(
    activeFarmId || "",
    { limit },
    { query: { enabled: !!activeFarmId } }
  );

  const hasMore = (activity?.length ?? 0) === limit;

  return (
    <div className="min-h-screen" style={{ background: "#FDFAF5" }}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-[#FDFAF5]/90 backdrop-blur-sm border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl h-9 w-9 shrink-0"
          onClick={() => setLocation("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Activity className="h-4 w-4 text-primary shrink-0" />
          <h1 className="text-lg font-serif text-primary font-semibold truncate">
            {isEn ? "All Activity" : "Toda la Actividad"}
          </h1>
        </div>
        {(activity?.length ?? 0) > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium tabular-nums shrink-0">
            {activity!.length}{hasMore ? "+" : ""}
          </span>
        )}
      </div>

      {/* ── Feed ── */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {activity && activity.length > 0 ? (
          <>
            <div className="space-y-5">
              {activity.map((item, i) => {
                const dotColor =
                  item.actionType === "deleted"
                    ? "bg-destructive"
                    : item.actionType === "created" || item.actionType === "inventory_added"
                      ? "bg-emerald-500"
                      : item.actionType?.startsWith("inventory_")
                        ? "bg-accent"
                        : "bg-secondary";

                const isLastVisible = i === activity.length - 1;

                return (
                  <div key={item.id} className="relative pl-6">
                    {!isLastVisible && (
                      <div className="absolute left-[7px] top-6 bottom-[-20px] w-0.5 bg-border/60" />
                    )}
                    <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-[#FDFAF5] ${dotColor}`} />
                    <p className="text-sm font-medium text-foreground">
                      {item.description || item.actionType}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
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

            {/* ── Load more ── */}
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-xl gap-2"
                  disabled={isFetching}
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                >
                  <ChevronDown className="h-4 w-4" />
                  {isFetching
                    ? (isEn ? "Loading…" : "Cargando…")
                    : (isEn ? "Load more" : "Cargar más")}
                </Button>
              </div>
            )}

            {!hasMore && activity.length > 0 && (
              <p className="mt-8 text-center text-xs text-muted-foreground">
                {isEn ? "You've reached the beginning." : "Has llegado al inicio."}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Activity className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
