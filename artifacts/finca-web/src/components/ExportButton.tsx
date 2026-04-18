import { useState, useRef, useEffect } from "react";
import { FileDown, FileSpreadsheet, ChevronDown } from "lucide-react";
import { exportToPdf, type ExportPdfOptions } from "@/lib/exportPdf";
import { exportToCsv } from "@/lib/exportCsv";

interface CsvOptions {
  filename: string;
  columns: string[];
  rows: (string | number)[][];
}

interface Props {
  pdfOptions: ExportPdfOptions;
  csvOptions: CsvOptions;
  disabled?: boolean;
  label?: string;
  labelCsv?: string;
  labelPdf?: string;
}

export function ExportButton({
  pdfOptions,
  csvOptions,
  disabled,
  label,
  labelCsv,
  labelPdf,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleCsv = () => {
    setOpen(false);
    exportToCsv(csvOptions.filename, csvOptions.columns, csvOptions.rows);
  };

  const handlePdf = () => {
    setOpen(false);
    exportToPdf(pdfOptions);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/50 bg-card text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
      >
        <FileDown className="h-4 w-4" />
        <span>{label ?? "Exportar"}</span>
        <ChevronDown className={`h-3 w-3 ml-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-border/50 bg-card shadow-lg z-50 overflow-hidden">
          <button
            onClick={handleCsv}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            {labelCsv ?? "Exportar CSV"}
          </button>
          <div className="h-px bg-border/50" />
          <button
            onClick={handlePdf}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
          >
            <FileDown className="h-4 w-4 text-primary" />
            {labelPdf ?? "Exportar PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
