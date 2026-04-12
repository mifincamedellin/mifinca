import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useUpgradeStore } from "@/lib/upgradeStore";
import { useListFarms } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Users, Plus, Pencil, Trash2, Phone, Mail, CalendarDays,
  Banknote, Building2, TrendingUp, Loader2, ChevronDown, ChevronUp,
  HeartPulse, ShieldCheck, Receipt, Coins, Calculator, FileText,
  Image, File, Download, X, ZoomIn, Paperclip, Upload, Camera,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type Employee = {
  id: string; farmId: string; name: string; phone?: string | null;
  email?: string | null; startDate?: string | null; monthlySalary?: string | null;
  bankName?: string | null; bankAccount?: string | null; notes?: string | null;
  pension?: string | null; salud?: string | null; arl?: string | null;
  primas?: string | null; cesantias?: string | null; photoUrl?: string | null;
};

type Attachment = {
  id: string; employeeId: string; farmId: string; fileKey: string;
  originalName: string; mimeType: string; sizeBytes: number; createdAt?: string | null;
};

const EMPTY_FORM = {
  name: "", phone: "", email: "", startDate: "",
  monthlySalary: "", bankName: "Bancolombia", bankAccount: "", notes: "",
  pension: "", salud: "", arl: "", primas: "", cesantias: "", photoUrl: "",
};

const COL_RATES = {
  pension: 0.12, salud: 0.085, arl: 0.0052, primas: 0.5, cesantias: 1.0,
};

function autoCalcBenefits(salary: string) {
  const s = parseFloat(salary) || 0;
  return {
    pension: Math.round(s * COL_RATES.pension).toString(),
    salud: Math.round(s * COL_RATES.salud).toString(),
    arl: Math.round(s * COL_RATES.arl).toString(),
    primas: Math.round(s * COL_RATES.primas).toString(),
    cesantias: Math.round(s * COL_RATES.cesantias).toString(),
  };
}

function daysUntilPayday(payDay: number): number {
  const today = new Date();
  const d = today.getDate();
  if (d < payDay) return payDay - d;
  const next = new Date(today.getFullYear(), today.getMonth() + 1, payDay);
  return Math.ceil((next.getTime() - today.getTime()) / 86400000);
}

function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

