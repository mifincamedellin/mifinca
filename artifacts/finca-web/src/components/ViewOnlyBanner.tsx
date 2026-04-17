import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ViewOnlyBannerProps {
  canAdd: boolean;
  canEdit: boolean;
  canRemove: boolean;
}

export function ViewOnlyBanner({ canAdd, canEdit, canRemove }: ViewOnlyBannerProps) {
  const { t } = useTranslation();

  if (canAdd || canEdit || canRemove) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-muted bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
      <Eye className="h-4 w-4 flex-shrink-0 opacity-70" />
      <span>{t("common.viewOnlyBanner")}</span>
    </div>
  );
}
