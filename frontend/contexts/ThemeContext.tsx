"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

// Tema efectivo que se pinta en pantalla
type Theme = "light" | "dark";
// Preferencia del usuario: "system" sigue al sistema operativo
type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "beel-theme";

interface ThemeContextValue {
  /** Tema que realmente se está aplicando (claro u oscuro). */
  theme: Theme;
  /** Preferencia elegida por el usuario (automático, claro u oscuro). */
  preference: ThemePreference;
  /** Cambia la preferencia; "system" vuelve a seguir al sistema. */
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

/**
 * Controla el tema claro/oscuro de la app.
 *
 * Por defecto es AUTOMÁTICO: sigue la preferencia del sistema operativo
 * (prefers-color-scheme) y reacciona a sus cambios en vivo. El usuario puede
 * fijarlo manualmente en Perfil → Apariencia; esa elección se guarda en
 * localStorage y "Automático" simplemente borra esa preferencia guardada.
 *
 * Nota: el script anti-parpadeo (themeInitScript) corre antes de la
 * hidratación para evitar el flash de tema incorrecto (FOUC).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setThemeState] = useState<Theme>("light");

  // Al montar, leer la preferencia guardada y sincronizar el estado de React
  // con lo que el script inline ya aplicó al <html>.
  useEffect(() => {
    let stored: ThemePreference = "system";
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {}
    setPreferenceState(stored);
    setThemeState(stored === "system" ? systemTheme() : stored);
  }, []);

  // En modo automático, seguir los cambios del sistema en vivo.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? "dark" : "light";
      applyTheme(next);
      setThemeState(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  // Sincronizar el color de la barra de estado (theme-color) con el tema activo.
  useEffect(() => {
    const color = theme === "dark" ? "#1A1A18" : "#FFFFFF";

    let meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);

    const mediaMetas = document.querySelectorAll('meta[name="theme-color"][media]');
    mediaMetas.forEach((m) => m.setAttribute("content", color));
  }, [theme]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    const resolved = p === "system" ? systemTheme() : p;
    applyTheme(resolved);
    setThemeState(resolved);
    try {
      if (p === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, p);
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}

/**
 * Script que se inyecta en <head> y corre ANTES de pintar la página,
 * evitando el flash de tema incorrecto (FOUC). Sin preferencia guardada
 * (modo automático) sigue al sistema.
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('beel-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = (stored === 'light' || stored === 'dark') ? stored === 'dark' : prefersDark;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
