import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore, ALL_FARMS_ID } from "@/lib/store";
import { SelectFarmPrompt } from "@/components/SelectFarmPrompt";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, MapPin, Trash2, Loader2, Pencil, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DRAW_LOCAL: Record<string, typeof L.drawLocal> = {
  es: {
    draw: {
      toolbar: {
        actions: { title: "Cancelar dibujo", text: "Cancelar" },
        finish: { title: "Terminar dibujo", text: "Terminar" },
        undo: { title: "Eliminar el último punto", text: "Eliminar último punto" },
        buttons: {
          polyline: "Trazar una polilínea",
          polygon: "Trazar un polígono",
          rectangle: "Trazar un rectángulo",
          circle: "Trazar un círculo",
          marker: "Colocar un marcador",
          circlemarker: "Colocar un marcador circular",
        },
      },
      handlers: {
        circle: { tooltip: { start: "Haz clic y arrastra para dibujar un círculo." }, radius: "Radio" },
        circlemarker: { tooltip: { start: "Haz clic para colocar un marcador circular." } },
        marker: { tooltip: { start: "Haz clic para colocar un marcador." } },
        polygon: {
          tooltip: {
            start: "Haz clic para empezar a dibujar.",
            cont: "Haz clic para continuar dibujando.",
            end: "Haz clic en el primer punto para cerrar la zona.",
          },
        },
        polyline: {
          error: "<strong>Error:</strong> ¡Los bordes no pueden cruzarse!",
          tooltip: {
            start: "Haz clic para empezar a dibujar.",
            cont: "Haz clic para continuar.",
            end: "Haz doble clic para terminar.",
          },
        },
        rectangle: { tooltip: { start: "Haz clic y arrastra para dibujar." } },
        simpleshape: { tooltip: { end: "Suelta el ratón para terminar." } },
      },
    },
    edit: {
      toolbar: {
        actions: {
          save: { title: "Guardar cambios", text: "Guardar" },
          cancel: { title: "Cancelar edición", text: "Cancelar" },
          clearAll: { title: "Borrar todo", text: "Borrar todo" },
        },
        buttons: {
          edit: "Editar zonas",
          editDisabled: "No hay zonas para editar",
          remove: "Eliminar zonas",
          removeDisabled: "No hay zonas para eliminar",
        },
      },
      handlers: {
        edit: { tooltip: { text: "Arrastra los puntos para editar.", subtext: "Haz clic en Cancelar para deshacer." } },
        remove: { tooltip: { text: "Haz clic en una zona para eliminarla." } },
      },
    },
  },
  en: {
    draw: {
      toolbar: {
        actions: { title: "Cancel drawing", text: "Cancel" },
        finish: { title: "Finish drawing", text: "Finish" },
        undo: { title: "Delete last point drawn", text: "Delete last point" },
        buttons: {
          polyline: "Draw a polyline",
          polygon: "Draw a polygon",
          rectangle: "Draw a rectangle",
          circle: "Draw a circle",
          marker: "Draw a marker",
          circlemarker: "Draw a circlemarker",
        },
      },
      handlers: {
        circle: { tooltip: { start: "Click and drag to draw circle." }, radius: "Radius" },
        circlemarker: { tooltip: { start: "Click map to place circle marker." } },
        marker: { tooltip: { start: "Click map to place marker." } },
        polygon: {
          tooltip: {
            start: "Click to start drawing shape.",
            cont: "Click to continue drawing shape.",
            end: "Click first point to close this shape.",
          },
        },
        polyline: {
          error: "<strong>Error:</strong> shape edges cannot cross!",
          tooltip: {
            start: "Click to start drawing line.",
            cont: "Click to continue drawing line.",
            end: "Double click to finish line.",
          },
        },
        rectangle: { tooltip: { start: "Click and drag to draw rectangle." } },
        simpleshape: { tooltip: { end: "Release mouse to finish drawing." } },
      },
    },
    edit: {
      toolbar: {
        actions: {
          save: { title: "Save changes", text: "Save" },
          cancel: { title: "Cancel editing, discards all changes", text: "Cancel" },
          clearAll: { title: "Clear all layers", text: "Clear All" },
        },
        buttons: {
          edit: "Edit layers",
          editDisabled: "No layers to edit",
          remove: "Delete layers",
          removeDisabled: "No layers to delete",
        },
      },
      handlers: {
        edit: { tooltip: { text: "Drag handles or markers to edit features.", subtext: "Click cancel to undo changes." } },
        remove: { tooltip: { text: "Click on a feature to remove." } },
      },
    },
  },
};

