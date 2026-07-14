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

          {/* Gradiente semi-3D para el cuerpo (Jade pulido con reflejos turquesa) */}
          <linearGradient id="kukul-body-grad" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#1EBE94" />
            <stop offset="40%" stopColor="#147A5C" />
            <stop offset="85%" stopColor="#084937" />
            <stop offset="100%" stopColor="#03251B" />
          </linearGradient>

          {/* Gradiente semi-3D para la cabeza (Volumen de jade esmeralda pulido) */}
          <radialGradient id="kukul-head-grad" cx="65%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#3AE8BD" />
            <stop offset="50%" stopColor="#147A5C" />
            <stop offset="90%" stopColor="#073F30" />
            <stop offset="100%" stopColor="#032118" />
          </radialGradient>

          {/* Gradiente para plumas majestuosas de Quetzal (Luz y oro translúcido) */}
          <linearGradient id="kukul-feather-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D48C00" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#FDBF4E" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFF2CC" stopOpacity="1" />
          </linearGradient>

          {/* Gradiente semi-3D para el vientre y pecho (Oro resinado) */}
          <linearGradient id="kukul-belly-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF2CC" />
            <stop offset="50%" stopColor="#FDBF4E" />
            <stop offset="100%" stopColor="#B27500" />
          </linearGradient>

          {/* Gradiente de volumen para el ojo profundo (Iris esmeralda y pupila) */}
          <radialGradient id="kukul-eye-grad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#2D6053" />
            <stop offset="60%" stopColor="#0A241E" />
            <stop offset="100%" stopColor="#020C09" />
          </radialGradient>

          {/* Sombra de oclusión ambiental suave */}
          <filter id="kukul-ao-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0.6" dy="1.4" stdDeviation="0.9" floodColor="#041B14" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Disco de fondo con volumen sutil */}
        <circle cx="32" cy="32" r="32" className="kukul-disc" fill="url(#kukul-disc-grad)" />

        {/* Plumas de la corona de Quetzal que emergen naturalmente de la nuca/cuello */}
        <g className="kukul-feathers" filter="url(#kukul-ao-shadow)">
          <path className="kukul-feather kukul-feather-1" d="M37 20 C24 12 18 2 26 -2 C28 5 31 12 35 16 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
          <path className="kukul-feather kukul-feather-2" d="M36 22 C22 17 15 10 21 4 C24 10 27 16 32 19 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
          <path className="kukul-feather kukul-feather-3" d="M35 24 C20 22 13 16 17 11 C20 16 23 20 29 22 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" />
        </g>

        {/* Vientre y pecho tridimensional (contraste oro-resina para volumen) */}
        <g className="kukul-belly-group" filter="url(#kukul-ao-shadow)">
          <path className="kukul-belly kukul-belly-chest" d="M40.5 22.8 C42.5 27 42.5 33 38 35.5 C39 33 39.5 27 40.5 22.8 Z" fill="url(#kukul-belly-grad)" />
          <path className="kukul-belly kukul-belly-tail" d="M30 45 C22 47 18 51 20 54 C21 52 25 49 30 45 Z" fill="url(#kukul-belly-grad)" />
        </g>

        {/* Cuerpo/curva de la serpiente (Un solo trazo calligráfico fluido con cola ahusada) */}
        <path
          className="kukul-body"
          d="M38 22 C41 27 44 32 44 37 C44 43 38 46 30 48 C20 50 16 53 18 56 C20 58 24 58 28 55 C33 51 31 46 27 46 C25 46 25 48 26 49 C24 48 24 45 30 43 C37 41 41 36 39 30 C37 26 36 24 38 22 Z"
          fill="url(#kukul-body-grad)"
          filter="url(#kukul-ao-shadow)"
        />

        {/* Cabeza de la serpiente (Curvas continuas y conexión fluida con el cuello) */}
        <path
          className="kukul-head"
          d="M38 22 C37 15 44 11 49 14 C54 17 54 21 50 23.5 C46 25.5 41.5 25 38 22 Z"
          fill="url(#kukul-head-grad)"
        />

        {/* Ojo Pixar/VisionOS (Gran expresividad con triple brillo refractivo asimétrico) */}
        <circle className="kukul-eye" cx="46" cy="18" r="3.4" fill="url(#kukul-eye-grad)" />
        <circle className="kukul-eye-iris" cx="46.1" cy="18.1" r="1.7" fill="var(--color-accent)" opacity="0.65" />
        <circle className="kukul-eye-shine kukul-eye-shine-1" cx="47.1" cy="16.9" r="1.1" fill="#ffffff" />
        <circle className="kukul-eye-shine kukul-eye-shine-2" cx="44.8" cy="19.2" r="0.5" fill="#ffffff" opacity="0.6" />
        <circle className="kukul-eye-shine kukul-eye-shine-3" cx="46.7" cy="19.5" r="0.25" fill="#ffffff" opacity="0.4" />

        {/* Lengua bífida alineada con la boca */}
        <path className="kukul-tongue" d="M51 20 L57 20 M57 20 L60.5 18 M57 20 L60.5 22" />

        {/* Partículas de cálculo flotantes diminutas y sutiles (Thinking state) */}
        <g className="kukul-particles">
          <circle className="kukul-particle kukul-particle-1" cx="32" cy="32" r="0.8" fill="#FDBF4E" />
          <circle className="kukul-particle kukul-particle-2" cx="32" cy="32" r="0.6" fill="#FFF2CC" />
          <circle className="kukul-particle kukul-particle-3" cx="32" cy="32" r="0.5" fill="#ffffff" />
        </g>
      </svg>
    </span>
  );
}
