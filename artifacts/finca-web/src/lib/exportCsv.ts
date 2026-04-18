function escapeCsv(value: string | number): string {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export interface ExportCsvOptions {
  filename: string;
  title?: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
}

export function exportToCsv({ filename, title, subtitle, columns, rows }: ExportCsvOptions): void {
  const exportDate = new Date().toLocaleDateString();
  const lines: string[] = [];

  if (title) {
    lines.push([escapeCsv(title), escapeCsv(exportDate)].join(","));
    if (subtitle) {
      lines.push(escapeCsv(subtitle));
    }
    lines.push("");
  }

  lines.push(columns.map(escapeCsv).join(","));
  rows.forEach(row => lines.push(row.map(escapeCsv).join(",")));

  const csvContent = lines.join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
