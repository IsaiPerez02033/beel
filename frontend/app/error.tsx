"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4">
      <div className="flex flex-col items-center text-center max-w-md">

        {/* Ilustración SVG animada */}
        <svg width="180" height="150" viewBox="0 0 180 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-8">
          {/* Rayo animado */}
          <g style={{ animation: "zap 1.5s ease-in-out infinite" }}>
            <path d="M90 20 L70 75 L88 75 L72 130 L115 60 L95 60 Z"
              fill="#F5A623" stroke="#E08A0A" strokeWidth="2" strokeLinejoin="round"/>
          </g>
          {/* Círculo de fondo */}
          <circle cx="90" cy="75" r="60" fill="#FEF3DC" opacity="0.5"/>
          {/* Partículas */}
          <circle cx="40" cy="40" r="4" fill="#F5A623" opacity="0.6"
            style={{ animation: "particle 1.5s ease-in-out infinite 0.2s" }}/>
          <circle cx="145" cy="50" r="3" fill="#147A5C" opacity="0.5"
            style={{ animation: "particle 1.5s ease-in-out infinite 0.5s" }}/>
          <circle cx="35" cy="110" r="3" fill="#F5A623" opacity="0.4"
            style={{ animation: "particle 1.5s ease-in-out infinite 0.8s" }}/>
          <circle cx="148" cy="105" r="4" fill="#147A5C" opacity="0.4"
            style={{ animation: "particle 1.5s ease-in-out infinite 0.1s" }}/>

          <style>{`
            @keyframes zap {
              0%, 100% { transform: scale(1); filter: brightness(1); }
              50% { transform: scale(1.05); filter: brightness(1.2); }
            }
            @keyframes particle {
              0%, 100% { transform: translateY(0) scale(1); opacity: 0.5; }
              50% { transform: translateY(-8px) scale(1.3); opacity: 0.9; }
            }
          `}</style>
        </svg>

        <h2 className="text-display font-bold text-[var(--text-primary)] mb-2"
          style={{ fontFamily: "var(--font-display)" }}>
          Algo salió mal
        </h2>
        <p className="text-body text-[var(--text-secondary)] mb-8"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          Ocurrió un error inesperado. No te preocupes, lo estamos revisando.
        </p>
        <button onClick={reset} className="btn btn-primary px-8 py-3">
          Reintentar
        </button>
      </div>
    </div>
  );
}
