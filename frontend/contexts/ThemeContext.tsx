"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Aplica la clase .dark en <html> y persiste la preferencia.
 * Por defecto sigue la preferencia del sistema; si el usuario elige
 * manualmente, se recuerda en localStorage.
 *
 * Nota: el script anti-parpadeo (themeInitScript) corre antes de la
 * hidratación para evitar el flash de tema incorrecto.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Sincroniza el estado de React con lo que el script inline ya aplicó
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");

    // Si el usuario no ha elegido manualmente, sigue los cambios del sistema
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("beel-theme")) {
        applyTheme(e.matches ? "dark" : "light");
        setThemeState(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Sincronizar el color de la barra de estado (theme-color) dinámicamente
  useEffect(() => {
    const color = theme === "dark" ? "#1A1A18" : "#FFFFFF";
    
    // Primero intentamos actualizar cualquier tag sin media query
    let meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);

    // Opcionalmente actualizamos también los de media query para sincronizar el estado manual
    const mediaMetas = document.querySelectorAll('meta[name="theme-color"][media]');
    mediaMetas.forEach((m) => {
      m.setAttribute("content", color);
    });
  }, [theme]);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  };

  const setTheme = useCallback((t: Theme) => {
    applyTheme(t);
    localStorage.setItem("beel-theme", t);
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
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
 * evitando el flash de tema incorrecto (FOUC).
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('beel-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : prefersDark;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
