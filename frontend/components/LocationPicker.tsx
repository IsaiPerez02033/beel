"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, Loader2, Search, X } from "lucide-react";
import { loadLeaflet } from "@/lib/loadLeaflet";

interface LocationResult {
  address: string;
  street: string;
  postal_code: string;
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

interface Suggestion {
  mainText: string;
  secondaryText: string;
  address: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  lat: number;
  lng: number;
}

export default function LocationPicker({ onSelect, initialAddress = "" }: Props) {
  const [query, setQuery] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Cerrar dropdown al clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (input: string) => {
    if (input.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/geo/address?q=${encodeURIComponent(input)}`);
      const data = await res.json();
      const suggs: Suggestion[] = data.suggestions ?? [];
      setSuggestions(suggs);
      setOpen(suggs.length > 0);
    } catch (e) {
      console.error("Geo search error:", e);
    }
    setLoading(false);
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  }

  function selectSuggestion(s: Suggestion) {
    setOpen(false);
    setQuery([s.mainText, s.secondaryText].filter(Boolean).join(", "));
    const result: LocationResult = {
      address: s.address || s.mainText,
      street: s.street,
      postal_code: s.postal_code,
      neighborhood: s.neighborhood,
      city: s.city,
      state: s.state,
      lat: s.lat,
      lng: s.lng,
    };
    setSelected(result);
    onSelectRef.current(result);
    initMap(s.lat, s.lng, result);
  }

  // Reverse geocode y actualizar campos al mover el pin (arrastrar o clic)
  async function applyLatLng(lat: number, lng: number, fallback: LocationResult) {
    try {
      const res = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      const r = data.result;
      setSelected((prev) => {
        const base = prev ?? fallback;
        const updated: LocationResult = r
          ? {
              address: r.address || base.address,
              street: r.street || base.street,
              postal_code: r.postal_code || base.postal_code,
              neighborhood: r.neighborhood || base.neighborhood,
              city: r.city || base.city,
              state: r.state || base.state,
              lat, lng,
            }
          : { ...base, lat, lng };
        onSelectRef.current(updated);
        return updated;
      });
    } catch {
      setSelected((prev) => {
        const updated = { ...(prev ?? fallback), lat, lng };
        onSelectRef.current(updated);
        return updated;
      });
    }
  }

  const initMap = useCallback((lat: number, lng: number, result: LocationResult, zoom = 16) => {
    loadLeaflet().then(() => {
      const L = (window as any).L;
      if (!L) return;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([lat, lng], zoom);
        markerRef.current?.setLatLng([lat, lng]);
        return;
      }
      setTimeout(() => {
        if (!mapRef.current || mapInstanceRef.current) return;
        const map = L.map(mapRef.current, {
          center: [lat, lng], zoom, zoomControl: true, scrollWheelZoom: false,
        });
        mapInstanceRef.current = map;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19, attribution: "&copy; OpenStreetMap",
        }).addTo(map);

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current = marker;
        marker.on("dragstart", () => setDragging(true));
        marker.on("dragend", () => {
          setDragging(false);
          const pos = marker.getLatLng();
          applyLatLng(pos.lat, pos.lng, result);
        });
        // Clic en el mapa: mover el pin ahí (para ubicar manualmente)
        map.on("click", (e: any) => {
          marker.setLatLng(e.latlng);
          applyLatLng(e.latlng.lat, e.latlng.lng, result);
        });
        setTimeout(() => map.invalidateSize(), 120);
      }, 100);
    });
  }, []);

  // Abrir el mapa para ubicar manualmente (cuando no se encuentra la dirección)
  async function startManual() {
    setOpen(false);
    // Intentar centrar en lo que escribió (ciudad); si no, en el centro de México
    let center = { lat: 23.6345, lng: -102.5528 };
    let zoom = 5;
    let base: LocationResult = { address: "", street: "", postal_code: "", neighborhood: "", city: "", state: "", lat: center.lat, lng: center.lng };
    try {
      if (query.trim().length >= 3) {
        const res = await fetch(`/api/geo/address?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        const s = (data.suggestions ?? [])[0];
        if (s) {
          center = { lat: s.lat, lng: s.lng };
          zoom = 14;
          base = { address: "", street: s.street || "", postal_code: s.postal_code || "", neighborhood: s.neighborhood || "", city: s.city || "", state: s.state || "", lat: s.lat, lng: s.lng };
        }
      }
    } catch {}
    setSelected(base);
    onSelectRef.current(base);
    initMap(center.lat, center.lng, base, zoom);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
          Dirección <span className="text-red-500">*</span>
        </label>

        <div ref={containerRef} className="relative">
          <div className="input w-full flex items-center gap-2 p-0 overflow-hidden focus-within:ring-1 focus-within:ring-[var(--color-primary)] focus-within:border-[var(--color-primary)]">
            <span className="pl-3 flex-shrink-0 text-[var(--text-tertiary)] pointer-events-none">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0 && inputRef.current) {
                  const rect = inputRef.current.getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
                  setOpen(true);
                }
              }}
              placeholder="Busca tu dirección (calle, colonia, ciudad)..."
              style={{ fontSize: "16px" }}
              className="flex-1 py-2.5 pr-2 outline-none border-none bg-transparent text-[var(--text-primary)] placeholder-neutral-400 min-w-0"
              autoComplete="new-password"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery(""); setSuggestions([]); setOpen(false); setSelected(null);
                  if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
                  markerRef.current = null;
                }}
                className="pr-3 flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {open && suggestions.length > 0 && typeof document !== "undefined" && createPortal(
            <div
              className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl overflow-hidden"
              style={{ position: "absolute", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 99999 }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={`${s.mainText}-${i}`}
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] last:border-0 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <MapPin size={14} className="text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{s.mainText}</p>
                      <p className="text-xs text-[var(--text-tertiary)] truncate">{s.secondaryText}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>

        <div className="flex items-center justify-between mt-1.5 gap-2 flex-wrap">
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Escribe la dirección y selecciona una opción de la lista
          </p>
          <button
            type="button"
            onClick={startManual}
            className="text-[11px] font-medium text-[var(--color-primary)] hover:underline flex-shrink-0"
          >
            ¿No encuentras tu dirección? Ubícala en el mapa →
          </button>
        </div>
      </div>

      {/* Mapa */}
      {selected && (
        <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-sm">
          <div ref={mapRef} className="w-full h-56 sm:h-64 bg-[var(--bg-subtle)] z-0" />
          <div className="px-4 py-3 bg-[var(--bg-elevated)] flex items-start gap-2">
            <MapPin size={14} className="text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-body-sm font-medium text-[var(--text-primary)] truncate">
                {selected.address}{selected.neighborhood ? `, ${selected.neighborhood}` : ""}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {selected.city}{selected.state ? `, ${selected.state}` : ""}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                {dragging ? "Suelta el pin para ajustar" : "Arrastra el pin o toca el mapa para marcar la posición exacta"}
              </p>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Calle</label>
            <input className="input w-full" value={selected.street} style={{ fontSize: "16px" }}
              onChange={(e) => { const u = { ...selected, street: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: Calle Rosales" />
          </div>
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
          <div>
            <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1">Código Postal</label>
            <input className="input w-full" value={selected.postal_code} style={{ fontSize: "16px" }}
              onChange={(e) => { const u = { ...selected, postal_code: e.target.value }; setSelected(u); onSelectRef.current(u); }}
              placeholder="Ej: 54665" />
          </div>
        </div>
      )}
    </div>
  );
}