// COP input helpers — display with . thousands separator, store raw digits
function copDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("es-CO");
}
function copRaw(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

// Auto-format Colombian bank account numbers as XXX-XXXXXX-XX
function formatBankAccount(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 9) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 9)}-${d.slice(9)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function num(v?: string | null) { return parseFloat(v ?? "0") || 0; }

function getServeUrl(att: Attachment): string {
  return `/api/farms/${att.farmId}/employees/${att.employeeId}/attachments/${att.id}/file`;
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

const CROP_SIZE = 240;

function PhotoCropModal({ src, onConfirm, onCancel }: {
  src: string;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Use refs for values accessed in pointer event handlers to avoid stale closures
  const isDragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const imgNat = useRef({ w: 1, h: 1 });
  const scaleRef = useRef(1);

  // Clamp reads from refs — always fresh, no useCallback dependency issues
  const clamp = (ox: number, oy: number, sc: number) => {
    const hw = Math.max(0, (imgNat.current.w * sc - CROP_SIZE) / 2);
    const hh = Math.max(0, (imgNat.current.h * sc - CROP_SIZE) / 2);
    return {
      x: Math.min(hw, Math.max(-hw, ox)),
      y: Math.min(hh, Math.max(-hh, oy)),
    };
  };

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    imgNat.current = { w: img.naturalWidth, h: img.naturalHeight };
    const cover = Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight);
    scaleRef.current = cover;
    setMinScale(cover);
    setScale(cover);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    // Capture starting positions at the moment of press
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setOffset(clamp(dragStart.current.ox + dx, dragStart.current.oy + dy, scaleRef.current));
  };

  const onPointerUp = () => { isDragging.current = false; };

  const handleScaleChange = (newScale: number) => {
    scaleRef.current = newScale;
    setScale(newScale);
    setOffset(prev => clamp(prev.x, prev.y, newScale));
  };

  const handleConfirm = () => {
    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext("2d")!;
    const { w, h } = imgNat.current;
    const srcX = w / 2 - (CROP_SIZE / 2 + offset.x) / scale;
    const srcY = h / 2 - (CROP_SIZE / 2 + offset.y) / scale;
    ctx.drawImage(imgRef.current!, srcX, srcY, CROP_SIZE / scale, CROP_SIZE / scale, 0, 0, CROP_SIZE, CROP_SIZE);
    onConfirm(canvas.toDataURL("image/jpeg", 0.88));
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border/30"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-serif font-bold text-primary text-lg mb-0.5">Ajustar foto</h3>
        <p className="text-xs text-muted-foreground mb-4">Arrastra para encuadrar · Desliza para hacer zoom</p>

        <div className="flex justify-center mb-4">
          <div
            className="relative overflow-hidden rounded-full border-2 border-primary/30 select-none bg-muted/30 cursor-grab active:cursor-grabbing"
            style={{ width: CROP_SIZE, height: CROP_SIZE, touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <img
              ref={imgRef}
              src={src}
              alt="crop preview"
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: imgNat.current.w * scale,
                height: imgNat.current.h * scale,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <span className="text-muted-foreground text-sm font-medium select-none">−</span>
          <input
            type="range"
            className="flex-1 accent-primary"
            min={minScale}
            max={minScale * 4}
            step={0.001}
            value={scale}
            onChange={e => handleScaleChange(parseFloat(e.target.value))}
          />
          <span className="text-muted-foreground text-sm font-medium select-none">+</span>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" className="flex-1 rounded-xl" onClick={handleConfirm}>
            Usar foto
          </Button>
        </div>
      </div>
    </div>
  );
}

function useAuthBlobUrl(url: string | null): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return blobUrl;
}

async function downloadAttachment(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) return;
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function openPdfInTab(url: string) {
  const response = await fetch(url);
  if (!response.ok) return;
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank");
}

function LightboxImage({ url, name, t }: { url: string; name: string; t: (key: string) => string }) {
  const blobUrl = useAuthBlobUrl(url);
  return (
    <>
      <div className="flex items-center justify-center min-h-[300px] max-h-[80vh] overflow-auto">
        {blobUrl ? (
          <img src={blobUrl} alt={name} className="max-w-full max-h-[75vh] object-contain rounded-xl" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
        )}
      </div>
      <div className="flex justify-end gap-2 px-3 pb-3">
        <button
          onClick={() => downloadAttachment(url, name)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          {t("emp.download")}
        </button>
      </div>
    </>
  );
}

function AttachmentThumb({ att, onDelete, onView }: {
  att: Attachment;
  onDelete: () => void;
  onView: () => void;
}) {
  const { t } = useTranslation();
  const isImage = isImageMime(att.mimeType);
  const isPdf = att.mimeType === "application/pdf";
  const serveUrl = getServeUrl(att);
  const blobUrl = useAuthBlobUrl(isImage ? serveUrl : null);

  return (
    <div className="relative group rounded-xl border border-border/40 bg-card/70 overflow-hidden hover:border-primary/30 transition-colors">
      {isImage ? (
        <button onClick={onView} className="w-full aspect-square block overflow-hidden bg-muted/30">
          {blobUrl ? (
            <img
              src={blobUrl}
              alt={att.originalName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
            </div>
          )}
        </button>
      ) : (
        <button
          onClick={() => isPdf ? openPdfInTab(serveUrl) : downloadAttachment(serveUrl, att.originalName)}
          className="w-full aspect-square flex flex-col items-center justify-center gap-2 bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          {isPdf ? (
            <FileText className="h-8 w-8 text-red-500" />
          ) : (
            <File className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground text-center px-2 leading-tight line-clamp-2">{att.originalName}</span>
        </button>
      )}
      <div className="px-2 py-1.5 border-t border-border/30">
        <p className="text-xs text-muted-foreground truncate leading-tight" title={att.originalName}>{att.originalName}</p>
        <p className="text-xs text-muted-foreground/60">{formatBytes(att.sizeBytes)}</p>
      </div>

      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {isImage && (
          <button
            onClick={onView}
            className="p-1 rounded-lg bg-background/80 backdrop-blur-sm text-foreground hover:bg-background shadow-sm"
            title={t("emp.download")}
          >
            <ZoomIn className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); downloadAttachment(serveUrl, att.originalName); }}
          className="p-1 rounded-lg bg-background/80 backdrop-blur-sm text-foreground hover:bg-background shadow-sm"
          title={t("emp.download")}
        >
          <Download className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded-lg bg-background/80 backdrop-blur-sm text-destructive hover:bg-background shadow-sm"
          title={t("emp.deleteAttachment")}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function EmployeeExpandedPanel({ emp, farmId }: { emp: Employee; farmId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [notesDraft, setNotesDraft] = useState(emp.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesSaveError, setNotesSaveError] = useState(false);
  const savedNotesRef = useRef(emp.notes ?? "");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasBenefits = num(emp.pension) + num(emp.salud) + num(emp.arl) + num(emp.primas) + num(emp.cesantias) > 0;

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery<Attachment[]>({
    queryKey: ["employee-attachments", farmId, emp.id],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${farmId}/employees/${emp.id}/attachments`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const saveNotes = useCallback(async (draft: string) => {
    if (draft === savedNotesRef.current) return;
    setNotesSaving(true);
    try {
      const body = {
        name: emp.name, phone: emp.phone, email: emp.email,
        startDate: emp.startDate, monthlySalary: emp.monthlySalary,
        bankName: emp.bankName, bankAccount: emp.bankAccount,
        notes: draft,
        pension: emp.pension, salud: emp.salud, arl: emp.arl,
        primas: emp.primas, cesantias: emp.cesantias,
      };
      const res = await fetch(`/api/farms/${farmId}/employees/${emp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed");
      savedNotesRef.current = draft;
      qc.invalidateQueries({ queryKey: ["employees", farmId] });
      setNotesSaved(true);
      setNotesSaveError(false);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      setNotesSaveError(true);
      setTimeout(() => setNotesSaveError(false), 3000);
    } finally {
      setNotesSaving(false);
    }
  }, [emp, farmId, qc]);

  const uploadFile = useCallback(async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setUploadError(t("emp.dropzoneFormats"));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError(t("emp.fileTooLarge"));
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const attRes = await fetch(`/api/farms/${farmId}/employees/${emp.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      if (!attRes.ok) throw new Error("upload_error");
      const { attachment, uploadURL } = await attRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("upload_error");

      // Confirm the attachment only after a successful upload
      const confirmRes = await fetch(
        `/api/farms/${farmId}/employees/${emp.id}/attachments/${attachment.id}/confirm`,
        { method: "PATCH" },
      );
      if (!confirmRes.ok) throw new Error("upload_error");

      qc.invalidateQueries({ queryKey: ["employee-attachments", farmId, emp.id] });
    } catch {
      setUploadError(t("emp.uploadError"));
    } finally {
      setIsUploading(false);
    }
  }, [emp.id, farmId, qc]);

  const deleteAttachment = useCallback(async (att: Attachment) => {
    try {
      const res = await fetch(`/api/farms/${farmId}/employees/${emp.id}/attachments/${att.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
      qc.invalidateQueries({ queryKey: ["employee-attachments", farmId, emp.id] });
    } catch {
      setUploadError(t("emp.attachmentDeleteFail"));
    }
  }, [emp.id, farmId, qc, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(uploadFile);
  }, [uploadFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(uploadFile);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadFile]);

  const benefitRows = hasBenefits ? [
    { label: t("emp.pension"), value: num(emp.pension), sub: t("emp.perMonth"), icon: ShieldCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100/60 dark:bg-blue-950/40" },
    { label: t("emp.salud"), value: num(emp.salud), sub: t("emp.perMonth"), icon: HeartPulse, color: "text-rose-500 dark:text-rose-400", bg: "bg-rose-100/60 dark:bg-rose-950/40" },
    { label: t("emp.arl"), value: num(emp.arl), sub: t("emp.perMonth"), icon: ShieldCheck, color: "text-orange-500 dark:text-orange-400", bg: "bg-orange-100/60 dark:bg-orange-950/40" },
    { label: t("emp.primas"), value: num(emp.primas), sub: t("emp.perSemester"), icon: Receipt, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100/60 dark:bg-violet-950/40" },
    { label: t("emp.cesantias"), value: num(emp.cesantias), sub: t("emp.perYear"), icon: Coins, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100/60 dark:bg-amber-950/40" },
  ] : [];

  return (
    <>
      <Separator />
      <div className="px-5 py-5 bg-muted/15 space-y-6">

        {/* Benefits section */}
        {hasBenefits && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("emp.benefitsSection")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {benefitRows.map(b => (
                <div key={b.label} className="bg-card/70 rounded-xl px-3 py-2.5 border border-border/30 flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg ${b.bg} mt-0.5 flex-shrink-0`}>
                    <b.icon className={`h-3.5 w-3.5 ${b.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{b.label}</p>
                    <p className="text-sm font-semibold text-foreground">{formatCOP(b.value)}</p>
                    <p className="text-xs text-muted-foreground/60">{b.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            {t("emp.notesSection")}
            {notesSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60" />}
            {notesSaved && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal normal-case tracking-normal">✓ {t("emp.notesUpdated")}</span>}
            {notesSaveError && <span className="text-xs text-red-500 dark:text-red-400 font-normal normal-case tracking-normal">⚠ {t("emp.notesSaveError")}</span>}
          </p>
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={e => saveNotes(e.target.value)}
            placeholder={t("emp.notesPlaceholder")}
            rows={3}
            className="w-full resize-none rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Attachments section */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />{t("emp.attachmentsSection")}
          </p>

          {/* Drag-and-drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`
              relative rounded-xl border-2 border-dashed px-4 py-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all mb-4
              ${isDragging
                ? "border-primary/60 bg-primary/5 scale-[1.01]"
                : "border-border/40 hover:border-primary/30 hover:bg-muted/20 bg-muted/10"
              }
              ${isUploading ? "pointer-events-none opacity-70" : ""}
            `}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t("emp.uploading")}</p>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground text-center">{t("emp.dropzone")}</p>
                <p className="text-xs text-muted-foreground/50">{t("emp.dropzoneFormats")}</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={handleFileInput}
              accept="image/jpeg,image/png,application/pdf"
            />
          </div>

          {uploadError && (
            <p className="text-xs text-destructive mb-3">{uploadError}</p>
          )}

          {/* Attachment gallery */}
          {attachmentsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t("emp.attachmentsLoading")}</span>
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic">{t("emp.noAttachments")}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {attachments.map(att => (
                <AttachmentThumb
                  key={att.id}
                  att={att}
                  onDelete={() => deleteAttachment(att)}
                  onView={() => {
                    setLightboxUrl(getServeUrl(att));
                    setLightboxName(att.originalName);
                  }}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={(v) => { if (!v) setLightboxUrl(null); }}>
        <DialogContent className="max-w-4xl rounded-2xl p-2 bg-background/95 border-border/50">
          <DialogHeader className="px-3 pt-2 pb-1">
            <DialogTitle className="text-sm font-medium text-muted-foreground truncate">{lightboxName}</DialogTitle>
          </DialogHeader>
          {lightboxUrl && <LightboxImage url={lightboxUrl} name={lightboxName} t={t} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Employees() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const qc = useQueryClient();
  const { openUpgradeModal } = useUpgradeStore();
  const isEn = i18n.language === "en";

  const { data: farms } = useListFarms({ query: { enabled: !!activeFarmId } });
  const activeFarm = farms?.find((f: any) => f.id === activeFarmId);
  const payDay: number = (activeFarm as any)?.payDay ?? 30;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/employees`);
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const createEmployee = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const res = await fetch(`/api/farms/${activeFarmId}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error("failed"), { data: body, status: res.status });
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees", activeFarmId] }); closeDialog(); },
    onError: (err: any) => {
      if (err?.data?.error === "plan_limit") {
        openUpgradeModal("employees", err.data.limit);
      }
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM & { id: string }) => {
      const { id, ...body } = data;
      const res = await fetch(`/api/farms/${activeFarmId}/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees", activeFarmId] }); closeDialog(); },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/farms/${activeFarmId}/employees/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees", activeFarmId] }); setDeleteConfirm(null); },
  });

  const openAdd = () => { setEditEmployee(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (emp: Employee) => {
    setEditEmployee(emp);
    setForm({
      name: emp.name,
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      startDate: emp.startDate ?? "",
      monthlySalary: emp.monthlySalary ?? "",
      bankName: emp.bankName ?? "Bancolombia",
      bankAccount: emp.bankAccount ?? "",
      notes: emp.notes ?? "",
      pension: emp.pension ?? "",
      salud: emp.salud ?? "",
      arl: emp.arl ?? "",
      primas: emp.primas ?? "",
      cesantias: emp.cesantias ?? "",
      photoUrl: emp.photoUrl ?? "",
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditEmployee(null); setForm(EMPTY_FORM); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editEmployee) updateEmployee.mutate({ ...form, id: editEmployee.id });
    else createEmployee.mutate(form);
  };

  const handleAutoCalc = () => { setForm(f => ({ ...f, ...autoCalcBenefits(f.monthlySalary) })); };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Totals ──
  const totals = useMemo(() => ({
    monthly: employees.reduce((s, e) => s + num(e.monthlySalary), 0),
    pension: employees.reduce((s, e) => s + num(e.pension), 0),
    salud: employees.reduce((s, e) => s + num(e.salud), 0),
    arl: employees.reduce((s, e) => s + num(e.arl), 0),
    primas: employees.reduce((s, e) => s + num(e.primas), 0),
    cesantias: employees.reduce((s, e) => s + num(e.cesantias), 0),
  }), [employees]);

  const daysUntil = daysUntilPayday(payDay);
  const isPending = createEmployee.isPending || updateEmployee.isPending;

  const topCards = [
    { icon: CalendarDays, color: "text-accent", bg: "bg-accent/10", label: t("emp.daysUntil"), value: t("emp.daysCount", { count: daysUntil }) },
    { icon: Banknote, color: "text-secondary", bg: "bg-secondary/10", label: t("emp.monthlyPayroll"), value: formatCOP(totals.monthly) },
    { icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100/60 dark:bg-emerald-950/40", label: t("emp.annualPayroll"), value: formatCOP(totals.monthly * 12) },
  ];

  const benefitCards = [
    { icon: ShieldCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100/60 dark:bg-blue-950/40", label: t("emp.totalPension"), value: formatCOP(totals.pension), sub: t("emp.perMonth") },
    { icon: HeartPulse, color: "text-rose-500 dark:text-rose-400", bg: "bg-rose-100/60 dark:bg-rose-950/40", label: t("emp.totalSalud"), value: formatCOP(totals.salud), sub: t("emp.perMonth") },
    { icon: ShieldCheck, color: "text-orange-500 dark:text-orange-400", bg: "bg-orange-100/60 dark:bg-orange-950/40", label: t("emp.totalArl"), value: formatCOP(totals.arl), sub: t("emp.perMonth") },
    { icon: Receipt, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100/60 dark:bg-violet-950/40", label: t("emp.totalPrimas"), value: formatCOP(totals.primas), sub: t("emp.perSemester") },
    { icon: Coins, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100/60 dark:bg-amber-950/40", label: t("emp.totalCesantias"), value: formatCOP(totals.cesantias), sub: t("emp.perYear") },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">{t("emp.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("emp.subtitle")}</p>
        </div>
        <Button onClick={openAdd} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> {t("emp.addEmployee")}
        </Button>
      </div>

      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {topCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Card className="p-5 rounded-2xl border-border/50 shadow-sm bg-card/60 h-full">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${card.bg} flex-shrink-0`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{card.label}</p>
                  <p className="text-2xl font-serif font-bold text-foreground leading-tight">{card.value}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Prestaciones sociales totals */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("emp.obligationsTitle")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {benefitCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
              <Card className="p-4 rounded-2xl border-border/50 shadow-sm bg-card/60 h-full">
                <div className={`w-8 h-8 rounded-xl ${card.bg} flex items-center justify-center mb-2`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{card.label}</p>
                <p className="text-base font-serif font-bold text-foreground leading-tight">{card.value}</p>
                <p className="text-xs text-muted-foreground/70">{card.sub}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Employee list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : employees.length === 0 ? (
        <Card className="rounded-2xl border-border/50 p-16 flex flex-col items-center text-center text-muted-foreground gap-4">
          <div className="p-5 bg-muted/30 rounded-2xl">
            <Users className="h-10 w-10 text-border" />
          </div>
          <div>
            <p className="font-semibold text-foreground/70 mb-1">{t("emp.noEmployees")}</p>
            <p className="text-sm">{t("emp.noEmployeesDesc")}</p>
          </div>
          <Button onClick={openAdd} variant="outline" className="mt-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5">
            <Plus className="h-4 w-4 mr-2" /> {t("emp.addEmployee")}
          </Button>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border/50 shadow-sm bg-card/60 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[minmax(0,1fr)_130px_190px_190px_140px_96px] gap-4 px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 bg-muted/30">
            <span>{t("emp.name")}</span>
            <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{t("emp.phone")}</span>
            <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{t("emp.email")}</span>
            <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{t("emp.bankName")}</span>
            <span className="text-right">{t("emp.monthly")}</span>
            <span />
          </div>

          {employees.map((emp, i) => {
            const isExpanded = expandedId === emp.id;
            return (
              <motion.div key={emp.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                {i > 0 && <Separator className="opacity-40" />}

                {/* Main row */}
                <div className="grid grid-cols-[minmax(0,1fr)_130px_190px_190px_140px_96px] gap-4 px-5 py-4 items-center hover:bg-muted/20 transition-colors">

                  {/* Avatar + name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-serif font-bold text-primary">{emp.name.substring(0, 2).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground leading-tight truncate">{emp.name}</p>
                      {emp.startDate && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 flex-shrink-0" />
                          {format(new Date(emp.startDate + "T12:00:00"), isEn ? "MMM d, yyyy" : "d MMM yyyy", { locale: isEn ? undefined : es })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="text-sm text-muted-foreground truncate min-w-0">
                    {emp.phone || <span className="text-muted-foreground/30">—</span>}
                  </div>

                  {/* Email */}
                  <div className="text-sm text-muted-foreground truncate min-w-0">
                    {emp.email || <span className="text-muted-foreground/30">—</span>}
                  </div>

                  {/* Bank */}
                  <div className="min-w-0">
                    {emp.bankName || emp.bankAccount ? (
                      <>
                        <p className="text-sm text-muted-foreground truncate">{emp.bankName || "—"}</p>
                        {emp.bankAccount && <p className="text-xs font-mono text-muted-foreground/60 truncate">{emp.bankAccount}</p>}
                      </>
                    ) : <span className="text-sm text-muted-foreground/30">—</span>}
                  </div>

                  {/* Salary */}
                  <div className="text-right">
                    <p className="font-serif font-bold text-secondary text-base">{formatCOP(num(emp.monthlySalary))}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
                      title={isExpanded ? t("emp.collapseRow") : t("emp.expandRow")}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(emp)} className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(emp.id)} className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <EmployeeExpandedPanel emp={emp} farmId={activeFarmId!} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </Card>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-primary text-xl">
              {editEmployee ? t("emp.editEmployee") : t("emp.addEmployee")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Photo upload */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-dashed border-border/60 flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => photoInputRef.current?.click()}
              >
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <Label className="text-sm font-medium">{t("emp.photo")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t("emp.photoHint")}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {form.photoUrl ? t("emp.changePhoto") : t("emp.uploadPhoto")}
                  </Button>
                  {form.photoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-xs text-muted-foreground"
                      onClick={() => { setForm(f => ({ ...f, photoUrl: "" })); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                    >
                      {t("emp.removePhoto")}
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Basic info */}
            <div>
              <Label>{t("emp.name")} *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="rounded-xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("emp.phone")}</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl mt-1" placeholder="+57 300 000 0000" />
              </div>
              <div>
                <Label>{t("emp.email")}</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="rounded-xl mt-1" placeholder="correo@ejemplo.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("emp.startDate")}</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label>{t("emp.salary")}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={copDisplay(form.monthlySalary)}
                  onChange={e => setForm(f => ({ ...f, monthlySalary: copRaw(e.target.value) }))}
                  className="rounded-xl mt-1"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("emp.bankName")}</Label>
                <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label>{t("emp.bankAccount")}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.bankAccount}
                  onChange={e => setForm(f => ({ ...f, bankAccount: formatBankAccount(e.target.value) }))}
                  className="rounded-xl mt-1 font-mono tracking-wide"
                  placeholder="000-000000-00"
                  maxLength={13}
                />
              </div>
            </div>
            <div>
              <Label>{t("emp.notes")}</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="rounded-xl mt-1" />
            </div>

            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{t("emp.benefitsSection")}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 border-secondary/30 text-secondary hover:bg-secondary/5"
                  onClick={handleAutoCalc}
                  disabled={!form.monthlySalary}
                >
                  <Calculator className="h-3.5 w-3.5" />
                  {t("emp.autoCalc")}
                </Button>
              </div>
              {!form.monthlySalary && (
                <p className="text-xs text-muted-foreground">{t("emp.autoCalcHint")}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                    {t("emp.pension")} <span className="text-muted-foreground font-normal">{t("emp.perMonth")}</span>
                  </Label>
                  <Input type="text" inputMode="numeric" value={copDisplay(form.pension)} onChange={e => setForm(f => ({ ...f, pension: copRaw(e.target.value) }))} className="rounded-xl mt-1" placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <HeartPulse className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                    {t("emp.salud")} <span className="text-muted-foreground font-normal">{t("emp.perMonth")}</span>
                  </Label>
                  <Input type="text" inputMode="numeric" value={copDisplay(form.salud)} onChange={e => setForm(f => ({ ...f, salud: copRaw(e.target.value) }))} className="rounded-xl mt-1" placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
                    {t("emp.arl")} <span className="text-muted-foreground font-normal">{t("emp.perMonth")}</span>
                  </Label>
                  <Input type="text" inputMode="numeric" value={copDisplay(form.arl)} onChange={e => setForm(f => ({ ...f, arl: copRaw(e.target.value) }))} className="rounded-xl mt-1" placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    {t("emp.primas")} <span className="text-muted-foreground font-normal">{t("emp.perSemester")}</span>
                  </Label>
                  <Input type="text" inputMode="numeric" value={copDisplay(form.primas)} onChange={e => setForm(f => ({ ...f, primas: copRaw(e.target.value) }))} className="rounded-xl mt-1" placeholder="0" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    {t("emp.cesantias")} <span className="text-muted-foreground font-normal">{t("emp.perYear")}</span>
                  </Label>
                  <Input type="text" inputMode="numeric" value={copDisplay(form.cesantias)} onChange={e => setForm(f => ({ ...f, cesantias: copRaw(e.target.value) }))} className="rounded-xl mt-1" placeholder="0" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={closeDialog}>{t("common.cancel")}</Button>
              <Button type="submit" className="flex-1 rounded-xl bg-primary hover:bg-primary/90" disabled={isPending || !form.name.trim()}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Photo crop modal */}
      {cropSrc && (
        <PhotoCropModal
          src={cropSrc}
          onConfirm={(dataUrl) => { setForm(f => ({ ...f, photoUrl: dataUrl })); setCropSrc(null); }}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif text-destructive">{t("emp.confirmDelete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("emp.confirmDeleteDesc")}</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteConfirm(null)}>{t("common.cancel")}</Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl"
              onClick={() => deleteConfirm && deleteEmployee.mutate(deleteConfirm)}
              disabled={deleteEmployee.isPending}
            >
              {deleteEmployee.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t("emp.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
