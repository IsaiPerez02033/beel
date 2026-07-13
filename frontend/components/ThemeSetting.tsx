"use client";

import { useEffect, useState } from "react";
import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const OPTIONS = [
  { value: "system", label: "Automático", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
] as const;

/**
 * Fila de configuración para elegir el tema: Automático (sigue al sistema),
 * Claro u Oscuro. Pensada para la página de Perfil, junto a las demás
 * preferencias.
 */
export default function ThemeSetting() {
  const { preference, setPreference } = useTheme();
  // Evitar mismatch de hidratación: la preferencia solo se conoce en cliente.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[var(--text-secondary)]"><Sun size={18} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-body text-[var(--text-primary)]">Apariencia</span>
          <span className="block text-caption text-[var(--text-secondary)]">
            Automático sigue el tema de tu dispositivo
          </span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema de la aplicación">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = mounted && preference === value;
          return (
            <button
              key={value}
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(value)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors ${
                active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              <Icon size={20} />
              <span className="text-caption font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
