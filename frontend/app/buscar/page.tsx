import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import PropertyCard, { PropertyCardSkeleton } from "@/components/PropertyCard";
import SearchFilters from "@/components/SearchFilters";
import type { Property, SearchParams } from "@/types";

export const metadata: Metadata = {
  title: "Explorar hospedajes",
};

interface PageProps {
  searchParams: {
    destino?: string;
    check_in?: string;
    check_out?: string;
    huespedes?: string;
    tipo?: string;
    precio_min?: string;
    precio_max?: string;
    mascotas?: string;
    reserva_inmediata?: string;
  };
}

async function getProperties(params: SearchParams): Promise<{ properties: Property[]; total: number }> {
  const query = new URLSearchParams();
  if (params.destino) query.set("destino", params.destino);
  if (params.check_in) query.set("check_in", params.check_in);
  if (params.check_out) query.set("check_out", params.check_out);
  if (params.huespedes) query.set("huespedes", String(params.huespedes));
  if (params.tipo) query.set("tipo", params.tipo);
  if (params.precio_min) query.set("precio_min", String(params.precio_min));
  if (params.precio_max) query.set("precio_max", String(params.precio_max));
  if (params.mascotas) query.set("mascotas", "true");
  if (params.reserva_inmediata) query.set("instant_booking", "true");

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/properties/search?${query}&status=active`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return { properties: [], total: 0 };
    return await res.json();
  } catch {
    return { properties: [], total: 0 };
  }
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const params: SearchParams = {
    destino: searchParams.destino,
    check_in: searchParams.check_in,
    check_out: searchParams.check_out,
    huespedes: searchParams.huespedes ? Number(searchParams.huespedes) : undefined,
    tipo: searchParams.tipo as any,
    precio_min: searchParams.precio_min ? Number(searchParams.precio_min) : undefined,
    precio_max: searchParams.precio_max ? Number(searchParams.precio_max) : undefined,
    mascotas: searchParams.mascotas === "true",
    reserva_inmediata: searchParams.reserva_inmediata === "true",
  };

  const { properties, total } = await getProperties(params);

  const titulo = params.destino
    ? `Hospedajes en ${params.destino}`
    : "Todos los hospedajes";

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      {/* Search bar compacta */}
      <div className="sticky top-16 z-[var(--z-raised)] bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <SearchBar
            compact
            initialValues={{
              destino: params.destino,
              checkIn: params.check_in,
              checkOut: params.check_out,
              huespedes: params.huespedes,
            }}
          />
          <Suspense>
            <SearchFilters />
          </Suspense>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Título resultados */}
        <div className="mb-5">
          <h1 className="text-h1 text-[var(--text-primary)]">{titulo}</h1>
          {total > 0 && (
            <p className="text-body-sm text-[var(--text-secondary)] mt-1">
              {total} {total === 1 ? "hospedaje disponible" : "hospedajes disponibles"}
            </p>
          )}
        </div>

        {/* Grid */}
        {properties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="empty-state py-24">
            <div className="text-5xl">🔍</div>
            <h2 className="text-h1 text-[var(--text-primary)]">Sin resultados</h2>
            <p className="text-body text-[var(--text-secondary)] max-w-sm text-center">
              Intenta cambiar las fechas, destino o quita algunos filtros.
            </p>
            <a href="/buscar" className="btn btn-outline mt-2">
              Limpiar filtros
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
