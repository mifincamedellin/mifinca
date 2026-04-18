import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PRIMARY = [44, 24, 16] as [number, number, number];
const MUTED = [120, 120, 120] as [number, number, number];

interface JsPDFWithPlugin {
  lastAutoTable: { finalY: number };
}

function getLastY(doc: jsPDF): number {
  return (doc as unknown as JsPDFWithPlugin).lastAutoTable.finalY;
}

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
    const footer = `${footerLabel} · ${exportDate} · ${i} / ${pageCount}`;
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

export interface MilkRecord {
  recordedAt: string;
  amountLiters: number | string;
  session?: string | null;
  notes?: string | null;
}

export interface AnimalPdfOptions {
  animal: {
    customTag?: string | null;
    name?: string | null;
    species?: string | null;
    breed?: string | null;
    sex?: string | null;
    dateOfBirth?: string | null;
    purchaseDate?: string | null;
    purchasePrice?: number | string | null;
    currentWeight?: number | null;
    status?: string | null;
    deathDate?: string | null;
    deathCause?: string | null;
    pregnancyCount?: number | null;
    medicalRecords?: Array<{
      title: string;
      recordType?: string;
      recordDate: string;
      description?: string | null;
      vetName?: string | null;
      costCop?: number | string | null;
    }>;
  };
  weights: Array<{
    recordedAt: string;
    weightKg: number | string;
    notes?: string | null;
  }>;
  milkRecords?: MilkRecord[];
  lifecycleStage?: string | null;
  farmName?: string;
  isEn?: boolean;
}

