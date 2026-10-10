"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";
import { IconCurrentLocation, IconMapPin, IconSearch, IconX } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LocationPickerProps = {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number | null, longitude: number | null) => void;
  /** Address text used as the initial search. */
  address?: string | null;
};

type SearchResult = { display_name: string; lat: string; lon: string };

// Center of Venezuela when the store has no location yet
const DEFAULT_CENTER: [number, number] = [8.0, -66.0];

const pinIcon = (L: typeof import("leaflet")) =>
  L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#E4572E;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });

/** OpenStreetMap picker: click, drag the pin, search an address or use the device location. */
export function LocationPicker({ latitude, longitude, onChange, address }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [query, setQuery] = useState(address || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const placeMarker = (lat: number, lng: number, zoom?: number) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else {
      markerRef.current = L.marker([lat, lng], { draggable: true, icon: pinIcon(L) }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current(round(p.lat), round(p.lng));
      });
    }
    map.setView([lat, lng], zoom ?? Math.max(map.getZoom(), 16));
  };

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const hasLocation = latitude !== null && longitude !== null;
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(hasLocation ? [latitude!, longitude!] : DEFAULT_CENTER, hasLocation ? 16 : 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e) => {
        placeMarker(e.latlng.lat, e.latlng.lng, map.getZoom());
        onChangeRef.current(round(e.latlng.lat), round(e.latlng.lng));
      });
      mapRef.current = map;
      if (hasLocation) placeMarker(latitude!, longitude!, 16);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; later changes come from the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ve&q=${encodeURIComponent(query)}`, {
        headers: { "Accept-Language": "es" },
      });
      const data: SearchResult[] = await res.json();
      setResults(data);
      if (data.length === 0) toast.info("No encontramos esa dirección. Prueba con la ciudad o un punto conocido, o marca el lugar en el mapa.");
    } catch {
      toast.error("No se pudo buscar la dirección");
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Tu navegador no permite obtener la ubicación");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placeMarker(pos.coords.latitude, pos.coords.longitude, 17);
        onChange(round(pos.coords.latitude), round(pos.coords.longitude));
      },
      () => toast.error("No se pudo obtener tu ubicación. Revisa los permisos del navegador."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
            placeholder="Busca una dirección, sector o punto de referencia"
            className="h-9 text-xs pr-8"
          />
          {results.length > 0 && (
            <div className="absolute z-[1000] mt-1 w-full rounded-lg border bg-popover shadow-lg">
              {results.map((r) => (
                <button
                  key={r.lat + r.lon}
                  type="button"
                  onClick={() => {
                    const lat = Number(r.lat), lng = Number(r.lon);
                    placeMarker(lat, lng, 17);
                    onChange(round(lat), round(lng));
                    setResults([]);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={search} disabled={searching}>
          <IconSearch size={13} /> Buscar
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={useMyLocation} title="Usar mi ubicación actual">
          <IconCurrentLocation size={13} /> <span className="hidden sm:inline">Mi ubicación</span>
        </Button>
      </div>

      <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-xl border z-0" />

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <IconMapPin size={12} className={latitude !== null ? "text-primary" : ""} />
          {latitude !== null && longitude !== null
            ? `Ubicación marcada (${latitude.toFixed(5)}, ${longitude.toFixed(5)}). Arrastra el PIN para ajustar.`
            : "Toca el mapa para marcar dónde está tu negocio."}
        </span>
        {latitude !== null && (
          <button
            type="button"
            className="flex items-center gap-1 hover:text-rose-500"
            onClick={() => {
              markerRef.current?.remove();
              markerRef.current = null;
              onChange(null, null);
            }}
          >
            <IconX size={11} /> Quitar
          </button>
        )}
      </div>
    </div>
  );
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
