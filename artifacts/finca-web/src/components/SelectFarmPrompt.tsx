import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";

export function SelectFarmPrompt() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <div className="p-4 bg-primary/8 rounded-2xl mb-4">
        <Layers className="h-8 w-8 text-primary/50" />
      </div>
      <p className="text-muted-foreground text-sm max-w-xs">
        {t("farms.selectFarmToManage")}
      </p>
    </div>
  );
}
