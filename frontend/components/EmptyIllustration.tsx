"use client";

import Link from "next/link";

type Variant = "search" | "reservations" | "messages" | "properties" | "generic";

interface Props {
  variant?: Variant;
  title?: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

const ILLUSTRATIONS: Record<Variant, React.ReactNode> = {
  search: (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="68" cy="65" r="42" fill="#E8F5F0" stroke="#147A5C" strokeWidth="2.5"/>
      <circle cx="68" cy="65" r="28" fill="white" stroke="#9FE1CB" strokeWidth="1.5"/>
      {/* Casa dentro de la lupa */}
      <path d="M68 48 L53 61 L55 61 L55 75 L81 75 L81 61 L83 61 Z" fill="#147A5C" opacity="0.15"/>
      <path d="M58 61 L68 51 L78 61" stroke="#147A5C" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <rect x="60" y="61" width="16" height="14" rx="1" stroke="#147A5C" strokeWidth="1.5" fill="#E8F5F0"/>
      <rect x="65" y="68" width="6" height="7" rx="1" fill="#147A5C" opacity="0.4"/>
      {/* Mango de lupa */}
      <line x1="103" y1="100" x2="116" y2="113" stroke="#147A5C" strokeWidth="5" strokeLinecap="round"/>
      {/* Signo de interrogación */}
      <text x="130" y="30" fill="#F5A623" fontSize="24" fontWeight="700">?</text>
      <style>{`
        svg { animation: search-bob 2.5s ease-in-out infinite; }
        @keyframes search-bob {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
      `}</style>
    </svg>
  ),
  reservations: (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="25" width="100" height="90" rx="10" fill="#E8F5F0" stroke="#147A5C" strokeWidth="2"/>
      <rect x="30" y="25" width="100" height="28" rx="10" fill="#147A5C"/>
      <rect x="30" y="43" width="100" height="10" fill="#147A5C"/>
      {/* Líneas de calendario */}
      <line x1="55" y1="15" x2="55" y2="35" stroke="#147A5C" strokeWidth="3" strokeLinecap="round"/>
      <line x1="105" y1="15" x2="105" y2="35" stroke="#147A5C" strokeWidth="3" strokeLinecap="round"/>
      {/* Días */}
      {[0,1,2,3,4].map((col) => [0,1,2].map((row) => (
        <circle key={`${col}-${row}`} cx={50 + col*16} cy={75 + row*16} r="4"
          fill={col === 2 && row === 0 ? "#F5A623" : "#9FE1CB"} opacity="0.6"/>
      )))}
      {/* Estrella flotante */}
      <text x="125" y="35" fill="#F5A623" fontSize="16" style={{ animation: "spin 4s linear infinite", transformOrigin: "130px 30px" }}>✦</text>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </svg>
  ),
  messages: (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Burbuja grande */}
      <rect x="20" y="20" width="90" height="55" rx="14" fill="#E8F5F0" stroke="#147A5C" strokeWidth="2"/>
      <path d="M35 75 L28 88 L50 75 Z" fill="#E8F5F0" stroke="#147A5C" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Líneas de texto */}
      <line x1="35" y1="37" x2="95" y2="37" stroke="#9FE1CB" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="35" y1="48" x2="80" y2="48" stroke="#9FE1CB" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="35" y1="59" x2="88" y2="59" stroke="#9FE1CB" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Burbuja pequeña */}
      <rect x="60" y="70" width="80" height="45" rx="12" fill="#FEF3DC" stroke="#F5A623" strokeWidth="2"/>
      <path d="M130 115 L138 125 L118 115 Z" fill="#FEF3DC" stroke="#F5A623" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="75" y1="84" x2="125" y2="84" stroke="#FAC775" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="75" y1="95" x2="110" y2="95" stroke="#FAC775" strokeWidth="2.5" strokeLinecap="round"/>
      <style>{`
        svg { animation: message-float 3s ease-in-out infinite; }
        @keyframes message-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </svg>
  ),
  properties: (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g style={{ animation: "house-float 3s ease-in-out infinite" }}>
        <ellipse cx="80" cy="132" rx="35" ry="5" fill="#147A5C" opacity="0.08"/>
        <rect x="42" y="75" width="76" height="55" rx="4" fill="#E8F5F0" stroke="#147A5C" strokeWidth="2"/>
        <path d="M34 77 L80 38 L126 77 Z" fill="#147A5C"/>
        <rect x="65" y="100" width="30" height="30" rx="15" fill="#147A5C" opacity="0.5"/>
        <rect x="47" y="83" width="22" height="18" rx="3" fill="white" stroke="#147A5C" strokeWidth="1.5"/>
        <rect x="91" y="83" width="22" height="18" rx="3" fill="white" stroke="#147A5C" strokeWidth="1.5"/>
        <circle cx="80" cy="30" r="8" fill="#F5A623"
          style={{ animation: "star-glow 2s ease-in-out infinite" }}/>
        <text x="77" y="34" fill="white" fontSize="10" fontWeight="700">+</text>
      </g>
      <style>{`
        @keyframes house-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes star-glow {
          0%, 100% { box-shadow: none; opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </svg>
  ),
  generic: (
    <svg width="160" height="140" viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="70" r="50" fill="#E8F5F0" opacity="0.5"/>
      <text x="80" y="85" textAnchor="middle" fontSize="48">🏡</text>
    </svg>
  ),
};

const DEFAULTS: Record<Variant, { title: string; description: string }> = {
  search:       { title: "Sin resultados", description: "Intenta cambiar las fechas, el destino o quitar algunos filtros." },
  reservations: { title: "Sin reservaciones aún", description: "Cuando hagas tu primera reserva aparecerá aquí." },
  messages:     { title: "Sin mensajes aún", description: "Cuando hagas o recibas una reserva, las conversaciones aparecerán aquí." },
  properties:   { title: "Sin propiedades aún", description: "Publica tu primer hospedaje para empezar a recibir huéspedes." },
  generic:      { title: "Nada por aquí", description: "No hay contenido que mostrar en este momento." },
};

export default function EmptyIllustration({ variant = "generic", title, description, action }: Props) {
  const defaults = DEFAULTS[variant];
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <div className="mb-6">{ILLUSTRATIONS[variant]}</div>
      <h3 className="text-h1 font-bold text-[var(--text-primary)] mb-2"
        style={{ fontFamily: "var(--font-display)" }}>
        {title ?? defaults.title}
      </h3>
      <p className="text-body text-[var(--text-secondary)] max-w-sm mb-6"
        style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
        {description ?? defaults.description}
      </p>
      {action && (
        action.href
          ? <Link href={action.href} className="btn btn-primary px-6">{action.label}</Link>
          : <button onClick={action.onClick} className="btn btn-primary px-6">{action.label}</button>
      )}
    </div>
  );
}
