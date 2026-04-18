import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportAnimalToPdf, type AnimalPdfOptions } from "@/lib/exportPdf";

interface ExportPdfButtonProps {
  options: AnimalPdfOptions;
  label?: string;
}

export function ExportPdfButton({ options, label }: ExportPdfButtonProps) {
  return (
    <Button
      variant="outline"
      className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 hover-elevate"
      onClick={() => exportAnimalToPdf(options)}
    >
      <FileDown className="h-4 w-4 mr-2" />
      {label ?? "Export PDF"}
    </Button>
  );
}