function applyDrawLocale(lang: string) {
  const locale = DRAW_LOCAL[lang] ?? DRAW_LOCAL["es"]!;
  Object.assign(L.drawLocal.draw, locale.draw);
  Object.assign(L.drawLocal.edit, locale.edit);
}

interface LeafletIconDefaultExtended extends L.Icon.Default {
  _getIconUrl?: string;
}
delete (L.Icon.Default.prototype as LeafletIconDefaultExtended)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

interface LegacyGeometry {
  coordinates: [number, number][];
}

type ZoneGeometry = GeoJsonPolygon | LegacyGeometry;

interface Zone {
  id: string;
  name: string;
  color: string | null;
  notes: string | null;
  geometry: ZoneGeometry | null;
}

interface FarmData {
  id: string;
  mapLat: string | null;
  mapLng: string | null;
  mapZoom: number | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const ZONE_COLORS = [
  "#4A6741", "#7CB87A", "#3B82F6", "#F59E0B",
  "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4",
  "#F97316", "#84CC16", "#6B7280", "#92400E",
];

const COLOMBIA_CENTER: L.LatLngExpression = [4.5709, -74.2973];
const ESRI_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye";

function leafletToGeoJson(latlngs: L.LatLng[]): GeoJsonPolygon {
  const ring = latlngs.map((ll): [number, number] => [ll.lng, ll.lat]);
  if (ring.length > 0) ring.push(ring[0]!);
  return { type: "Polygon", coordinates: [ring] };
}

function geoJsonToLeaflet(geometry: ZoneGeometry): L.LatLngExpression[] {
  if ("type" in geometry && geometry.type === "Polygon") {
    return (geometry.coordinates[0] ?? []).map(([lng, lat]): L.LatLngExpression => [lat, lng]);
  }
  const legacy = geometry as LegacyGeometry;
  return legacy.coordinates.map(([lat, lng]): L.LatLngExpression => [lat, lng]);
}

interface ZonePanelProps {
  zone: Partial<Zone> | null;
  isNew: boolean;
  onSave: (data: { name: string; color: string; notes: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}

function ZonePanel({ zone, isNew, onSave, onDelete, onClose, isSaving, isDeleting }: ZonePanelProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(zone?.name ?? "");
  const [color, setColor] = useState(zone?.color ?? ZONE_COLORS[0]!);
  const [notes, setNotes] = useState(zone?.notes ?? "");

  useEffect(() => {
    setName(zone?.name ?? "");
    setColor(zone?.color ?? ZONE_COLORS[0]!);
    setNotes(zone?.notes ?? "");
  }, [zone?.id, isNew]);

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="absolute top-0 right-0 h-full w-80 bg-card/95 backdrop-blur-lg border-l border-border/50 shadow-2xl z-[2000] flex flex-col"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <h3 className="font-serif font-bold text-lg text-foreground">
          {isNew ? t("land.zone.newZone") : t("land.zone.editZone")}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave({ name: name.trim(), color, notes }); }}
        className="flex flex-col flex-1 overflow-y-auto p-5 gap-5"
      >
        <div className="space-y-2">
          <Label htmlFor="zone-name">{t("land.zone.name")}</Label>
          <Input
            id="zone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("land.zone.namePlaceholder")}
            className="rounded-xl"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label>{t("land.zone.color")}</Label>
          <div className="grid grid-cols-6 gap-2">
            {ZONE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "#ffffff" : "transparent",
                  boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-6 w-6 rounded-md border border-border flex-shrink-0" style={{ backgroundColor: color }} />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 rounded-lg font-mono text-sm"
              maxLength={7}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zone-notes">{t("land.zone.notes")}</Label>
          <Textarea
            id="zone-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("land.zone.notesPlaceholder")}
            className="rounded-xl resize-none"
            rows={3}
          />
        </div>

        <div className="mt-auto space-y-2 pt-4 border-t border-border/50">
          <Button type="submit" disabled={isSaving || !name.trim()} className="w-full rounded-xl bg-primary hover:bg-primary/90">
            {isSaving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.saving")}</>
              : t("common.save")}
          </Button>
          {!isNew && onDelete && (
            <Button
              type="button"
              variant="outline"
              onClick={onDelete}
              disabled={isDeleting}
              className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              {isDeleting
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Trash2 className="h-4 w-4 mr-2" />}
              {t("land.zone.delete")}
            </Button>
          )}
        </div>
      </form>
    </motion.div>
  );
}

interface FarmMapHandle {
  removeZoneLayer: (id: string) => void;
}

interface FarmMapProps {
  center: L.LatLngExpression;
  zoom: number;
  zones: Zone[];
  onZoneCreated: (geometry: GeoJsonPolygon) => void;
  onZoneSelected: (zone: Zone) => void;
  activeColor: string;
  lang: string;
  onDrawingChange: (isDrawing: boolean) => void;
}

const FarmMap = forwardRef<FarmMapHandle, FarmMapProps>(function FarmMap({
  lang,
  center,
  zoom,
  zones,
  onZoneCreated,
  onZoneSelected,
  activeColor,
  onDrawingChange,
}, ref) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const zoneLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const onZoneCreatedRef = useRef(onZoneCreated);
  const onZoneSelectedRef = useRef(onZoneSelected);
  const activeColorRef = useRef(activeColor);
  const onDrawingChangeRef = useRef(onDrawingChange);

  onZoneCreatedRef.current = onZoneCreated;
  onZoneSelectedRef.current = onZoneSelected;
  activeColorRef.current = activeColor;
  onDrawingChangeRef.current = onDrawingChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center, zoom });
    L.tileLayer(ESRI_SATELLITE, { attribution: ESRI_ATTRIBUTION, maxZoom: 20 }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    drawnItems.addTo(map);
    drawnItemsRef.current = drawnItems;

    applyDrawLocale(lang);
    const drawControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: activeColorRef.current,
            fillColor: activeColorRef.current,
            fillOpacity: 0.35,
            weight: 2,
          },
        },
        polyline: false,
        circle: false,
        rectangle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems, remove: false },
    });
    drawControl.addTo(map);
    drawControlRef.current = drawControl;

    map.on(L.Draw.Event.DRAWSTART, () => onDrawingChangeRef.current(true));
    map.on(L.Draw.Event.DRAWSTOP, () => onDrawingChangeRef.current(false));

    map.on(L.Draw.Event.CREATED, (e: L.DrawEvents.Created) => {
      onDrawingChangeRef.current(false);
      const polygon = e.layer as L.Polygon;
      const rawLatLngs = (polygon.getLatLngs() as L.LatLng[][])[0] ?? [];
      onZoneCreatedRef.current(leafletToGeoJson(rawLatLngs));
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    zoneLayersRef.current.forEach((layer) => map.removeLayer(layer));
    zoneLayersRef.current.clear();

    zones.forEach((zone) => {
      if (!zone.geometry) return;
      const positions = geoJsonToLeaflet(zone.geometry);
      if (positions.length < 3) return;
      const color = zone.color ?? "#4A6741";
      const polygon = L.polygon(positions, { color, fillColor: color, fillOpacity: 0.35, weight: 2 });
      polygon.bindTooltip(zone.name, { permanent: true, direction: "center", className: "zone-label" });
      polygon.on("click", () => onZoneSelectedRef.current(zone));
      polygon.addTo(map);
      zoneLayersRef.current.set(zone.id, polygon);
    });
  }, [zones]);

  useEffect(() => {
    const map = mapRef.current;
    const oldControl = drawControlRef.current;
    if (!map || !oldControl) return;

    applyDrawLocale(lang);
    map.removeControl(oldControl);
    const newControl = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: {
            color: activeColor,
            fillColor: activeColor,
            fillOpacity: 0.35,
            weight: 2,
          },
        },
        polyline: false,
        circle: false,
        rectangle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItemsRef.current!, remove: false },
    });
    newControl.addTo(map);
    drawControlRef.current = newControl;
  }, [activeColor, lang]);

  useImperativeHandle(ref, () => ({
    removeZoneLayer(id: string) {
      const map = mapRef.current;
      const layer = zoneLayersRef.current.get(id);
      if (map && layer) {
        map.removeLayer(layer);
        zoneLayersRef.current.delete(id);
      }
    },
  }));

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
});

