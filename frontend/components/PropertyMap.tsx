"use client";

import { useEffect, useRef } from "react";

interface Props {
  lat: number;
  lng: number;
  title: string;
  exact?: boolean; // true = pin exacto (para huéspedes con reserva confirmada)
}

declare global {
  interface Window { L: any; }
}

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

let leafletLoaded = false;
let leafletLoading = false;
const cbs: Array<() => void> = [];

function loadLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    if (leafletLoaded && window.L) { resolve(); return; }
    cbs.push(resolve);
    if (leafletLoading) return;
    leafletLoading = true;

    // CSS (necesario para que el mapa se renderice correctamente)
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    // JS
    const s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.async = true;
    s.onload = () => { leafletLoaded = true; cbs.forEach((c) => c()); cbs.length = 0; };
    document.head.appendChild(s);
  });
}

export default function PropertyMap({ lat, lng, title, exact = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !mapRef.current || !window.L) return;
      const L = window.L;

      // Limpiar mapa previo si existe (evita "container already initialized")
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Sin offset si es dirección exacta para huésped confirmado
      const cLat = exact ? lat : lat + 0.002;
      const cLng = exact ? lng : lng + 0.002;

      const map = L.map(mapRef.current, {
        center: [cLat, cLng],
        zoom: exact ? 17 : 14,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });
      mapInstanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      if (exact) {
        // Pin exacto para huéspedes confirmados
        L.circleMarker([cLat, cLng], {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: "#147A5C",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        // Círculo aproximado para el público (estilo Airbnb)
        L.circle([cLat, cLng], {
          radius: 300,
          color: "#147A5C",
          weight: 2,
          opacity: 0.5,
          fillColor: "#147A5C",
          fillOpacity: 0.15,
        }).addTo(map);
      }

      // Recalcular tamaño por si el contenedor cambió de layout
      setTimeout(() => map.invalidateSize(), 100);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, exact]);

  return (
    <div
      ref={mapRef}
      className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-sm bg-[var(--bg-subtle)] z-0"
    />
  );
}
