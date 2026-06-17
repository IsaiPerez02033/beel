import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import BookingWidget from "@/components/BookingWidget";
import AmenityList from "@/components/AmenityList";
import { Star, Shield, Zap, PawPrint, ChevronLeft } from "lucide-react";
import { formatPrice, formatRating } from "@/lib/utils";
import type { Property } from "@/types";
import Link from "next/link";

interface PageProps {
  params: { id: string };
  searchParams: { check_in?: string; check_out?: string; huespedes?: string };
}

async function getProperty(id: string): Promise<Property | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/properties/${id}`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const property = await getProperty(params.id);
  if (!property) return { title: "Hospedaje no encontrado" };
  return {
    title: property.title,
    description: property.description.slice(0, 160),
    openGraph: {
      title: property.title,
    description: property.description?.slice(0, 160) ?? "",
      images: property.photos[0]?.url ? [property.photos[0].url] : [],
    },
  };
}

export default async function PropertyPage({ params, searchParams }: PageProps) {
  const property = await getProperty(params.id);
  if (!property) notFound();

  const photos = property.photos.slice(0, 5);
  const mainPhoto = photos[0];
  const gridPhotos = photos.slice(1, 5);

  const POLICY_LABELS: Record<string, string> = {
    flexible: "Flexible",
    moderada: "Moderada",
    estricta: "Estricta",
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <Link
          href="/buscar"
          className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-5 transition-colors"
        >
          <ChevronLeft size={14} />
          Volver a resultados
        </Link>

        {/* Título */}
        <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-1">
          {property.title}
        </h1>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-6 text-body-sm text-[var(--text-secondary)]">
          {property.avg_rating && (
            <span className="flex items-center gap-1 font-medium text-[var(--text-primary)]">
              <Star size={13} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
              {formatRating(property.avg_rating)}
              <span className="font-normal text-[var(--text-tertiary)]">
                ({property.total_reviews} reseñas)
              </span>
            </span>
          )}
          {property.host.is_identity_verified && (
            <span className="badge badge-verified">
              <Shield size={9} />
              Anfitrión verificado
            </span>
          )}
          {property.instant_booking && (
            <span className="badge badge-fast">
              <Zap size={9} className="fill-current" />
              Reserva inmediata
            </span>
          )}
          <span>
            {property.neighborhood
              ? `${property.neighborhood}, ${property.city}`
              : property.city}
          </span>
        </div>

        {/* Galería */}
        <div className="grid grid-cols-4 grid-rows-2 gap-2 rounded-2xl overflow-hidden h-[400px] mb-8">
          {/* Foto principal */}
          <div className="col-span-2 row-span-2 relative bg-[var(--color-primary-light)]">
            {mainPhoto?.url && (
              <Image
                src={mainPhoto.url}
                alt={property.title}
                fill
                className="object-cover"
                priority
              />
            )}
          </div>

          {/* Fotos secundarias */}
          {gridPhotos.map((photo, i) => (
            <div
              key={photo.id}
              className="relative bg-[var(--color-primary-light)] col-span-1 row-span-1"
            >
              {photo.url && (
                <Image
                  src={photo.url}
                  alt={`${property.title} — foto ${i + 2}`}
                  fill
                  className="object-cover"
                />
              )}
            </div>
          ))}

          {/* Rellenos si hay menos de 4 fotos secundarias */}
          {Array.from({ length: Math.max(0, 4 - gridPhotos.length) }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              className="bg-[var(--color-primary-light)] col-span-1 row-span-1"
            />
          ))}
        </div>

        {/* Layout principal: info izq + widget der */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
          {/* ── Columna izquierda ─────────────────────────────────────── */}
          <div className="space-y-8">
            {/* Capacidad */}
            <div>
              <h2 className="text-h2 text-[var(--text-primary)] mb-1">
                {property.property_type === "habitacion"
                  ? "Habitación"
                  : property.property_type.charAt(0).toUpperCase() +
                    property.property_type.slice(1)}{" "}
                completo
              </h2>
              <p className="text-body-sm text-[var(--text-secondary)]">
                Hasta {property.max_guests} huéspedes · {property.bedrooms} habitaciones ·{" "}
                {property.beds} camas · {property.bathrooms} baños
              </p>
            </div>

            <div className="divider" />

            {/* Host */}
            <div className="flex items-center gap-3">
              {property.host.avatar_url ? (
                <Image
                  src={property.host.avatar_url}
                  alt={property.host.full_name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="avatar avatar-lg">
                  {property.host.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-body font-medium text-[var(--text-primary)]">
                  Anfitrión: {property.host.full_name}
                </p>
                <p className="text-caption text-[var(--text-tertiary)]">
                  {property.host.total_listings}{" "}
                  {property.host.total_listings === 1 ? "hospedaje" : "hospedajes"}
                  {property.host.host_since &&
                    (() => {
                      const year = new Date(property.host.host_since).getFullYear();
                      if (!isNaN(year)) return ` · Anfitrión desde ${year}`;
                      return null;
                    })()}
                </p>
              </div>
            </div>

            <div className="divider" />

            {/* Descripción */}
            <div>
              <h2 className="text-h2 text-[var(--text-primary)] mb-3">
                Sobre este lugar
              </h2>
              <p className="text-body text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {property.description}
              </p>
            </div>

            <div className="divider" />

            {/* Amenidades */}
            <div>
              <h2 className="text-h2 text-[var(--text-primary)] mb-4">
                Lo que ofrece
              </h2>
              <AmenityList amenities={property.amenities} />
            </div>

            <div className="divider" />

            {/* Políticas */}
            <div>
              <h2 className="text-h2 text-[var(--text-primary)] mb-4">
                Reglas de la propiedad
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {property.check_in_time && (
                  <PolicyItem
                    label="Check-in"
                    value={`A partir de las ${property.check_in_time}`}
                  />
                )}
                {property.check_out_time && (
                  <PolicyItem
                    label="Check-out"
                    value={`Antes de las ${property.check_out_time}`}
                  />
                )}
                <PolicyItem
                  label="Cancelación"
                  value={POLICY_LABELS[property.cancellation_policy] ?? property.cancellation_policy}
                />
                <PolicyItem
                  label="Estancia mínima"
                  value={`${property.min_stay_nights} ${property.min_stay_nights === 1 ? "noche" : "noches"}`}
                />
                {property.allows_pets !== undefined && (
                  <PolicyItem
                    label="Mascotas"
                    value={property.allows_pets ? "Permitidas" : "No permitidas"}
                  />
                )}
                {property.allows_smoking !== undefined && (
                  <PolicyItem
                    label="Fumar"
                    value={property.allows_smoking ? "Permitido" : "No permitido"}
                  />
                )}
              </div>
            </div>
          </div>

          {/* ── Widget de reserva (sticky) ─────────────────────────────── */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <BookingWidget
                property={property}
                initialCheckIn={searchParams.check_in}
                initialCheckOut={searchParams.check_out}
                initialGuests={
                  searchParams.huespedes ? Number(searchParams.huespedes) : 1
                }
              />
            </div>
          </div>
        </div>

        {/* Widget móvil (footer sticky) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] p-4 z-[var(--z-dropdown)]">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <div>
              <span className="text-h2 font-semibold text-[var(--text-primary)]">
                {formatPrice(property.price_per_night)}
              </span>
              <span className="text-caption text-[var(--text-secondary)]"> / noche</span>
            </div>
            <a
              href={`/p/${property.id}/reservar`}
              className="btn btn-primary px-6"
            >
              Reservar
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function PolicyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-[var(--text-tertiary)] uppercase tracking-wide font-medium">
        {label}
      </span>
      <span className="text-body text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
