"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * Aviso global de plataforma en demostración.
 * Las propiedades publicadas actualmente son de ejemplo: nadie debe
 * intentar reservar o pagar. Se muestra en todas las páginas y puede
 * ocultarse durante la sesión (no persiste).
 */
export default function DemoBanner() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className="w-full bg-[#F5A623] text-[#2C2C2A]">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2.5 text-caption sm:text-body-sm font-medium">
        <AlertTriangle size={16} className="flex-shrink-0" />
        <p className="flex-1 leading-snug">
          Beel está en fase de demostración. Las propiedades mostradas son{" "}
          <strong>ejemplos ficticios</strong> — por favor no intentes reservar ni
          realizar pagos.
        </p>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Cerrar aviso"
          className="flex-shrink-0 p-1 rounded-md hover:bg-black/10 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
