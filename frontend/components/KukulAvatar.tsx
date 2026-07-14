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

          {/* Gradiente para plumas majestuosas de Quetzal */}
          <linearGradient id="kukul-feather-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1DA47E" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#F5A623" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFF5D8" stopOpacity="0.98" />
          </linearGradient>

          {/* Gradiente semi-3D para el vientre y pecho */}
          <linearGradient id="kukul-belly-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD466" />
            <stop offset="50%" stopColor="#F5A623" />
            <stop offset="100%" stopColor="#C47E0B" />
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

        {/* Plumas de la corona de Quetzal detrás del cuello y la cabeza */}
        <g className="kukul-feathers" filter="url(#kukul-ao-shadow)">
          <path className="kukul-feather kukul-feather-1" d="M36 15 C24 10 22 2 31 1 C33 6 35 10 36 12 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
          <path className="kukul-feather kukul-feather-2" d="M34 18 C22 15 18 8 26 6 C29 11 31 14 33 16 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
          <path className="kukul-feather kukul-feather-3" d="M33 21 C21 20 16 14 23 12 C26 16 29 18 31 20 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
        </g>

        {/* Vientre y pecho tridimensional (contraste oro-crema) */}
        <g className="kukul-belly-group" filter="url(#kukul-ao-shadow)">
          <path className="kukul-belly kukul-belly-chest" d="M42 23 C45 28 44 34 37 36 C39 33 40 28 42 23 Z" fill="url(#kukul-belly-grad)" />
          <path className="kukul-belly kukul-belly-tail" d="M34 38 C26 40 21 45 24 49 C23 46 28 42 34 38 Z" fill="url(#kukul-belly-grad)" />
        </g>

        {/* Cuerpo/curva de la serpiente (verde 3D) */}
        <path
          className="kukul-body"
          d="M41 23 C44 29 44 35 36 37 C26 39 20 44 22 49 C24 52 29 52 32 48 C36 43 32 40 28 40 C24 40 23 44 25 46 C21 44 21 39 30 37 C39 35 44 30 42 23 Z"
          fill="url(#kukul-body-grad)"
          filter="url(#kukul-ao-shadow)"
        />

        {/* Cabeza de la serpiente (verde 3D, mirando a la derecha) */}
        <path
          className="kukul-head"
          d="M38 18 C38 13 46 12 51 16 C54 18 54 21 51 23 C48 25 42 25 38 22 Z"
          fill="url(#kukul-head-grad)"
        />

        {/* Ojo inteligente con iris central y reflejos brillantes (diseño expresivo ampliado) */}
        <circle className="kukul-eye" cx="46" cy="18" r="3.2" fill="url(#kukul-eye-grad)" />
        <circle className="kukul-eye-iris" cx="46.1" cy="18.1" r="1.6" fill="var(--color-accent)" opacity="0.65" />
        <circle className="kukul-eye-shine kukul-eye-shine-1" cx="47.1" cy="16.9" r="1.0" fill="#ffffff" />
        <circle className="kukul-eye-shine kukul-eye-shine-2" cx="44.9" cy="19.1" r="0.45" fill="#ffffff" opacity="0.65" />

        {/* Lengua bífida alineada con la boca */}
        <path className="kukul-tongue" d="M51 20 L57 20 M57 20 L60.5 18 M57 20 L60.5 22" />
      </svg>
    </span>
  );
}
