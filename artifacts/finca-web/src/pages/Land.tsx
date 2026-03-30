import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, MapPin, Trash2, Loader2, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Zone {
  id: string;
  name: string;
  color: string | null;
  notes: string | null;
  geometry: { coordinates: [number, number][] } | null;
}

interface FarmData {
  id: string;
  mapLat: string | null;
  mapLng: string | null;
  mapZoom: number | null;
}

const ZONE_COLORS = [
  "#4A6741", "#7CB87A", "#3B82F6", "#F59E0B",
  "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4",
  "#F97316", "#84CC16", "#6B7280", "#92400E",
];

const COLOMBIA_CENTER: [number, number] = [4.5709, -74.2973];
const ESRI_SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye";

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

function FarmMap({
  center,
  zoom,
  zones,
  onZoneCreated,
  onZoneSelected,
  activeColor,
}: {
  center: [number, number];
  zoom: number;
  zones: Zone[];
  onZoneCreated: (latlngs: [number, number][]) => void;
  onZoneSelected: (zone: Zone) => void;
  activeColor: string;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const zoneLayersRef = useRef<Map<string, L.Polygon>>(new Map());
  const drawControlRef = useRef<any>(null);
  const onZoneCreatedRef = useRef(onZoneCreated);
  const onZoneSelectedRef = useRef(onZoneSelected);
  const activeColorRef = useRef(activeColor);

  onZoneCreatedRef.current = onZoneCreated;
  onZoneSelectedRef.current = onZoneSelected;
  activeColorRef.current = activeColor;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer(ESRI_SATELLITE, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 20,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    drawnItems.addTo(map);
    drawnItemsRef.current = drawnItems;

    const drawControl = new (L.Control as any).Draw({
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

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      const rawLatLngs = (layer.getLatLngs() as L.LatLng[][])[0]!;
      const latlngs: [number, number][] = rawLatLngs.map((ll) => [ll.lat, ll.lng]);
      onZoneCreatedRef.current(latlngs);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!map || !drawnItems) return;

    const existingIds = new Set(zoneLayersRef.current.keys());
    const incomingIds = new Set(zones.map((z) => z.id));

    existingIds.forEach((id) => {
      if (!incomingIds.has(id)) {
        const layer = zoneLayersRef.current.get(id);
        if (layer) {
          map.removeLayer(layer);
          zoneLayersRef.current.delete(id);
        }
      }
    });

    zones.forEach((zone) => {
      const coords = zone.geometry?.coordinates;
      if (!coords || coords.length < 3) return;
      const color = zone.color ?? "#4A6741";

      const existing = zoneLayersRef.current.get(zone.id);
      if (existing) {
        existing.setStyle({ color, fillColor: color });
        existing.setLatLngs(coords);
        (existing as any)._tooltip && existing.setTooltipContent(zone.name);
        return;
      }

      const polygon = L.polygon(coords, {
        color,
        fillColor: color,
        fillOpacity: 0.35,
        weight: 2,
      });

      polygon.bindTooltip(zone.name, { permanent: false, sticky: true });
      polygon.on("click", () => onZoneSelectedRef.current(zone));
      polygon.addTo(map);
      zoneLayersRef.current.set(zone.id, polygon);
    });
  }, [zones]);

  useEffect(() => {
    const map = mapRef.current;
    const drawControl = drawControlRef.current;
    if (!map || !drawControl) return;

    map.removeControl(drawControl);
    const newDrawControl = new (L.Control as any).Draw({
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
    newDrawControl.addTo(map);
    drawControlRef.current = newDrawControl;
  }, [activeColor]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}

function SetupMap({
  onSetLocation,
  isSaving,
}: {
  onSetLocation: (lat: number, lng: number) => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [clicked, setClicked] = useState<{ lat: number; lng: number } | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: COLOMBIA_CENTER,
      zoom: 6,
    });

    L.tileLayer(ESRI_SATELLITE, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 20,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setClicked({ lat, lng });
      if (markerRef.current) markerRef.current.remove();
      const marker = L.marker([lat, lng]).addTo(map);
      markerRef.current = marker;
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
          <p className="text-sm text-muted-foreground mb-4">{t("land.setup.instruction")}</p>
          {clicked && (
            <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs font-mono text-primary">
              {clicked.lat.toFixed(6)}, {clicked.lng.toFixed(6)}
            </div>
          )}
          <Button
            onClick={() => clicked && onSetLocation(clicked.lat, clicked.lng)}
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
  const { t } = useTranslation();
  const { activeFarmId } = useStore();
  const qc = useQueryClient();
  const [panel, setPanel] = useState<{
    mode: "new" | "edit";
    zone: Partial<Zone>;
    pendingCoords?: [number, number][];
  } | null>(null);
  const [activeColor, setActiveColor] = useState(ZONE_COLORS[0]!);

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
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/map-location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapLat: lat, mapLng: lng, mapZoom: 15 }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["farm", activeFarmId] }),
  });

  const createZone = useMutation({
    mutationFn: async (data: { name: string; color: string; notes: string; geometry: { coordinates: [number, number][] } }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones", activeFarmId] });
      setPanel(null);
    },
  });

  const updateZone = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; color: string; notes: string }) => {
      const res = await fetch(`/api/farms/${activeFarmId}/zones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones", activeFarmId] });
      setPanel(null);
    },
  });

  const deleteZone = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/farms/${activeFarmId}/zones/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zones", activeFarmId] });
      setPanel(null);
    },
  });

  const handlePolygonCreated = useCallback((latlngs: [number, number][]) => {
    setPanel({ mode: "new", zone: { color: activeColor }, pendingCoords: latlngs });
  }, [activeColor]);

  const handleZoneSelected = useCallback((zone: Zone) => {
    setPanel({ mode: "edit", zone });
  }, []);

  const handleSave = (data: { name: string; color: string; notes: string }) => {
    if (panel?.mode === "new" && panel.pendingCoords) {
      createZone.mutate({ ...data, geometry: { coordinates: panel.pendingCoords } });
    } else if (panel?.mode === "edit" && panel.zone.id) {
      updateZone.mutate({ id: panel.zone.id, ...data });
    }
  };

  const handleDelete = () => {
    if (panel?.zone.id) deleteZone.mutate(panel.zone.id);
  };

  if (farmLoading || !activeFarmId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasLocation = farmData?.mapLat && farmData?.mapLng;
  const mapCenter: [number, number] = hasLocation
    ? [parseFloat(farmData!.mapLat!), parseFloat(farmData!.mapLng!)]
    : COLOMBIA_CENTER;
  const mapZoom = hasLocation ? (farmData?.mapZoom ?? 15) : 6;

  return (
    <div className="-mx-6 -mt-6 md:-mx-8 md:-mt-8 h-[calc(100vh-4rem)] overflow-hidden relative">
      {hasLocation ? (
        <>
          <FarmMap
            key={`${mapCenter[0]}-${mapCenter[1]}`}
            center={mapCenter}
            zoom={mapZoom}
            zones={zones}
            onZoneCreated={handlePolygonCreated}
            onZoneSelected={handleZoneSelected}
            activeColor={activeColor}
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

          {zones.length === 0 && !panel && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card/90 backdrop-blur-md rounded-2xl shadow-lg border border-border/50 px-5 py-3 flex items-center gap-3"
              >
                <Pencil className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{t("land.drawHint")}</span>
              </motion.div>
            </div>
          )}

          <AnimatePresence>
            {panel && (
              <ZonePanel
                zone={panel.zone}
                isNew={panel.mode === "new"}
                onSave={handleSave}
                onDelete={panel.mode === "edit" ? handleDelete : undefined}
                onClose={() => setPanel(null)}
                isSaving={createZone.isPending || updateZone.isPending}
                isDeleting={deleteZone.isPending}
              />
            )}
          </AnimatePresence>
        </>
      ) : (
        <SetupMap
          onSetLocation={(lat, lng) => saveLocation.mutate({ lat, lng })}
          isSaving={saveLocation.isPending}
        />
      )}
    </div>
  );
}
