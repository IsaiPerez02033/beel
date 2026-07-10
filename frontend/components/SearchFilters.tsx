"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "casa", label: "Casa" },
  { value: "departamento", label: "Depto" },
  { value: "villa", label: "Villa" },
  { value: "cabaña", label: "Cabaña" },
];

export default function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoActual = searchParams.get("tipo");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Estados locales para los filtros del popover
  const [localMascotas, setLocalMascotas] = useState(false);
  const [localReservaInmediata, setLocalReservaInmediata] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Sincronizar estados locales cuando se abre el popover
  useEffect(() => {
    if (filtersOpen) {
      setLocalMascotas(searchParams.get("mascotas") === "true");
      setLocalReservaInmediata(searchParams.get("reserva_inmediata") === "true");
    }
  }, [filtersOpen, searchParams]);

  // Consulta dinámica en segundo plano con Debounce (250ms)
  useEffect(() => {
    if (!filtersOpen) return;
    setLoadingCount(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const query = new URLSearchParams(searchParams.toString());
        if (localMascotas) query.set("mascotas", "true"); else query.delete("mascotas");
        if (localReservaInmediata) query.set("instant_booking", "true"); else query.delete("reserva_inmediata");
        query.set("status", "active");

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/api/v1/properties/search?${query.toString()}`
        );
        if (res.ok) {
          const data = await res.json();
          setCount(data.total ?? 0);
        } else {
          setCount(null);
        }
      } catch {
        setCount(null);
      } finally {
        setLoadingCount(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [localMascotas, localReservaInmediata, filtersOpen, searchParams]);

  function setTipo(tipo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("tipo") === tipo) {
      params.delete("tipo");
    } else {
      params.set("tipo", tipo);
    }
    router.push(`/buscar?${params.toString()}`);
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    if (localMascotas) params.set("mascotas", "true"); else params.delete("mascotas");
    if (localReservaInmediata) params.set("reserva_inmediata", "true"); else params.delete("reserva_inmediata");
    router.push(`/buscar?${params.toString()}`);
    setFiltersOpen(false);
  }

  return (
    <div className="relative flex items-center gap-2 overflow-x-auto scrollbar-hide scroll-mask-fade px-3 py-1">
      {TIPOS.map((t) => (
        <button
          key={t.value}
          onClick={() => setTipo(t.value)}
          className={cn(
            "flex-shrink-0 px-3 py-1.5 rounded-full border text-body-sm font-medium transition-colors",
            tipoActual === t.value
              ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"
              : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
          )}
        >
          {t.label}
        </button>
      ))}
      <button
        onClick={() => setFiltersOpen(!filtersOpen)}
        className={cn(
          "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-body-sm font-medium transition-colors",
          filtersOpen
            ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"
            : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
        )}
      >
        <SlidersHorizontal size={13} />
        Filtros
      </button>

      {filtersOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 md:left-auto md:w-72 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-lg z-[var(--z-dropdown)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-body font-semibold text-[var(--text-primary)]">Filtros</span>
            <button
              onClick={() => setFiltersOpen(false)}
              className="p-1 rounded hover:bg-[var(--bg-subtle)]"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-body-sm text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={localMascotas}
                onChange={(e) => setLocalMascotas(e.target.checked)}
                className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              Admite mascotas
            </label>
            <label className="flex items-center gap-2 text-body-sm text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={localReservaInmediata}
                onChange={(e) => setLocalReservaInmediata(e.target.checked)}
                className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              Reserva inmediata
            </label>

            <button
              onClick={applyFilters}
              disabled={loadingCount}
              className="w-full btn btn-primary py-2 text-body-sm flex items-center justify-center gap-2 mt-2 transition-all disabled:opacity-60"
            >
              {loadingCount ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Calculando...</span>
                </>
              ) : (
                <span>
                  {count !== null ? `Ver ${count} alojamientos` : "Aplicar filtros"}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
