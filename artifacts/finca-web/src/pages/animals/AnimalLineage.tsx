import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { useListAnimals } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GitBranch, Plus, X, Search, Link2, ArrowUp, ArrowDown } from "lucide-react";

const SPECIES_EMOJI: Record<string, string> = {
  cattle: "🐄", pig: "🐷", horse: "🐴", goat: "🐐",
  sheep: "🐑", chicken: "🐓", other: "🐾",
};

type AnimalStub = {
  id: string; name?: string | null; customTag?: string | null;
  species: string; sex?: string | null; photoUrl?: string | null;
};

interface Props {
  animal: AnimalStub & {
    mother?: AnimalStub | null;
    father?: AnimalStub | null;
    offspring?: AnimalStub[];
  };
  farmId: string;
  onRefresh: () => void;
}

type PickerMode =
  | { type: "mother" }
  | { type: "father" }
  | { type: "child" };

function AnimalCard({
  animal, role, onUnlink, linkTo,
}: {
  animal: AnimalStub; role: string; onUnlink?: () => void; linkTo?: string;
}) {
  const emoji = SPECIES_EMOJI[animal.species] ?? "🐾";
  const displayName = animal.name || animal.customTag || animal.species;

  const inner = (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow w-full">
      <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
        {animal.photoUrl
          ? <img src={animal.photoUrl} alt="" className="w-full h-full object-cover rounded-xl" />
          : emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{role}</p>
        <p className="font-semibold text-foreground truncate">{displayName}</p>
        {animal.customTag && animal.name && (
          <p className="text-xs text-muted-foreground">{animal.customTag}</p>
        )}
      </div>
      {onUnlink && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnlink(); }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
          title="Unlink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return linkTo ? (
    <Link href={linkTo} className="block w-full">{inner}</Link>
  ) : (
    <div className="w-full">{inner}</div>
  );
}

function EmptySlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/4 transition-all w-full text-muted-foreground hover:text-primary group"
    >
      <div className="w-10 h-10 rounded-xl border-2 border-dashed border-border/50 group-hover:border-primary/40 flex items-center justify-center">
        <Plus className="h-4 w-4" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
    </button>
  );
}

