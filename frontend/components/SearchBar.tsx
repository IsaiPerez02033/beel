"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
    return (
      <button
        onClick={() => router.push("/buscar")}
        className="flex items-center gap-3 bg-white border border-[var(--border-default)] rounded-full px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow"
      >
        <Search size={16} className="text-[var(--color-primary)]" />
        <span className="text-body-sm text-[var(--text-secondary)]">
          {destino || "¿A dónde vas?"}
        </span>
        <span className="text-[var(--border-strong)]">·</span>
        <span className="text-body-sm text-[var(--text-secondary)]">
          {checkIn ? checkIn : "Fechas"}
        </span>
        <span className="text-[var(--border-strong)]">·</span>
        <span className="text-body-sm text-[var(--text-secondary)]">
          {huespedes > 1 ? `${huespedes} huéspedes` : "Huéspedes"}
        </span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="search-bar rounded-2xl">
        {/* Destino */}
        <div
          className={cn(
            "search-bar-field flex-[2] flex flex-col justify-center cursor-pointer rounded-l-2xl",
            activeField === "destino" && "bg-white ring-1 ring-[var(--color-primary)] ring-inset"
          )}
          onClick={() => setActiveField("destino")}
        >
          <span className="search-bar-label">¿A dónde?</span>
          <input
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Destino o ciudad"
            className="search-bar-value bg-transparent outline-none w-full"
            onFocus={() => setActiveField("destino")}
            onBlur={() => setActiveField(null)}
          />
        </div>

        {/* Check-in */}
        <div
          className={cn(
            "search-bar-field flex flex-col justify-center cursor-pointer",
            activeField === "checkin" && "bg-white ring-1 ring-[var(--color-primary)] ring-inset"
          )}
          onClick={() => setActiveField("checkin")}
        >
          <span className="search-bar-label">Llegada</span>
          <input
            type="date"
            value={checkIn}
            min={today}
            onChange={(e) => setCheckIn(e.target.value)}
            className="search-bar-value bg-transparent outline-none w-full"
            onFocus={() => setActiveField("checkin")}
            onBlur={() => setActiveField(null)}
          />
        </div>

        {/* Check-out */}
        <div
          className={cn(
            "search-bar-field flex flex-col justify-center cursor-pointer",
            activeField === "checkout" && "bg-white ring-1 ring-[var(--color-primary)] ring-inset"
          )}
          onClick={() => setActiveField("checkout")}
        >
          <span className="search-bar-label">Salida</span>
          <input
            type="date"
            value={checkOut}
            min={checkIn || tomorrow}
            onChange={(e) => setCheckOut(e.target.value)}
            className="search-bar-value bg-transparent outline-none w-full"
            onFocus={() => setActiveField("checkout")}
            onBlur={() => setActiveField(null)}
          />
        </div>

        {/* Huéspedes + botón */}
        <div
          className={cn(
            "search-bar-field flex items-center justify-between gap-3 rounded-r-2xl border-r-0",
            activeField === "guests" && "bg-white ring-1 ring-[var(--color-primary)] ring-inset"
          )}
        >
          <div
            className="flex flex-col justify-center flex-1 cursor-pointer"
            onClick={() => setActiveField("guests")}
          >
            <span className="search-bar-label">Huéspedes</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHuespedes(Math.max(1, huespedes - 1));
                }}
                className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-sm leading-none hover:border-[var(--border-strong)] transition-colors"
              >
                −
              </button>
              <span className="search-bar-value min-w-[1.5ch] text-center">
                {huespedes}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setHuespedes(Math.min(16, huespedes + 1));
                }}
                className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-sm leading-none hover:border-[var(--border-strong)] transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Botón buscar */}
          <button
            onClick={handleSearch}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm"
            aria-label="Buscar"
          >
            <Search size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
