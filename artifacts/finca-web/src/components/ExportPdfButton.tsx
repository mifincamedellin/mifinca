import { FileDown } from "lucide-react";
import { exportToPdf, type ExportPdfOptions } from "@/lib/exportPdf";

interface Props {
  options: Omit<ExportPdfOptions, "filename"> & { filename?: string };
  label?: string;
  disabled?: boolean;
}

export function ExportPdfButton({ options, label, disabled }: Props) {
  const handleClick = () => {
    const date = new Date().toISOString().slice(0, 10);
    exportToPdf({
      ...options,
      filename: options.filename ?? `export-${date}.pdf`,
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={label ?? "Exportar PDF"}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border/50 bg-card text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
    >
      <FileDown className="h-4 w-4" />
      <span>{label ?? "PDF"}</span>
    </button>
  );
}
