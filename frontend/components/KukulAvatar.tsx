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
  state?: "idle" | "coiling" | "thinking" | "fluffing" | "done";
}) {
  return (
    <span
      className={`kukul kukul--${state}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Kukul, asistente de Beel"
    >
      <svg viewBox="0 0 64 64" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        {/* Disco de fondo */}
        <circle cx="32" cy="32" r="32" className="kukul-disc" />

        {/* Plumas en arco hacia atrás (dorado). Cada una anima en secuencia. */}
        <g className="kukul-feathers">
          <path className="kukul-feather kukul-feather-1" d="M20 40 C10 34 10 22 18 15 C18 24 22 30 27 34 Z" />
          <path className="kukul-feather kukul-feather-2" d="M24 42 C13 39 11 26 20 18 C21 27 25 33 30 37 Z" />
          <path className="kukul-feather kukul-feather-3" d="M28 44 C17 43 13 31 23 22 C24 31 28 37 33 40 Z" />
        </g>

        {/* Cuerpo/curva de la serpiente (verde) */}
        <path
          className="kukul-body"
          d="M28 46 C22 44 20 37 25 32 C29 28 37 28 41 24 C45 20 44 14 39 12 C46 12 51 17 51 24 C51 32 44 37 37 38 C33 39 31 42 33 46 Z"
        />

        {/* Cabeza / hocico */}
        <path
          className="kukul-head"
          d="M39 11 C47 10 54 15 55 23 C55.5 27 53 30 49 30 C45 30 42 27 42 23 C42 20 40 18 37 18 C37 14 38 12 39 11 Z"
        />

        {/* Ojo */}
        <circle className="kukul-eye" cx="48" cy="21" r="2.6" />
        <circle className="kukul-eye-shine" cx="48.9" cy="20.1" r="0.9" />

        {/* Lengua bífida (sale del hocico y se bifurca en Y) */}
        <path className="kukul-tongue" d="M54 24 L60 24 M60 24 L63.5 22 M60 24 L63.5 26" />
      </svg>
    </span>
  );
}
