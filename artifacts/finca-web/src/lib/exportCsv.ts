function escapeCsv(value: string | number): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportToCsv(filename: string, columns: string[], rows: (string | number)[][]): void {
  const lines = [
    columns.map(escapeCsv).join(","),
    ...rows.map(row => row.map(escapeCsv).join(",")),
  ];
  const csvContent = lines.join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
