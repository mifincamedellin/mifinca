import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY = [44, 24, 16] as [number, number, number];

export interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  farmName?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}

export function exportToPdf({ title, subtitle, farmName, columns, rows, filename }: ExportPdfOptions): void {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.width;
  const exportDate = new Date().toLocaleDateString();

  let y = 18;

  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y);

  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "normal");
  doc.text(exportDate, pageW - 14, y, { align: "right" });

  y += 7;

  if (subtitle) {
    doc.setFontSize(9.5);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, y);
    y += 6;
  }

  autoTable(doc, {
    head: [columns],
    body: rows.length > 0 ? rows : [[{ content: "—", colSpan: columns.length, styles: { halign: "center" } }]],
    startY: y + 2,
    theme: "striped",
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [253, 250, 245] },
    styles: { fontSize: 8.5, cellPadding: 3 },
    tableLineColor: [220, 215, 208],
    tableLineWidth: 0.1,
  });

  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  const footerLabel = farmName ?? "miFinca";
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.setFont("helvetica", "normal");
    const footer = `${footerLabel} · ${i} / ${pageCount}`;
    doc.text(footer, pageW - 14, doc.internal.pageSize.height - 8, { align: "right" });
  }

  doc.autoPrint();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    doc.save(filename);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
