import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY = [44, 24, 16] as [number, number, number];
const SAGE    = [74, 103, 65] as [number, number, number];

export interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}

export function exportToPdf({ title, subtitle, columns, rows, filename }: ExportPdfOptions) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.width;

  let y = 18;

  doc.setFontSize(20);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y);
  y += 8;

  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, y);
    y += 7;
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

  const pageCount = (doc as any).internal.getNumberOfPages();
  const dateStr = new Date().toLocaleDateString();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.setFont("helvetica", "normal");
    const footer = `miFinca · ${dateStr} · ${i} / ${pageCount}`;
    doc.text(footer, pageW - 14, doc.internal.pageSize.height - 8, { align: "right" });
  }

  doc.save(filename);
}