function SetupMap({
  onSetLocation,
  isSaving,
}: {
  onSetLocation: (lat: number, lng: number, zoom: number) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [clicked, setClicked] = useState<{ lat: number; lng: number } | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center: COLOMBIA_CENTER, zoom: 6 });
    L.tileLayer(ESRI_SATELLITE, { attribution: ESRI_ATTRIBUTION, maxZoom: 20 }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setClicked({ lat, lng });
      setResults([]);
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng]).addTo(map);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=5&countrycodes=co`,
        { headers: { "Accept-Language": "es,en" } }
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setClicked({ lat, lng });
    setResults([]);
    setSearch(result.display_name.split(",")[0] ?? result.display_name);
    const map = mapRef.current;
    if (!map) return;
    map.setView([lat, lng], 15);
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([lat, lng]).addTo(map);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      <div className="absolute inset-0 z-[500] pointer-events-none flex items-start justify-center pt-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl border border-border/50 p-6 max-w-sm w-full pointer-events-auto"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-base text-foreground">{t("land.setup.title")}</h2>
              <p className="text-xs text-muted-foreground">{t("land.setup.subtitle")}</p>
            </div>
          </div>

          <div className="relative mb-3">
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={t("land.setup.searchPlaceholder")}
                className="rounded-xl text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="rounded-xl flex-shrink-0"
                onClick={handleSearch}
                disabled={searching}
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10">
                {results.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => selectResult(r)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0 truncate"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-4">{t("land.setup.instruction")}</p>

          {clicked && (
            <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs font-mono text-primary">
              {clicked.lat.toFixed(6)}, {clicked.lng.toFixed(6)}
            </div>
          )}
          <Button
            onClick={() => clicked && mapRef.current && onSetLocation(clicked.lat, clicked.lng, mapRef.current.getZoom())}
            disabled={!clicked || isSaving}
            className="w-full rounded-xl bg-primary hover:bg-primary/90"
          >
            {isSaving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.saving")}</>
              : t("land.setup.confirm")}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

export function Land() {
  const { t, i18n } = useTranslation();
  const { activeFarmId } = useStore();
  const qc = useQueryClient();
  const farmMapRef = useRef<FarmMapHandle>(null);
  const [panel, setPanel] = useState<{
    mode: "new" | "edit";
    zone: Partial<Zone>;
    pendingGeometry?: GeoJsonPolygon;
  } | null>(null);
  const editingZoneIdRef = useRef<string | null>(null);
  const [activeColor, setActiveColor] = useState(ZONE_COLORS[0]!);
  const [isDrawing, setIsDrawing] = useState(false);

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ["zones", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}/zones`);
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const { data: farmData, isLoading: farmLoading } = useQuery<FarmData>({
    queryKey: ["farm", activeFarmId],
    queryFn: async () => {
      const res = await fetch(`/api/farms/${activeFarmId}`);
      return res.json();
    },
    enabled: !!activeFarmId,
  });

  const saveLocation = useMutation({
    mutationFn: async ({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapLat: lat, mapLng: lng, mapZoom: zoom }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farm", activeFarmId] }),
  });

  const createZone = useMutation({
    mutationFn: async (data: { name: string; color: string; notes: string; geometry: GeoJsonPolygon }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      return res.json() as Promise<Zone>;
    },
    onSuccess: (newZone) => {
      qc.setQueryData(["zones", activeFarmId], (old: Zone[] | undefined) => [...(old ?? []), newZone]);
      setPanel(null);
      qc.invalidateQueries({ queryKey: ["zones", activeFarmId] });
    },
  });

  const updateZone = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; color: string; notes: string }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      return res.json() as Promise<Zone>;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["zones", activeFarmId], (old: Zone[] | undefined) =>
        (old ?? []).map((z) => (z.id === updated.id ? updated : z)),
      );
      setPanel(null);
      qc.invalidateQueries({ queryKey: ["zones", activeFarmId] });
    },
  });

  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/farms/${activeFarmId}/zones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      return id;
    },
    onSuccess: (id) => {
      farmMapRef.current?.removeZoneLayer(id);
      qc.setQueryData(["zones", activeFarmId], (old: Zone[] | undefined) =>
        (old ?? []).filter((z) => z.id !== id),
      );
      setPanel(null);
      qc.invalidateQueries({ queryKey: ["zones", activeFarmId] });
    },
  });

  const handlePolygonCreated = useCallback((geometry: GeoJsonPolygon) => {
    setPanel({ mode: "new", zone: { color: activeColor }, pendingGeometry: geometry });
  }, [activeColor]);

  const handleZoneSelected = useCallback((zone: Zone) => {
    editingZoneIdRef.current = zone.id;
    setPanel({ mode: "edit", zone });
  }, []);

  const handleSave = (data: { name: string; color: string; notes: string }) => {
    if (panel?.mode === "new" && panel.pendingGeometry) {
      createZone.mutate({ ...data, geometry: panel.pendingGeometry });
    } else if (panel?.mode === "edit" && panel.zone.id) {
      updateZone.mutate({ id: panel.zone.id, ...data });
    }
  };

  if (farmLoading || !activeFarmId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasLocation = !!farmData?.mapLat && !!farmData?.mapLng;
  const mapCenter: L.LatLngExpression = hasLocation
    ? [parseFloat(farmData!.mapLat!), parseFloat(farmData!.mapLng!)]
    : COLOMBIA_CENTER;
  const mapZoom = farmData?.mapZoom ?? 15;

  if (activeFarmId === ALL_FARMS_ID) return <SelectFarmPrompt />;

  return (
    <div className="-mx-6 -mt-6 md:-mx-8 md:-mt-8 h-[calc(100vh-4rem)] overflow-hidden relative">
      {hasLocation ? (
        <>
          <FarmMap
            ref={farmMapRef}
            key={`${farmData?.mapLat}-${farmData?.mapLng}`}
            center={mapCenter}
            zoom={mapZoom}
            zones={zones}
            onZoneCreated={handlePolygonCreated}
            onZoneSelected={handleZoneSelected}
            activeColor={activeColor}
            lang={i18n.language}
            onDrawingChange={setIsDrawing}
          />

          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-card/95 backdrop-blur-md rounded-2xl shadow-lg border border-border/50 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground mr-1 whitespace-nowrap">{t("land.colorLabel")}</span>
            {ZONE_COLORS.slice(0, 8).map((c) => (
              <button
                key={c}
                onClick={() => setActiveColor(c)}
                className="h-6 w-6 rounded-md border-2 transition-transform hover:scale-110 flex-shrink-0"
                style={{
                  backgroundColor: c,
                  borderColor: activeColor === c ? "#fff" : "transparent",
                  boxShadow: activeColor === c ? `0 0 0 2px ${c}` : "none",
                }}
              />
            ))}
          </div>

          <AnimatePresence>
            {isDrawing && !panel && (
              <motion.div
                key="drawing-guide"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none"
              >
                <div className="bg-card/95 backdrop-blur-lg rounded-2xl shadow-xl border border-primary/30 px-6 py-4 text-center max-w-sm">
                  <p className="text-sm font-semibold text-foreground mb-2">{t("land.drawingGuide.title")}</p>
                  <ol className="text-xs text-muted-foreground space-y-1 text-left list-none">
                    <li className="flex items-start gap-2"><span className="text-primary font-bold mt-0.5">1.</span><span>{t("land.drawingGuide.step1")}</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold mt-0.5">2.</span><span>{t("land.drawingGuide.step2")}</span></li>
                    <li className="flex items-start gap-2"><span className="text-primary font-bold mt-0.5 shrink-0">3.</span><span className="font-medium text-foreground">{t("land.drawingGuide.step3")}</span></li>
                  </ol>
                </div>
              </motion.div>
            )}
            {!isDrawing && zones.length === 0 && !panel && (
              <motion.div
                key="empty-hint"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none"
              >
                <div className="bg-card/90 backdrop-blur-md rounded-2xl shadow-lg border border-border/50 px-5 py-3 flex items-center gap-3">
                  <Pencil className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{t("land.drawHint")}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {panel && (
              <ZonePanel
                zone={panel.zone}
                isNew={panel.mode === "new"}
                onSave={handleSave}
                onDelete={panel.mode === "edit" ? () => { const id = editingZoneIdRef.current; if (id) deleteZone.mutate(id); } : undefined}
                onClose={() => setPanel(null)}
                isSaving={createZone.isPending || updateZone.isPending}
                isDeleting={deleteZone.isPending}
              />
            )}
          </AnimatePresence>
        </>
      ) : (
        <SetupMap
          onSetLocation={(lat, lng, zoom) => saveLocation.mutate({ lat, lng, zoom })}
          isSaving={saveLocation.isPending}
        />
      )}
    </div>
  );
}
