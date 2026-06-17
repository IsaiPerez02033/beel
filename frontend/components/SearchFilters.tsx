"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
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

  function setTipo(tipo: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("tipo") === tipo) {
      params.delete("tipo");
    } else {
      params.set("tipo", tipo);
    }
    router.push(`/buscar?${params.toString()}`);
  }

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/buscar?${params.toString()}`);
  }

  return (
    <div className="relative flex items-center gap-2 overflow-x-auto scrollbar-hide">
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
        <div className="absolute top-full mt-2 left-0 right-0 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-lg z-[var(--z-dropdown)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-body font-semibold text-[var(--text-primary)]">Filtros</span>
            <button
              onClick={() => setFiltersOpen(false)}
              className="p-1 rounded hover:bg-[var(--bg-subtle)]"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-body-sm text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={searchParams.get("mascotas") === "true"}
                onChange={(e) => updateFilter("mascotas", e.target.checked ? "true" : "")}
                className="rounded"
              />
              Admite mascotas
            </label>
            <label className="flex items-center gap-2 text-body-sm text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={searchParams.get("reserva_inmediata") === "true"}
                onChange={(e) => updateFilter("reserva_inmediata", e.target.checked ? "true" : "")}
                className="rounded"
              />
              Reserva inmediata
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
