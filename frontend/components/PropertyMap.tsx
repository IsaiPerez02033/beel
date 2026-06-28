"use client";

import { useEffect, useRef } from "react";

interface Props {
  lat: number;
  lng: number;
  title: string;
  exact?: boolean; // true = pin exacto (para huéspedes con reserva confirmada)
}

declare global {
  interface Window { google: any; initPropertyMap?: () => void; }
}

let scriptLoaded = false;
let scriptLoading = false;
const cbs: Array<() => void> = [];

function loadMaps(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded) { resolve(); return; }
    cbs.push(resolve);
    if (scriptLoading) return;
    scriptLoading = true;
    window.initPropertyMap = () => { scriptLoaded = true; cbs.forEach((c) => c()); cbs.length = 0; };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initPropertyMap&language=es&region=MX`;
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  });
}

export default function PropertyMap({ lat, lng, title, exact = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    loadMaps(apiKey).then(() => {
      if (!mapRef.current || !window.google) return;

      // Sin offset si es dirección exacta para huésped confirmado
      const approxLat = exact ? lat : lat + 0.002;
      const approxLng = exact ? lng : lng + 0.002;

      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: approxLat, lng: approxLng },
        zoom: exact ? 17 : 14,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });

      if (exact) {
        // Pin exacto para huéspedes confirmados
        new window.google.maps.Marker({
          position: { lat: approxLat, lng: approxLng },
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#147A5C",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 3,
          },
        });
      } else {
        // Círculo aproximado para el público (estilo Airbnb)
        new window.google.maps.Circle({
          map,
          center: { lat: approxLat, lng: approxLng },
          radius: 300,
          fillColor: "#147A5C",
          fillOpacity: 0.15,
          strokeColor: "#147A5C",
          strokeOpacity: 0.5,
          strokeWeight: 2,
        });
      }
    });
  }, [lat, lng, apiKey]);

  if (!apiKey) return null;

  return (
    <div
      ref={mapRef}
      className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-sm bg-[var(--bg-subtle)]"
    />
  );
}
