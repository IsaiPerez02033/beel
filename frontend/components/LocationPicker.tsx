"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, Search, X } from "lucide-react";

interface LocationResult {
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

interface Props {
  onSelect: (result: LocationResult) => void;
  initialAddress?: string;
}

declare global {
  interface Window { google: any; initGoogleMapsBasic?: () => void; }
}

// Carga solo Maps JS (sin Places) para el mapa visual
let mapScriptLoaded = false;
let mapScriptLoading = false;
const mapCallbacks: Array<() => void> = [];

function loadMapsJS(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (mapScriptLoaded) { resolve(); return; }
    mapCallbacks.push(resolve);
    if (mapScriptLoading) return;
    mapScriptLoading = true;
    window.initGoogleMapsBasic = () => {
      mapScriptLoaded = true;
      mapCallbacks.forEach((cb) => cb());
      mapCallbacks.length = 0;
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMapsBasic&language=es&region=MX`;
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  });
}

interface Suggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export default function LocationPicker({ onSelect, initialAddress = "" }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const [query, setQuery] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cargar Maps JS para el mapa visual
  useEffect(() => {
    if (!apiKey) return;
    loadMapsJS(apiKey).then(() => setMapsReady(true));
  }, [apiKey]);

  // Cerrar dropdown al clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Buscar sugerencias via proxy interno (evita CORS)
  const search = useCallback(async (input: string) => {
    if (input.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(input)}`);
      const data = await res.json();
      const suggs: Suggestion[] = (data.suggestions ?? []).map((s: any) => ({
        placeId: s.placePrediction?.placeId ?? "",
        description: s.placePrediction?.text?.text ?? "",
        mainText: s.placePrediction?.structuredFormat?.mainText?.text ?? "",
        secondaryText: s.placePrediction?.structuredFormat?.secondaryText?.text ?? "",
      })).filter((s: Suggestion) => s.placeId);
      setSuggestions(suggs);
      setOpen(suggs.length > 0);
    } catch (e) {
      console.error("Places search error:", e);
    }
    setLoading(false);
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  }

  // Obtener detalles del lugar seleccionado via proxy interno
  async function selectPlace(s: Suggestion) {
    setOpen(false);
    setQuery(s.description);
    setLoading(true);
    try {
      const res = await fetch(`/api/places/details?id=${encodeURIComponent(s.placeId)}`);
      const place = await res.json();
      const comps: any[] = place.addressComponents ?? [];
      const get = (types: string[]) => {
        const c = comps.find((c) => types.some((t) => (c.types ?? []).includes(t)));
        return c?.longText ?? "";
      };
      const street = get(["route"]);
      const number = get(["street_number"]);
      const colonia = get(["sublocality", "sublocality_level_1", "neighborhood"]);
      const city = get(["locality"]) || get(["administrative_area_level_3"]) || get(["administrative_area_level_2"]);
      const state = get(["administrative_area_level_1"]);
      const address = number ? `${street} ${number}` : street || place.formattedAddress || s.mainText;
      const lat = place.location?.latitude ?? 19.4326;
      const lng = place.location?.longitude ?? -99.1332;

      const result: LocationResult = { address, neighborhood: colonia, city, state, lat, lng };
      setSelected(result);
      onSelectRef.current(result);
      initMap(lat, lng, result);
    } catch (e) {
      console.error("Place details error:", e);
    }
    setLoading(false);
  }

  const initMap = useCallback((lat: number, lng: number, result: LocationResult) => {
    if (!mapRef.current || !window.google) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng });
      markerRef.current?.setPosition({ lat, lng });
      return;
    }
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng }, zoom: 16, disableDefaultUI: true, zoomControl: true,
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });
    mapInstanceRef.current = map;
    const marker = new window.google.maps.Marker({
      position: { lat, lng }, map, draggable: true,
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#147A5C", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
    });
    markerRef.current = marker;
    marker.addListener("dragstart", () => setDragging(true));
    marker.addListener("dragend", () => {
      setDragging(false);
      const pos = marker.getPosition();
      if (!pos) return;
      const updated = { ...result, lat: pos.lat(), lng: pos.lng() };
      setSelected(updated);
      onSelectRef.current(updated);
    });
  }, []);

  if (!apiKey) {
    return (
      <div>
        <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Dirección <span className="text-red-500">*</span></label>
        <input className="input w-full" placeholder="Calle, numero, colonia" style={{ fontSize: "16px" }}
          onChange={(e) => onSelectRef.current({ address: e.target.value, neighborhood: "", city: "", state: "", lat: 19.4326, lng: -99.1332 })} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
          Dirección <span className="text-red-500">*</span>
        </label>

        {/* Input con dropdown custom */}
        <div ref={containerRef} className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Busca tu dirección exacta..."
            style={{ fontSize: "16px" }}
            className="input w-full pl-10 pr-10"
            autoComplete="new-password"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setSuggestions([]); setOpen(false); setSelected(null); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            >
              <X size={16} />
            </button>
          )}

          {/* Dropdown de sugerencias */}
          {open && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg z-[9999] overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.placeId}
                  onMouseDown={(e) => { e.preventDefault(); selectPlace(s); }}
                  className="w-full text-left px-4 py-3 hover:bg-neutral-50 border-b border-neutral-100 last:border-0 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <MapPin size={14} className="text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">{s.mainText}</p>
                      <p className="text-xs text-neutral-500 truncate">{s.secondaryText}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
          Escribe la dirección y selecciona una opción de la lista
        </p>
      </div>

      {/* Mapa */}
      {selected && (
        <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
          <div ref={mapRef} className="w-full h-56 sm:h-64 bg-neutral-100" />
          <div className="px-4 py-3 bg-white flex items-start gap-2">
            <MapPin size={14} className="text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-body-sm font-medium text-[var(--text-primary)] truncate">
                {selected.address}{selected.neighborhood ? `, ${selected.neighborhood}` : ""}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {selected.city}{selected.state ? `, ${selected.state}` : ""}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                {dragging ? "Suelta el pin para ajustar" : "Arrastra el pin para ajustar la posición exacta"}
              </p>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Colonia / Fraccionamiento</label>
            <input className="input w-full" value={selected.neighborhood} style={{ fontSize: "16px" }}
              onChange={(e) => { const u = { ...selected, neighborhood: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: Centro Histórico" />
          </div>
          <div>
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Ciudad <span className="text-red-500">*</span></label>
            <input className="input w-full" value={selected.city} style={{ fontSize: "16px" }}
              onChange={(e) => { const u = { ...selected, city: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: Guadalajara" />
          </div>
          <div>
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Estado</label>
            <input className="input w-full" value={selected.state} style={{ fontSize: "16px" }}
              onChange={(e) => { const u = { ...selected, state: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: Jalisco" />
          </div>
        </div>
      )}
    </div>
  );
}
