import type { Config } from "tailwindcss";

/**
 * Beel Design System — Tailwind Configuration
 *
 * Tokens organizados por categoría:
 *   colors      → paleta completa de Beel + semánticos
 *   fontFamily  → Plus Jakarta Sans (display/UI) + Inter (body)
 *   fontSize    → escala tipográfica con line-height
 *   spacing     → base 4px (idéntico a Tailwind default, documentado explícitamente)
 *   borderRadius→ escala de radios de Beel
 *   boxShadow   → sombras suaves (sin sombras fuertes per diseño)
 *   screens     → breakpoints mobile-first
 */

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      // ── Colores ───────────────────────────────────────────────────────────
      colors: {
        // Marca principal
        beel: {
          // Verde Cenote — color primario
          primary: {
            DEFAULT: "#147A5C",
            50:  "#E8F5F0",
            100: "#C9E9DC",
            200: "#9FD9C3",
            300: "#6DC7A8",
            400: "#147A5C", // DEFAULT
            500: "#18875F",
            600: "#0F6E56", // Secondary
            700: "#0A5242",
            800: "#06372D",
            900: "#031D17",
          },
          // Arena — fondo neutro cálido
          arena: "#F1EFE8",
          // Tierra — texto oscuro
          tierra: "#2C2C2A",
          // Ámbar — acento / CTA reserva
          accent: {
            DEFAULT: "#F5A623",
            50:  "#FEF9EC",
            100: "#FEF3DC",
            200: "#FDE4A8",
            300: "#FAC775",
            400: "#F5A623", // DEFAULT
            500: "#E08A0A",
            600: "#B86F06",
            700: "#8A5204",
          },
        },
        // Semánticos (mapean a Beel brand)
        primary:   "#147A5C",
        secondary: "#0F6E56",
        accent:    "#F5A623",
        // Utilidades
        success: "#10B981",
        error:   "#EF4444",
        warning: "#F59E0B",
        info:    "#3B82F6",
      },

      // ── Tipografía ────────────────────────────────────────────────────────
      fontFamily: {
        // Headings, botones, UI labels
        display: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        // Body text, descripciones, metadata
        body:    ["Inter", "system-ui", "sans-serif"],
        // Alias conveniente
        sans:    ["Inter", "system-ui", "sans-serif"],
      },

      fontSize: {
        // Escala tipográfica de Beel
        // [tamaño, { lineHeight, letterSpacing? }]
        "display":   ["28px", { lineHeight: "1.2",  fontWeight: "500" }],
        "h1":        ["22px", { lineHeight: "1.3",  fontWeight: "500" }],
        "h2":        ["17px", { lineHeight: "1.35", fontWeight: "500" }],
        "h3":        ["15px", { lineHeight: "1.4",  fontWeight: "500" }],
        "body-lg":   ["15px", { lineHeight: "1.6" }],
        "body":      ["14px", { lineHeight: "1.6" }],
        "body-sm":   ["13px", { lineHeight: "1.5" }],
        "caption":   ["12px", { lineHeight: "1.5" }],
        "caption-sm":["11px", { lineHeight: "1.4" }],
        "micro":     ["10px", { lineHeight: "1.4" }],
      },

      // ── Espaciado (base 4px — documentado) ───────────────────────────────
      // Tailwind ya usa base 4px. Aquí solo se documentan los valores clave
      // de Beel para que el equipo los tenga como referencia.
      // 1 = 4px | 2 = 8px | 3 = 12px | 4 = 16px | 5 = 20px | 6 = 24px
      // 8 = 32px | 10 = 40px | 12 = 48px | 16 = 64px | 20 = 80px

      // ── Border Radius ─────────────────────────────────────────────────────
      borderRadius: {
        none:  "0",
        sm:    "6px",
        DEFAULT:"8px",
        md:    "10px",
        lg:    "12px",
        xl:    "14px",
        "2xl": "16px",
        "3xl": "20px",
        full:  "9999px",  // Pills, badges, botones principales
        // Alias semánticos
        card:     "14px", // Property cards
        badge:    "9999px",
        button:   "9999px",
        input:    "8px",
        modal:    "20px",
        panel:    "16px",
      },

      // ── Sombras (suaves — Beel no usa sombras fuertes) ───────────────────
      boxShadow: {
        // Sistema flat con sombras muy suaves
        none:    "none",
        xs:      "0 1px 2px rgba(0,0,0,0.04)",
        sm:      "0 1px 4px rgba(0,0,0,0.06)",
        DEFAULT: "0 2px 8px rgba(0,0,0,0.08)",
        md:      "0 4px 12px rgba(0,0,0,0.10)",
        lg:      "0 8px 24px rgba(0,0,0,0.12)",
        // Sombra de elevación para cards en hover
        card:    "0 4px 16px rgba(29,158,117,0.12)",
        // Sombra para search bar
        search:  "0 2px 12px rgba(15,110,86,0.10)",
        // Sin sombra (borde sutil en lugar de sombra)
        border:  "0 0 0 0.5px rgba(0,0,0,0.08)",
      },

      // ── Breakpoints (mobile-first) ────────────────────────────────────────
      screens: {
        xs:   "375px",   // iPhone SE
        sm:   "640px",   // Teléfono grande
        md:   "768px",   // Tablet
        lg:   "1024px",  // Desktop pequeño
        xl:   "1280px",  // Desktop
        "2xl":"1440px",  // Desktop grande
      },

      // ── Transiciones ──────────────────────────────────────────────────────
      transitionDuration: {
        DEFAULT: "150ms",
        fast:    "100ms",
        normal:  "200ms",
        slow:    "300ms",
      },

      // ── Z-Index ───────────────────────────────────────────────────────────
      zIndex: {
        base:     "0",
        raised:   "10",
        dropdown: "100",
        overlay:  "200",
        modal:    "300",
        toast:    "400",
        map:      "50",
        // Mapa tiene z-index propio para que los popups de mapa
        // queden por encima del contenido pero debajo de modales
      },

      // ── Aspect Ratios ─────────────────────────────────────────────────────
      aspectRatio: {
        "property-card": "4 / 3",   // Foto en property card
        "property-hero": "16 / 9",  // Foto principal en detalle
        "gallery-thumb": "1 / 1",   // Miniaturas de galería
        "avatar":        "1 / 1",
      },
    },
  },
  plugins: [
    // Añadir cuando sea necesario:
    // require("@tailwindcss/forms"),
    // require("@tailwindcss/typography"),
    // require("@tailwindcss/line-clamp"),  // ya incluido en Tailwind v3.3+
  ],
};

export default config;
