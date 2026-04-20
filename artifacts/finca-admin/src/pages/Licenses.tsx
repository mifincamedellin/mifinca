import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type LicenseKey } from "@/lib/api";
import { format, parseISO, addYears } from "date-fns";
import {
  Key, Plus, Copy, Check, ShieldOff, ShieldCheck, Trash2, Loader2, ChevronLeft, ChevronRight
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
  revoked: "bg-red-50 text-red-700 border-red-200",
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="ml-1.5 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function GenerateModal({ onClose, onDone }: { onClose: () => void; onDone: (keys: LicenseKey[]) => void }) {
  const defaultExpiry = format(addYears(new Date(), 1), "yyyy-MM-dd");
  const [quantity, setQuantity] = useState("1");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [notes, setNotes] = useState("");

  const generate = useMutation({
    mutationFn: () => api.generateLicenses({
      quantity: Math.min(50, Math.max(1, Number(quantity) || 1)),
      expiresAt: new Date(expiresAt + "T23:59:59").toISOString(),
      notes: notes.trim() || undefined,
    }),
    onSuccess: (data) => onDone(data.keys),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" /> Generate License Keys
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Quantity (1–50)
            </label>
            <input
              type="number" min={1} max={50} value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Expiry Date
            </label>
            <input
              type="date" value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Notes (optional)
            </label>
            <input
              type="text" value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Batch for Q2 2026 orders"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        {generate.isError && (
          <p className="text-xs text-red-600 mt-3">Generation failed. Please try again.</p>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-border rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending || !expiresAt}
            className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate {quantity} key{Number(quantity) !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratedBanner({ keys, onClose }: { keys: LicenseKey[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const allKeys = keys.map(k => k.key).join("\n");
  const handleCopyAll = () => {
    copyToClipboard(allKeys);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-emerald-800">
          {keys.length} key{keys.length !== 1 ? "s" : ""} generated successfully
        </p>
        <div className="flex items-center gap-2">
          <button onClick={handleCopyAll} className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900 border border-emerald-300 rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition-colors">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied!" : "Copy all"}
          </button>
          <button onClick={onClose} className="text-xs text-emerald-600 hover:text-emerald-900">Dismiss</button>
        </div>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {keys.map(k => (
          <div key={k.id} className="flex items-center justify-between bg-white/80 rounded-lg px-3 py-1.5">
            <code className="text-xs font-mono text-emerald-900 tracking-wider">{k.key}</code>
            <CopyButton value={k.key} />
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = ["all", "active", "expired", "revoked"] as const;
type Tab = typeof TABS[number];

export default function Licenses() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [newKeys, setNewKeys] = useState<LicenseKey[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-licenses", tab, page],
    queryFn: () => api.licenses({ status: tab === "all" ? undefined : tab, page }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeLicense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-licenses"] }),
  });

  const unrevoke = useMutation({
    mutationFn: (id: string) => api.unrevokeLicense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-licenses"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteLicense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-licenses"] }),
  });

  const handleGenerated = (keys: LicenseKey[]) => {
    setNewKeys(keys);
    setShowModal(false);
    setTab("all");
    setPage(1);
    qc.invalidateQueries({ queryKey: ["admin-licenses"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Key className="h-6 w-6 text-primary" /> License Keys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate and manage yearly desktop access keys
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Generate Keys
        </button>
      </div>

      {newKeys && newKeys.length > 0 && (
        <GeneratedBanner keys={newKeys} onClose={() => setNewKeys(null)} />
      )}

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (data?.licenses.length ?? 0) === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            No {tab === "all" ? "" : tab} license keys found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Owner</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activated</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expires</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.licenses.map(lic => (
                <tr key={lic.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-xs text-foreground tracking-wider">{lic.key}</code>
                      <CopyButton value={lic.key} />
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[lic.status]}`}>
                      {lic.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {lic.ownerName || lic.ownerEmail ? (
                      <div>
                        <p className="text-xs font-medium text-foreground">{lic.ownerName ?? "—"}</p>
                        {lic.ownerEmail && <p className="text-xs text-muted-foreground">{lic.ownerEmail}</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">Not activated</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {lic.activatedAt ? format(parseISO(lic.activatedAt), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {format(parseISO(lic.expiresAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[140px] truncate">
                    {lic.notes ?? "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      {lic.status === "revoked" ? (
                        <button
                          onClick={() => unrevoke.mutate(lic.id)}
                          disabled={unrevoke.isPending}
                          title="Restore"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => revoke.mutate(lic.id)}
                          disabled={revoke.isPending}
                          title="Revoke"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <ShieldOff className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm("Delete this license key permanently?")) del.mutate(lic.id);
                        }}
                        disabled={del.isPending}
                        title="Delete"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
            <p className="text-xs text-muted-foreground">
              {data?.total} key{data?.total !== 1 ? "s" : ""} total
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">Page {page} of {data?.pages}</span>
              <button onClick={() => setPage(p => Math.min(data?.pages ?? 1, p + 1))} disabled={page === data?.pages} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <GenerateModal
          onClose={() => setShowModal(false)}
          onDone={(keys) => handleGenerated(keys)}
        />
      )}
    </div>
  );
}
