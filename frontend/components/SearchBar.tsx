"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import DateRangePicker from "@/components/DateRangePicker";

interface SearchBarProps {
  /** Versión compacta para navbar en página de búsqueda */
  compact?: boolean;
  /** Valores iniciales (para pre-llenar desde URL) */
  initialValues?: {
    destino?: string;
    checkIn?: string;
    checkOut?: string;
    huespedes?: number;
  };
}

export default function SearchBar({
  compact = false,
  initialValues = {},
}: SearchBarProps) {
  const router = useRouter();
  const [destino, setDestino] = useState(initialValues.destino ?? "");
  const [checkIn, setCheckIn] = useState(initialValues.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initialValues.checkOut ?? "");
  const [huespedes, setHuespedes] = useState(initialValues.huespedes ?? 1);
  const [activeField, setActiveField] = useState<string | null>(null);
  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return format(d, "yyyy-MM-dd");
  }, []);

  function handleSearch() {
    const params = new URLSearchParams();
    if (destino) params.set("destino", destino);
    if (checkIn) params.set("check_in", checkIn);
    if (checkOut) params.set("check_out", checkOut);
    if (huespedes > 1) params.set("huespedes", String(huespedes));
    router.push(`/buscar?${params.toString()}`);
  }

  if (compact) {
    // Barra compacta con búsqueda funcional
    return (
      <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl shadow-sm px-3 py-1.5">
        <Search size={15} className="text-[var(--color-primary)] flex-shrink-0" />

        {/* Destino */}
        <input
          type="text"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          placeholder="¿A dónde vas?"
          className="text-body-sm text-[var(--text-primary)] bg-transparent outline-none w-28 placeholder:text-[var(--text-tertiary)]"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />

        <span className="text-[var(--border-strong)] text-body-sm">·</span>

        {/* Fechas compactas */}
        <DateRangePicker
          checkIn={checkIn}
          checkOut={checkOut}
          onCheckIn={setCheckIn}
          onCheckOut={setCheckOut}
          compact
        />

        <span className="text-[var(--border-strong)] text-body-sm">·</span>

        {/* Huéspedes */}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setHuespedes(Math.max(1, huespedes - 1))}
            className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-caption hover:border-[var(--text-primary)] transition-colors">−</button>
          <span className="text-body-sm text-[var(--text-primary)] min-w-[1ch] text-center">{huespedes}</span>
          <button type="button" onClick={() => setHuespedes(Math.min(16, huespedes + 1))}
            className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-caption hover:border-[var(--text-primary)] transition-colors">+</button>
        </div>

        <button
          onClick={handleSearch}
          className="ml-1 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors flex-shrink-0"
        >
          <Search size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="search-bar rounded-2xl">
        {/* Destino */}
        <div
          className={cn(
            "search-bar-field flex-[2] flex flex-col justify-center cursor-pointer rounded-l-2xl",
            activeField === "destino" && "bg-[var(--bg-elevated)] ring-1 ring-[var(--color-primary)] ring-inset"
          )}
          onClick={() => setActiveField("destino")}
        >
          <span className="search-bar-label">¿A dónde?</span>
          <input
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Destino o ciudad"
            className="search-bar-value bg-transparent outline-none w-full sm:text-left text-center"
            onFocus={() => setActiveField("destino")}
            onBlur={() => setActiveField(null)}
          />
        </div>

        {/* Fechas — DateRangePicker personalizado (sin wrapper search-bar-field para que el popover no quede clippeado) */}
        <DateRangePicker
          checkIn={checkIn}
          checkOut={checkOut}
          onCheckIn={setCheckIn}
          onCheckOut={setCheckOut}
        />

        {/* Huéspedes + botón buscar (desktop: inline / móvil: separados) */}
        <div
          className={cn(
            "search-bar-field flex items-center justify-between gap-3 rounded-r-2xl border-r-0",
            activeField === "guests" && "bg-[var(--bg-elevated)] ring-1 ring-[var(--color-primary)] ring-inset"
          )}
        >
          <div
            className="flex flex-col justify-center flex-1 cursor-pointer items-center sm:items-start"
            onClick={() => setActiveField("guests")}
          >
            <span className="search-bar-label">Huéspedes</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={(e) => { e.stopPropagation(); setHuespedes(Math.max(1, huespedes - 1)); }}
                className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-sm leading-none hover:border-[var(--border-strong)] transition-colors">−</button>
              <span className="search-bar-value min-w-[1.5ch] text-center">{huespedes}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setHuespedes(Math.min(16, huespedes + 1)); }}
                className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-sm leading-none hover:border-[var(--border-strong)] transition-colors">+</button>
            </div>
          </div>

          {/* Botón circular solo en desktop */}
          <button onClick={handleSearch} aria-label="Buscar"
            className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm">
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* Botón buscar full-width solo en móvil — fuera del card */}
      <button onClick={handleSearch}
        className="sm:hidden mt-3 w-full h-12 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center gap-2 hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm font-medium">
        <Search size={16} />
        Buscar
      </button>
    </div>
  );
}
