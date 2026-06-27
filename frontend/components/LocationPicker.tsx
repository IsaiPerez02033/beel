"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2, Search } from "lucide-react";

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
  interface Window {
    google: any;
    initGoogleMaps?: () => void;
  }
}

let scriptLoaded = false;
let scriptLoading = false;
const callbacks: Array<() => void> = [];

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (scriptLoaded) { resolve(); return; }
    callbacks.push(resolve);
    if (scriptLoading) return;
    scriptLoading = true;
    window.initGoogleMaps = () => {
      scriptLoaded = true;
      callbacks.forEach((cb) => cb());
      callbacks.length = 0;
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&language=es&region=MX`;
    s.async = true;
    s.defer = true;
    s.onerror = () => { scriptLoading = false; reject(new Error("Error al cargar Google Maps")); };
    document.head.appendChild(s);
  });
}

function extractComponent(components: any[], types: string[]): string {
  const c = components.find((c: any) => types.some((t) => c.types.includes(t)));
  return c?.long_name ?? "";
}

export default function LocationPicker({ onSelect, initialAddress = "" }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  // Guardar onSelect en ref para que el useEffect no se reinicie cuando cambia
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const [dragging, setDragging] = useState(false);

  // Cargar Google Maps una sola vez
  useEffect(() => {
    if (!apiKey) return;
    loadGoogleMaps(apiKey)
      .then(() => setReady(true))
      .catch(() => setLoadError(true));
  }, [apiKey]);

  // Inicializar mapa
  const initMap = useCallback((lat: number, lng: number, result: LocationResult) => {
    if (!mapRef.current || !window.google) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat, lng });
      markerRef.current?.setPosition({ lat, lng });
      return;
    }
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 16,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });
    mapInstanceRef.current = map;

    const marker = new window.google.maps.Marker({
      position: { lat, lng },
      map,
      draggable: true,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#147A5C",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3,
      },
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

  // Configurar autocomplete — solo corre cuando ready cambia a true
  useEffect(() => {
    if (!ready || !inputRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "mx" },
      fields: ["address_components", "geometry", "formatted_address"],
      types: ["address"],
    });

    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const comps = place.address_components ?? [];

      const street = extractComponent(comps, ["route"]);
      const number = extractComponent(comps, ["street_number"]);
      const colonia = extractComponent(comps, ["sublocality", "sublocality_level_1", "neighborhood"]);
      const city =
        extractComponent(comps, ["locality"]) ||
        extractComponent(comps, ["administrative_area_level_3"]) ||
        extractComponent(comps, ["administrative_area_level_2"]);
      const state = extractComponent(comps, ["administrative_area_level_1"]);
      const address = number ? `${street} ${number}` : street || place.formatted_address || "";

      const result: LocationResult = { address, neighborhood: colonia, city, state, lat, lng };
      setSelected(result);
      onSelectRef.current(result);
      initMap(lat, lng, result);
    });

    return () => {
      window.google?.maps.event.removeListener(listener);
    };
  }, [ready, initMap]); // onSelect NO está aquí — evita reinicio en cada render

  if (!apiKey || loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {loadError
            ? "No se pudo cargar Google Maps. Verifica la API key en Vercel."
            : "Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_KEY"}
        </p>
        <div>
          <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">
            Dirección <span className="text-red-500">*</span>
          </label>
          <input
            className="input w-full"
            placeholder="Calle, numero, colonia"
            style={{ fontSize: "16px" }}
            onChange={(e) => onSelectRef.current({
              address: e.target.value, neighborhood: "", city: "", state: "", lat: 19.4326, lng: -99.1332,
            })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campo de búsqueda */}
      <div>
        <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
          Dirección <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
            {ready ? <Search size={16} /> : <Loader2 size={16} className="animate-spin" />}
          </span>
          <input
            ref={inputRef}
            type="text"
            defaultValue={initialAddress}
            placeholder={ready ? "Busca tu direccion exacta..." : "Cargando..."}
            style={{ fontSize: "16px" }}
            className="input w-full pl-10"
            autoComplete="off"
          />
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
          Escribe la direccion y selecciona una opcion de la lista
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
                {dragging ? "Suelta el pin para ajustar" : "Arrastra el pin para ajustar la posicion exacta"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Campos editables post-seleccion */}
      {selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">
              Colonia / Fraccionamiento
            </label>
            <input
              className="input w-full"
              value={selected.neighborhood}
              onChange={(e) => { const u = { ...selected, neighborhood: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: Centro Historico"
              style={{ fontSize: "16px" }}
            />
          </div>
          <div>
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">
              Ciudad <span className="text-red-500">*</span>
            </label>
            <input
              className="input w-full"
              value={selected.city}
              onChange={(e) => { const u = { ...selected, city: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: Guadalajara"
              style={{ fontSize: "16px" }}
            />
          </div>
          <div>
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Estado</label>
            <input
              className="input w-full"
              value={selected.state}
              onChange={(e) => { const u = { ...selected, state: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: Jalisco"
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