function fmtDate(dateStr: string | null | undefined, isEn: boolean): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
    return d.toLocaleDateString(isEn ? "en-US" : "es-CO", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

function sessionLabel(session: string | null | undefined, isEn: boolean): string {
  if (!session) return "—";
  const labels: Record<string, [string, string]> = {
    morning:   ["Morning",   "Mañana"],
    afternoon: ["Afternoon", "Tarde"],
    evening:   ["Evening",   "Noche"],
    full_day:  ["Full Day",  "Día Completo"],
  };
  const pair = labels[session];
  return pair ? pair[isEn ? 0 : 1] : capitalize(session);
}

export function exportAnimalToPdf({ animal, weights, milkRecords, lifecycleStage, farmName, isEn = true }: AnimalPdfOptions): void {
  const doc = new jsPDF({ orientation: "portrait" });
  const pageW = doc.internal.pageSize.width;
  const exportDate = new Date().toLocaleDateString(isEn ? "en-US" : "es-CO");

  const tag = animal.customTag || "—";
  const displayName = animal.name || tag;

  const filename = `${tag.replace(/[^a-zA-Z0-9-]/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;

  let y = 14;

  doc.setFontSize(20);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(displayName, 14, y);

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.text(exportDate, pageW - 14, y, { align: "right" });

  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.text(`${isEn ? "Tag" : "Arete"}: ${tag}`, 14, y);

  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(isEn ? "Animal Profile" : "Perfil del Animal", 14, y);

  y += 3;
  doc.setDrawColor(220, 215, 208);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);
  y += 5;

  const profileRows: [string, string][] = [
    [isEn ? "Tag" : "Arete", tag],
    [isEn ? "Name" : "Nombre", animal.name || "—"],
    [isEn ? "Species" : "Especie", capitalize(animal.species)],
    [isEn ? "Breed" : "Raza", animal.breed || "—"],
    [isEn ? "Sex" : "Sexo", capitalize(animal.sex)],
    [isEn ? "Date of Birth" : "Fecha de Nacimiento", fmtDate(animal.dateOfBirth, isEn)],
    [isEn ? "Purchase Date" : "Fecha de Compra", fmtDate(animal.purchaseDate, isEn)],
    [isEn ? "Purchase Price" : "Precio de Compra", animal.purchasePrice != null ? `$${Number(animal.purchasePrice).toLocaleString()}` : "—"],
    [isEn ? "Current Weight" : "Peso Actual", animal.currentWeight != null ? `${animal.currentWeight} kg` : "—"],
    [isEn ? "Status" : "Estado", capitalize(animal.status)],
  ];

  if (lifecycleStage) {
    profileRows.push([isEn ? "Lifecycle Stage" : "Etapa de Ciclo", capitalize(lifecycleStage)]);
  }

  if (animal.status === "deceased") {
    profileRows.push([isEn ? "Death Date" : "Fecha de Muerte", fmtDate(animal.deathDate, isEn)]);
    profileRows.push([isEn ? "Death Cause" : "Causa de Muerte", capitalize(animal.deathCause)]);
  }

  autoTable(doc, {
    body: profileRows,
    startY: y,
    theme: "plain",
    columnStyles: {
      0: { fontStyle: "bold", textColor: PRIMARY, cellWidth: 50, fontSize: 8.5 },
      1: { textColor: [40, 40, 40], fontSize: 8.5 },
    },
    styles: { cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } },
    alternateRowStyles: { fillColor: [253, 250, 245] },
    tableLineColor: [235, 230, 225],
    tableLineWidth: 0.1,
  });

  y = getLastY(doc) + 10;

  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(isEn ? "Weight History" : "Historial de Peso", 14, y);

  y += 3;
  doc.setDrawColor(220, 215, 208);
  doc.line(14, y, pageW - 14, y);
  y += 3;

  const weightRows = (weights || [])
    .slice()
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .map(w => [
      fmtDate(w.recordedAt, isEn),
      `${Number(w.weightKg).toFixed(1)} kg`,
      w.notes || "—",
    ]);

  autoTable(doc, {
    head: [[
      isEn ? "Date" : "Fecha",
      isEn ? "Weight" : "Peso",
      isEn ? "Notes" : "Notas",
    ]],
    body: weightRows.length > 0 ? weightRows : [[{ content: "—", colSpan: 3, styles: { halign: "center" } }]],
    startY: y,
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 250, 245] },
    styles: { fontSize: 8.5, cellPadding: 3 },
    tableLineColor: [220, 215, 208],
    tableLineWidth: 0.1,
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 28 },
      2: { cellWidth: "auto" },
    },
  });

  y = getLastY(doc) + 10;

  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(isEn ? "Medical Events" : "Eventos Médicos", 14, y);

  y += 3;
  doc.setDrawColor(220, 215, 208);
  doc.line(14, y, pageW - 14, y);
  y += 3;

  const medicalRows = (animal.medicalRecords || [])
    .slice()
    .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
    .map(r => [
      fmtDate(r.recordDate, isEn),
      capitalize(r.recordType),
      r.title,
      r.description || "—",
      r.vetName || "—",
    ]);

  autoTable(doc, {
    head: [[
      isEn ? "Date" : "Fecha",
      isEn ? "Type" : "Tipo",
      isEn ? "Title" : "Título",
      isEn ? "Notes" : "Notas",
      isEn ? "Vet" : "Veterinario",
    ]],
    body: medicalRows.length > 0 ? medicalRows : [[{ content: "—", colSpan: 5, styles: { halign: "center" } }]],
    startY: y,
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 250, 245] },
    styles: { fontSize: 8.5, cellPadding: 3 },
    tableLineColor: [220, 215, 208],
    tableLineWidth: 0.1,
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 28 },
      2: { cellWidth: 40 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 35 },
    },
  });

  if (milkRecords && milkRecords.length > 0) {
    y = getLastY(doc) + 10;

    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.setFont("helvetica", "bold");
    doc.text(isEn ? "Milk Production" : "Producción de Leche", 14, y);

    y += 3;
    doc.setDrawColor(220, 215, 208);
    doc.line(14, y, pageW - 14, y);
    y += 3;

    const milkRows = milkRecords
      .slice()
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .map(r => [
        fmtDate(r.recordedAt, isEn),
        sessionLabel(r.session, isEn),
        `${Number(r.amountLiters).toFixed(1)} L`,
        r.notes || "—",
      ]);

    autoTable(doc, {
      head: [[
        isEn ? "Date" : "Fecha",
        isEn ? "Session" : "Sesión",
        isEn ? "Amount" : "Cantidad",
        isEn ? "Notes" : "Notas",
      ]],
      body: milkRows,
      startY: y,
      theme: "striped",
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [253, 250, 245] },
      styles: { fontSize: 8.5, cellPadding: 3 },
      tableLineColor: [220, 215, 208],
      tableLineWidth: 0.1,
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 30 },
        2: { cellWidth: 22 },
        3: { cellWidth: "auto" },
      },
    });
  }

  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  const footerLabel = farmName ?? "miFinca";
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.setFont("helvetica", "normal");
    const footer = `${footerLabel} · ${displayName} · ${exportDate} · ${i} / ${pageCount}`;
    doc.text(footer, pageW - 14, doc.internal.pageSize.height - 8, { align: "right" });
  }

  doc.save(filename);
}

export interface MilkLogPdfOptions {
  animal: {
    customTag?: string | null;
    name?: string | null;
  };
  milkRecords: MilkRecord[];
  farmName?: string;
  isEn?: boolean;
}

export function exportMilkLogToPdf({ animal, milkRecords, farmName, isEn = true }: MilkLogPdfOptions): void {
  const doc = new jsPDF({ orientation: "portrait" });
  const pageW = doc.internal.pageSize.width;
  const exportDate = new Date().toLocaleDateString(isEn ? "en-US" : "es-CO");

  const tag = animal.customTag || "—";
  const displayName = animal.name || tag;
  const filename = `leche-${tag.replace(/[^a-zA-Z0-9-]/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;

  let y = 14;

  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(isEn ? "Milk Production Log" : "Registro de Leche", 14, y);

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.text(exportDate, pageW - 14, y, { align: "right" });

  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.text(`${displayName}  ·  ${isEn ? "Tag" : "Arete"}: ${tag}`, 14, y);

  y += 6;

  if (milkRecords.length > 0) {
    const sorted = milkRecords.slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    const totalLiters = milkRecords.reduce((s, r) => s + Number(r.amountLiters), 0);
    const dateFrom = sorted[sorted.length - 1].recordedAt;
    const dateTo = sorted[0].recordedAt;

    const summaryRows: [string, string][] = [
      [isEn ? "Total Records" : "Registros Totales", String(milkRecords.length)],
      [isEn ? "Period" : "Período", `${fmtDate(dateFrom, isEn)} – ${fmtDate(dateTo, isEn)}`],
      [isEn ? "Total Produced" : "Total Producido", `${totalLiters.toFixed(1)} L`],
    ];

    autoTable(doc, {
      body: summaryRows,
      startY: y,
      theme: "plain",
      columnStyles: {
        0: { fontStyle: "bold", textColor: PRIMARY, cellWidth: 50, fontSize: 8.5 },
        1: { textColor: [40, 40, 40], fontSize: 8.5 },
      },
      styles: { cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } },
      alternateRowStyles: { fillColor: [253, 250, 245] },
      tableLineColor: [235, 230, 225],
      tableLineWidth: 0.1,
    });

    y = getLastY(doc) + 8;
  }

  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.text(isEn ? "Records" : "Registros", 14, y);
  y += 3;
  doc.setDrawColor(220, 215, 208);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);
  y += 3;

  const rows = milkRecords
    .slice()
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .map(r => [
      fmtDate(r.recordedAt, isEn),
      sessionLabel(r.session, isEn),
      `${Number(r.amountLiters).toFixed(1)} L`,
      r.notes || "—",
    ]);

  autoTable(doc, {
    head: [[
      isEn ? "Date" : "Fecha",
      isEn ? "Session" : "Sesión",
      isEn ? "Amount" : "Cantidad",
      isEn ? "Notes" : "Notas",
    ]],
    body: rows.length > 0 ? rows : [[{ content: "—", colSpan: 4, styles: { halign: "center" } }]],
    startY: y,
    theme: "striped",
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    alternateRowStyles: { fillColor: [253, 250, 245] },
    styles: { fontSize: 8.5, cellPadding: 3 },
    tableLineColor: [220, 215, 208],
    tableLineWidth: 0.1,
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 30 },
      2: { cellWidth: 22 },
      3: { cellWidth: "auto" },
    },
  });

  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  const footerLabel = farmName ?? "miFinca";
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.setFont("helvetica", "normal");
    const footer = `${footerLabel} · ${displayName} · ${exportDate} · ${i} / ${pageCount}`;
    doc.text(footer, pageW - 14, doc.internal.pageSize.height - 8, { align: "right" });
  }

  doc.save(filename);
}
