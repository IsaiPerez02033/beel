"use client";

import { useState } from "react";
import type { PropertyAmenity } from "@/types";

// Mapa básico de slugs a emojis/iconos de texto
const ICONS: Record<string, string> = {
  wifi: "📶",
  estacionamiento: "🚗",
  piscina: "🏊",
  aire_acondicionado: "❄️",
  cocina: "🍳",
  lavadora: "🫧",
  tv: "📺",
  parrilla: "🔥",
  terraza: "🌿",
  jacuzzi: "🛁",
  gym: "💪",
  desayuno: "🍳",
  mascotas: "🐾",
  calefaccion: "🌡️",
  escritorio: "💻",
};

interface AmenityListProps {
  amenities: PropertyAmenity[];
  /** Cuántos mostrar antes del "Ver más" */
  limit?: number;
}

export default function AmenityList({
  amenities,
  limit = 10,
}: AmenityListProps) {
  const [showAll, setShowAll] = useState(false);
  if (!amenities || amenities.length === 0) {
    return (
      <p className="text-body-sm text-[var(--text-tertiary)]">
        No hay servicios registrados.
      </p>
    );
  }

  // Highlights primero
  const sorted = [...amenities].sort((a, b) =>
    a.amenity.is_highlight === b.amenity.is_highlight
      ? 0
      : a.amenity.is_highlight
      ? -1
      : 1
  );

  const visible = showAll ? sorted : sorted.slice(0, limit);
  const hidden = sorted.length - visible.length;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map(({ amenity }) => (
          <div key={amenity.id} className="flex items-center gap-3">
            <span className="text-lg w-6 text-center">
              {ICONS[amenity.slug] ?? "✓"}
            </span>
            <span className="text-body text-[var(--text-primary)]">
              {amenity.name_es}
            </span>
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="btn btn-ghost mt-4 text-body-sm"
        >
          Mostrar {hidden} más
        </button>
      )}
    </div>
  );
}
