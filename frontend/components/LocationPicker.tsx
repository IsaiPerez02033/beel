"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";

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
    // v=beta para acceder a PlaceAutocompleteElement (nueva API desde marzo 2025)
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta&callback=initGoogleMaps&language=es&region=MX`;
    s.async = true;
    s.defer = true;
    s.onerror = () => { scriptLoading = false; reject(new Error("Error al cargar Google Maps")); };
    document.head.appendChild(s);
  });
}

export default function LocationPicker({ onSelect, initialAddress = "" }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    loadGoogleMaps(apiKey)
      .then(() => setReady(true))
      .catch(() => setLoadError(true));
  }, [apiKey]);

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

  useEffect(() => {
    if (!ready || !containerRef.current) return;

    // Nueva API: PlaceAutocompleteElement (reemplaza Autocomplete desde marzo 2025)
    const pac = new window.google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: "mx" },
      types: ["address"],
    });

    // Estilos para que se vea como el resto de inputs de Beel
    pac.style.width = "100%";
    pac.style.fontSize = "16px";

    containerRef.current.appendChild(pac);

    const listener = pac.addEventListener("gmp-placeselect", async (e: any) => {
      const place = e.place;
      await place.fetchFields({ fields: ["addressComponents", "location", "formattedAddress"] });

      const comps = place.addressComponents ?? [];

      const get = (types: string[]) => {
        const c = comps.find((c: any) => types.some((t: string) => c.types.includes(t)));
        return c?.longText ?? "";
      };

      const street = get(["route"]);
      const number = get(["street_number"]);
      const colonia = get(["sublocality", "sublocality_level_1", "neighborhood"]);
      const city = get(["locality"]) || get(["administrative_area_level_3"]) || get(["administrative_area_level_2"]);
      const state = get(["administrative_area_level_1"]);
      const address = number ? `${street} ${number}` : street || place.formattedAddress || "";
      const lat = place.location?.lat() ?? 19.4326;
      const lng = place.location?.lng() ?? -99.1332;

      const result: LocationResult = { address, neighborhood: colonia, city, state, lat, lng };
      setSelected(result);
      onSelectRef.current(result);
      initMap(lat, lng, result);
    });

    return () => {
      if (listener) pac.removeEventListener("gmp-placeselect", listener);
      if (containerRef.current?.contains(pac)) containerRef.current.removeChild(pac);
    };
  }, [ready, initMap]);

  if (!apiKey || loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
          No se pudo cargar Google Maps. Verifica la API key en Vercel.
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
      <div>
        <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
          Dirección <span className="text-red-500">*</span>
        </label>
        {!ready ? (
          <div className="input w-full flex items-center gap-2 text-neutral-400">
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: "16px" }}>Cargando...</span>
          </div>
        ) : (
          /* PlaceAutocompleteElement se monta aquí via useEffect */
          <div ref={containerRef} className="w-full [&>*]:w-full [&_input]:text-base [&_input]:rounded-xl [&_input]:border [&_input]:border-neutral-200 [&_input]:px-4 [&_input]:py-2.5 [&_input]:outline-none focus-within:[&_input]:border-neutral-900 focus-within:[&_input]:ring-1 focus-within:[&_input]:ring-neutral-900" />
        )}
        <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
          Escribe la direccion y selecciona una opcion de la lista
        </p>
      </div>

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

      {selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Colonia / Fraccionamiento</label>
            <input className="input w-full" value={selected.neighborhood} style={{ fontSize: "16px" }}
              onChange={(e) => { const u = { ...selected, neighborhood: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: Centro Historico" />
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
