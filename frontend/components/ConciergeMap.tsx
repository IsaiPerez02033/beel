"use client";

import { useEffect, useRef } from "react";
import { loadLeaflet } from "@/lib/loadLeaflet";
import type { Property, Experience } from "@/types";

interface Props {
  properties: Property[];
  experiences: Experience[];
}

interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  price: string;
  type: "property" | "experience";
}

export default function ConciergeMap({ properties, experiences }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Consolidar puntos de mapa
  const points: MapPoint[] = [];

  properties.forEach((p) => {
    const lat = Number(p.latitude_approx ?? p.latitude);
    const lng = Number(p.longitude_approx ?? p.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      points.push({
        id: p.id,
        lat,
        lng,
        title: p.title,
        price: `$${Math.round(Number(p.price_per_night))}`,
        type: "property",
      });
    }
  });

  experiences.forEach((e) => {
    const lat = Number(e.latitude_approx);
    const lng = Number(e.longitude_approx);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      points.push({
        id: e.id,
        lat,
        lng,
        title: e.title,
        price: `$${Math.round(Number(e.price_per_person))}`,
        type: "experience",
      });
    }
  });

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !mapRef.current || !window.L) return;
      const L = window.L;

      // Detectar si el modo oscuro está activo
      const isDark = document.documentElement.classList.contains("dark");

      // Limpiar mapa previo
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Centro por defecto: México
      const defaultCenter: [number, number] = [23.6345, -102.5528];
      const defaultZoom = 5;

      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      });
      mapInstanceRef.current = map;

      // Tile layers premium de CartoDB (limpios y estéticos)
      const lightTiles = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      const darkTiles = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

      L.tileLayer(isDark ? darkTiles : lightTiles, {
        maxZoom: 19,
      }).addTo(map);

      // Limpiar marcadores antiguos
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (points.length > 0) {
        const boundsPoints: [number, number][] = [];

        points.forEach((pt) => {
          // Custom HTML icon styled like a pricing badge
          const colorClass = pt.type === "property" 
            ? "bg-[var(--color-primary)] text-white" 
            : "bg-[var(--color-accent)] text-[var(--color-accent-dark)]";

          const badgeIcon = L.divIcon({
            className: "custom-map-badge-icon",
            html: `<div class="shadow-md border border-white/60 px-2 py-0.5 rounded-full text-[11px] font-bold transition-all hover:scale-105 hover:shadow-lg flex items-center justify-center ${colorClass}">${pt.price}</div>`,
            iconSize: [52, 22],
            iconAnchor: [26, 11],
          });

          // Crear popup descriptivo
          const linkPath = pt.type === "property" ? `/p/${pt.id}` : `/experiencias/${pt.id}`;
          const popupHtml = `
            <div style="font-family: var(--font-body), sans-serif; padding: 4px; min-width: 120px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #2c2c2a; line-clamp: 2;">${pt.title}</p>
              <a href="${linkPath}" style="display: inline-block; font-size: 11px; color: #147a5c; text-decoration: none; font-weight: 500;">Ver detalles →</a>
            </div>
          `;

          const marker = L.marker([pt.lat, pt.lng], { icon: badgeIcon })
            .addTo(map)
            .bindPopup(popupHtml, { closeButton: false, offset: L.point(0, -6) });

          markersRef.current.push(marker);
          boundsPoints.push([pt.lat, pt.lng]);
        });

        // Ajustar el mapa para mostrar todos los puntos
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }

      // Recalcular tamaño
      setTimeout(() => map.invalidateSize(), 150);
    });

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [properties, experiences]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full min-h-[300px] z-0"
    />
  );
}