function AnimalPicker({
  open, onClose, onSelect, exclude, title, showRolePicker, farmId, species,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string, role?: "mother" | "father") => void;
  exclude: string[];
  title: string;
  showRolePicker?: boolean;
  farmId: string;
  species: string;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<"mother" | "father">("mother");

  const { data: allAnimals } = useListAnimals(farmId, {}, { query: { enabled: open && !!farmId } });

  const filtered = useMemo(() => {
    const animals = (allAnimals ?? []).filter((a: AnimalStub) => !exclude.includes(a.id) && a.species === species);
    if (!search.trim()) return animals;
    const q = search.toLowerCase();
    return animals.filter((a: AnimalStub) =>
      (a.name ?? "").toLowerCase().includes(q) ||
      (a.customTag ?? "").toLowerCase().includes(q)
    );
  }, [allAnimals, exclude, search]);

  const handleConfirm = () => {
    if (!selectedId) return;
    onSelect(selectedId, showRolePicker ? role : undefined);
    setSelectedId(null);
    setSearch("");
    setRole("mother");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-primary">{title}</DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("lineage.searchPlaceholder")}
            className="pl-9 rounded-xl"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">{t("lineage.noAnimals")}</p>
          ) : filtered.map((a: AnimalStub) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(prev => prev === a.id ? null : a.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                selectedId === a.id
                  ? "border-primary/50 bg-primary/6 shadow-sm"
                  : "border-border/30 hover:border-border/60 hover:bg-muted/30"
              }`}
            >
              <span className="text-xl">{SPECIES_EMOJI[a.species] ?? "🐾"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.name || a.customTag || a.species}</p>
                {a.customTag && a.name && <p className="text-xs text-muted-foreground">{a.customTag}</p>}
              </div>
              {selectedId === a.id && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
            </button>
          ))}
        </div>

        {showRolePicker && selectedId && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("lineage.roleLabel")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["mother", "father"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`p-2.5 rounded-xl border text-sm font-medium transition-all ${
                    role === r ? "border-primary/50 bg-primary/6 text-primary" : "border-border/30 hover:border-border/60 text-muted-foreground"
                  }`}
                >
                  {r === "mother" ? `♀ ${t("lineage.roleMother")}` : `♂ ${t("lineage.roleFather")}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            className="flex-1 rounded-xl bg-primary hover:bg-primary/90"
            disabled={!selectedId}
            onClick={handleConfirm}
          >
            {t("lineage.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AnimalLineage({ animal, farmId, onRefresh }: Props) {
  const { t } = useTranslation();
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const [loading, setLoading] = useState(false);

  const patchLineage = async (body: object) => {
    setLoading(true);
    try {
      await fetch(`/api/farms/${farmId}/animals/${animal.id}/lineage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handlePickerSelect = async (selectedId: string, role?: "mother" | "father") => {
    if (!picker) return;
    if (picker.type === "mother") {
      await patchLineage({ action: "setMother", parentId: selectedId });
    } else if (picker.type === "father") {
      await patchLineage({ action: "setFather", parentId: selectedId });
    } else if (picker.type === "child") {
      await patchLineage({ action: "addChild", childId: selectedId, role: role ?? "mother" });
    }
  };

  const excludeIds = [
    animal.id,
    animal.mother?.id,
    animal.father?.id,
    ...(animal.offspring?.map(o => o.id) ?? []),
  ].filter(Boolean) as string[];

  const pickerTitle = picker?.type === "mother"
    ? t("lineage.linkMother")
    : picker?.type === "father"
    ? t("lineage.linkFather")
    : t("lineage.addChild");

  return (
    <div className="space-y-8">
      {/* ── PARENTS ── */}
      <Card className="p-6 rounded-2xl border-border/50 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 bg-primary/8 rounded-lg">
            <ArrowUp className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-serif text-primary">{t("lineage.parents")}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Mother */}
          {animal.mother ? (
            <AnimalCard
              animal={animal.mother}
              role={t("lineage.mother")}
              onUnlink={() => patchLineage({ action: "setMother", parentId: null })}
              linkTo={`/animals/${animal.mother.id}`}
            />
          ) : (
            <EmptySlot label={t("lineage.linkMother")} onClick={() => setPicker({ type: "mother" })} />
          )}

          {/* Father */}
          {animal.father ? (
            <AnimalCard
              animal={animal.father}
              role={t("lineage.father")}
              onUnlink={() => patchLineage({ action: "setFather", parentId: null })}
              linkTo={`/animals/${animal.father.id}`}
            />
          ) : (
            <EmptySlot label={t("lineage.linkFather")} onClick={() => setPicker({ type: "father" })} />
          )}
        </div>
      </Card>

      {/* ── THIS ANIMAL (connector) ── */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-primary text-primary-foreground shadow-md">
          <GitBranch className="h-4 w-4" />
          <span className="font-serif font-semibold">
            {animal.name || animal.customTag || animal.species}
          </span>
          <Link2 className="h-4 w-4 opacity-60" />
        </div>
      </div>

      {/* ── OFFSPRING ── */}
      <Card className="p-6 rounded-2xl border-border/50 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <ArrowDown className="h-4 w-4 text-secondary" />
            </div>
            <h3 className="text-lg font-serif text-primary">{t("lineage.offspring")}</h3>
            {(animal.offspring?.length ?? 0) > 0 && (
              <span className="text-xs bg-secondary/15 text-secondary font-semibold px-2 py-0.5 rounded-full">
                {animal.offspring!.length}
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => setPicker({ type: "child" })}
            className="rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            disabled={loading}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("lineage.addChild")}
          </Button>
        </div>

        {(!animal.offspring || animal.offspring.length === 0) ? (
          <div className="py-10 flex flex-col items-center text-muted-foreground">
            <GitBranch className="h-10 w-10 text-border mb-3" />
            <p className="text-sm">{t("lineage.noOffspring")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {animal.offspring.map(child => (
              <AnimalCard
                key={child.id}
                animal={child}
                role={child.sex === "male" ? "♂" : child.sex === "female" ? "♀" : ""}
                onUnlink={() => patchLineage({ action: "removeChild", childId: child.id })}
                linkTo={`/animals/${child.id}`}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Picker dialog */}
      <AnimalPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onSelect={handlePickerSelect}
        exclude={excludeIds}
        title={pickerTitle}
        showRolePicker={picker?.type === "child"}
        farmId={farmId}
        species={animal.species}
      />
    </div>
  );
}
