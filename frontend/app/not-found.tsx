import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 text-center">

        {/* Ilustración SVG animada */}
        <svg width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-8">
          {/* Casa flotante */}
          <g style={{ animation: "float 3s ease-in-out infinite" }}>
            {/* Sombra */}
            <ellipse cx="100" cy="148" rx="40" ry="6" fill="#147A5C" opacity="0.1"
              style={{ animation: "shadow-pulse 3s ease-in-out infinite" }} />
            {/* Cuerpo de la casa */}
            <rect x="60" y="90" width="80" height="55" rx="4" fill="#E8F5F0" stroke="#147A5C" strokeWidth="2"/>
            {/* Techo */}
            <path d="M52 92 L100 50 L148 92 Z" fill="#147A5C"/>
            <path d="M52 92 L100 50 L148 92" stroke="#0E5C44" strokeWidth="1.5" fill="none"/>
            {/* Puerta */}
            <rect x="87" y="115" width="26" height="30" rx="13" fill="#147A5C" opacity="0.6"/>
            {/* Ventanas */}
            <rect x="65" y="100" width="22" height="18" rx="3" fill="white" stroke="#147A5C" strokeWidth="1.5"/>
            <rect x="113" y="100" width="22" height="18" rx="3" fill="white" stroke="#147A5C" strokeWidth="1.5"/>
            {/* Cruz en ventanas */}
            <line x1="76" y1="100" x2="76" y2="118" stroke="#147A5C" strokeWidth="1"/>
            <line x1="65" y1="109" x2="87" y2="109" stroke="#147A5C" strokeWidth="1"/>
            <line x1="124" y1="100" x2="124" y2="118" stroke="#147A5C" strokeWidth="1"/>
            <line x1="113" y1="109" x2="135" y2="109" stroke="#147A5C" strokeWidth="1"/>
            {/* Chimenea */}
            <rect x="118" y="55" width="12" height="20" rx="2" fill="#147A5C"/>
            {/* Humo */}
            <circle cx="124" cy="48" r="4" fill="#9FE1CB" opacity="0.6"
              style={{ animation: "smoke1 2s ease-out infinite" }}/>
            <circle cx="120" cy="40" r="3" fill="#9FE1CB" opacity="0.4"
              style={{ animation: "smoke2 2s ease-out infinite 0.3s" }}/>
          </g>
          {/* Número 404 debajo */}
          <text x="100" y="20" textAnchor="middle" fill="#F5A623" fontSize="22" fontWeight="700"
            fontFamily="Plus Jakarta Sans, sans-serif" letterSpacing="-1">
            404
          </text>

          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-8px); }
            }
            @keyframes shadow-pulse {
              0%, 100% { opacity: 0.1; rx: 40; }
              50% { opacity: 0.06; rx: 35; }
            }
            @keyframes smoke1 {
              0% { transform: translateY(0) scale(1); opacity: 0.6; }
              100% { transform: translateY(-16px) scale(1.5); opacity: 0; }
            }
            @keyframes smoke2 {
              0% { transform: translateY(0) scale(1); opacity: 0.4; }
              100% { transform: translateY(-14px) scale(1.4); opacity: 0; }
            }
          `}</style>
        </svg>

        <h1 className="text-display font-bold text-[var(--text-primary)] mb-2"
          style={{ fontFamily: "var(--font-display)" }}>
          Página no encontrada
        </h1>
        <p className="text-body text-[var(--text-secondary)] max-w-sm mb-8"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          Esta dirección no existe o fue movida a otro lugar.
        </p>
        <Link href="/" className="btn btn-primary px-8 py-3">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
