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
const callbacks: (() => void)[] = [];

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
    s.onerror = () => {
      scriptLoading = false;
      reject(new Error("No se pudo cargar Google Maps"));
    };
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
  const autocompleteRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const [dragging, setDragging] = useState(false);

  // Inicializar mapa en una posición dada
  const initMap = useCallback((lat: number, lng: number) => {
    if (!mapRef.current || !window.google) return;
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

    // Al arrastrar el pin, actualizar coords
    marker.addListener("dragstart", () => setDragging(true));
    marker.addListener("dragend", () => {
      setDragging(false);
      const pos = marker.getPosition();
      if (!pos) return;
      const newLat = pos.lat();
      const newLng = pos.lng();
      setSelected((prev) => prev ? { ...prev, lat: newLat, lng: newLng } : null);
      onSelect({ ...(selected ?? { address: "", neighborhood: "", city: "", state: "" }), lat: newLat, lng: newLng });
    });
  }, [onSelect, selected]);

  // Cargar Google Maps y configurar autocomplete
  useEffect(() => {
    if (!apiKey) return;
    loadGoogleMaps(apiKey)
      .then(() => setReady(true))
      .catch(() => setLoadError(true));
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !inputRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "mx" },
      fields: ["address_components", "geometry", "formatted_address", "name"],
      types: ["address"],
    });
    autocompleteRef.current = ac;

    ac.addListener("place_changed", () => {
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
      onSelect(result);

      // Mostrar/actualizar mapa
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat, lng });
        markerRef.current?.setPosition({ lat, lng });
      } else {
        initMap(lat, lng);
      }
    });

    return () => window.google?.maps.event.clearInstanceListeners(ac);
  }, [ready, initMap, onSelect]);

  if (!apiKey || loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {loadError
            ? "No se pudo cargar el mapa. Verifica que la API key de Google Maps esté configurada correctamente en Vercel."
            : "Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_KEY"}
        </p>
        {/* Fallback: campos manuales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Dirección <span className="text-red-500">*</span></label>
            <input className="input w-full" placeholder="Calle, número, colonia" style={{ fontSize: "16px" }} onChange={(e) => onSelect({ address: e.target.value, neighborhood: "", city: "", state: "", lat: 19.4326, lng: -99.1332 })} />
          </div>
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
          <input
            ref={inputRef}
            type="text"
            defaultValue={initialAddress}
            placeholder={ready ? "Busca tu direccion exacta..." : "Cargando..."}
            style={{ fontSize: "16px" }}
            className="input w-full"
            disabled={!ready}
            autoComplete="off"
          />
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
          Escribe la dirección y selecciona una opción de la lista
        </p>
      </div>

      {/* Mapa — solo visible tras seleccionar */}
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
              {dragging && (
                <p className="text-[11px] text-[var(--color-primary)] mt-0.5">
                  Suelta el pin para ajustar la ubicación
                </p>
              )}
              {!dragging && (
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  Puedes arrastrar el pin para ajustar la posición exacta
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campos complementarios — se autollenan pero son editables */}
      {selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">
              Colonia / Fraccionamiento
            </label>
            <input
              className="input w-full"
              value={selected.neighborhood}
              onChange={(e) => {
                const updated = { ...selected, neighborhood: e.target.value };
                setSelected(updated);
                onSelect(updated);
              }}
              placeholder="Ej: Centro Histórico"
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
              onChange={(e) => {
                const updated = { ...selected, city: e.target.value };
                setSelected(updated);
                onSelect(updated);
              }}
              placeholder="Ej: Guadalajara"
              style={{ fontSize: "16px" }}
            />
          </div>
          <div>
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">
              Estado
            </label>
            <input
              className="input w-full"
              value={selected.state}
              onChange={(e) => {
                const updated = { ...selected, state: e.target.value };
                setSelected(updated);
                onSelect(updated);
              }}
              placeholder="Ej: Jalisco"
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
