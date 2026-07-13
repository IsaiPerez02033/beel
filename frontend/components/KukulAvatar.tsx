"use client";

/**
 * Kukul — avatar de serpiente emplumada (Quetzalcóatl) del Concierge de Beel.
 *
 * SVG propio animado por CSS (sin librerías). Tres estados:
 *  - idle:     respira suave y parpadea de vez en cuando.
 *  - thinking: halo dorado que late + plumas ondulando en secuencia ("procesando").
 *  - done:     un asentimiento elástico con destello de plumas, y vuelve a idle.
 *
 * Las clases de animación viven en globals.css (kukul-*), respetando
 * prefers-reduced-motion.
 */
export default function KukulAvatar({
  size = 40,
  state = "idle",
}: {
  size?: number;
  state?:
    | "idle"
    | "listening"
    | "thinking"
    | "responding"
    | "success"
    | "error"
    | "celebration"
    | "sleeping"
    | "coiling"
    | "fluffing"
    | "done";
}) {
  return (
    <span
      className={`kukul kukul--${state}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Kukul, asistente de Beel"
    >
      <svg viewBox="0 0 64 64" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Fondo Aurora / Gradiente de Disco */}
          <radialGradient id="kukul-disc-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-primary-light)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--color-primary-light)" stopOpacity="0.4" />
          </radialGradient>

          {/* Gradiente semi-3D para el cuerpo */}
          <linearGradient id="kukul-body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1DA47E" />
            <stop offset="50%" stopColor="#147A5C" />
            <stop offset="100%" stopColor="#083E2F" />
          </linearGradient>

          {/* Gradiente semi-3D para la cabeza */}
          <radialGradient id="kukul-head-grad" cx="62%" cy="28%" r="68%">
            <stop offset="0%" stopColor="#24D3A1" />
            <stop offset="55%" stopColor="#147A5C" />
            <stop offset="100%" stopColor="#093C30" />
          </radialGradient>

          {/* Gradiente para plumas translúcidas doradas de Quetzal */}
          <linearGradient id="kukul-feather-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F5A623" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#FDBF4E" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFF5D8" stopOpacity="0.98" />
          </linearGradient>

          {/* Gradiente de volumen para el ojo cálido */}
          <radialGradient id="kukul-eye-grad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#1A473C" />
            <stop offset="100%" stopColor="#04120E" />
          </radialGradient>

          {/* Sombra de oclusión ambiental suave */}
          <filter id="kukul-ao-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0.6" dy="1.4" stdDeviation="0.9" floodColor="#041B14" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Disco de fondo con volumen sutil */}
        <circle cx="32" cy="32" r="32" className="kukul-disc" fill="url(#kukul-disc-grad)" />

        {/* Plumas en arco hacia atrás con borde de luz y oclusión ambiental */}
        <g className="kukul-feathers" filter="url(#kukul-ao-shadow)">
          <path className="kukul-feather kukul-feather-1" d="M20 40 C10 34 10 22 18 15 C18 24 22 30 27 34 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
          <path className="kukul-feather kukul-feather-2" d="M24 42 C13 39 11 26 20 18 C21 27 25 33 30 37 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
          <path className="kukul-feather kukul-feather-3" d="M28 44 C17 43 13 31 23 22 C24 31 28 37 33 40 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
        </g>

        {/* Cuerpo/curva de la serpiente (verde 3D) */}
        <path
          className="kukul-body"
          d="M28 46 C22 44 20 37 25 32 C29 28 37 28 41 24 C45 20 44 14 39 12 C46 12 51 17 51 24 C51 32 44 37 37 38 C33 39 31 42 33 46 Z"
          fill="url(#kukul-body-grad)"
          filter="url(#kukul-ao-shadow)"
        />

        {/* Cabeza / hocico (verde 3D) */}
        <path
          className="kukul-head"
          d="M39 11 C47 10 54 15 55 23 C55.5 27 53 30 49 30 C45 30 42 27 42 23 C42 20 40 18 37 18 C37 14 38 12 39 11 Z"
          fill="url(#kukul-head-grad)"
        />

        {/* Ojo inteligente con iris central y reflejos brillantes (diseño expresivo ampliado) */}
        <circle className="kukul-eye" cx="48" cy="21" r="3.2" fill="url(#kukul-eye-grad)" />
        <circle className="kukul-eye-iris" cx="48.1" cy="21.1" r="1.6" fill="var(--color-accent)" opacity="0.65" />
        <circle className="kukul-eye-shine kukul-eye-shine-1" cx="49.1" cy="19.9" r="1.0" fill="#ffffff" />
        <circle className="kukul-eye-shine kukul-eye-shine-2" cx="46.9" cy="22.1" r="0.45" fill="#ffffff" opacity="0.65" />

        {/* Lengua bífida */}
        <path className="kukul-tongue" d="M54 24 L60 24 M60 24 L63.5 22 M60 24 L63.5 26" />
      </svg>
    </span>
  );
}
