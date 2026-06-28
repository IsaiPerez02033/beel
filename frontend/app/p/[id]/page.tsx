import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import BookingWidget from "@/components/BookingWidget";
import AmenityList from "@/components/AmenityList";
import PropertyReviews from "@/components/PropertyReviews";
import PropertyGallery from "@/components/PropertyGallery";
import { Star, Shield, Zap, PawPrint, ChevronLeft } from "lucide-react";
import { formatRating } from "@/lib/utils";
import Price from "@/components/Price";
import type { Property } from "@/types";
import Link from "next/link";
import PropertyMap from "@/components/PropertyMap";
import ReportButton from "@/components/ReportButton";

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

  // Las fotos y la galería se gestionan en el componente cliente PropertyGallery

  const POLICY_LABELS: Record<string, string> = {
    flexible: "Flexible",
    moderate: "Moderada",
    strict: "Estricta",
    // compatibilidad con valores antiguos en español
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

        {/* Galería Interactiva */}
        <PropertyGallery photos={property.photos} title={property.title} />

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

            {/* Widget móvil inline */}
            <div className="lg:hidden my-8" id="booking-widget-mobile">
              <div className="divider" />
              <h2 className="text-h2 text-[var(--text-primary)] mb-4">Selecciona tus fechas</h2>
              <BookingWidget
                property={property}
                initialCheckIn={searchParams.check_in}
                initialCheckOut={searchParams.check_out}
                initialGuests={
                  searchParams.huespedes ? Number(searchParams.huespedes) : 1
                }
              />
            </div>

            {/* Mapa de ubicación aproximada */}
            {(property.latitude_approx || property.latitude) && (property.longitude_approx || property.longitude) && (
              <>
                <div className="divider" />
                <div>
                  <h2 className="text-h2 text-[var(--text-primary)] mb-1">Dónde está</h2>
                  <p className="text-body-sm text-[var(--text-secondary)] mb-4">
                    {property.neighborhood ? `${property.neighborhood}, ` : ""}{property.city}{property.state ? `, ${property.state}` : ""}
                  </p>
                  <PropertyMap
                    lat={Number(property.latitude_approx ?? property.latitude)}
                    lng={Number(property.longitude_approx ?? property.longitude)}
                    title={property.title}
                  />
                  <p className="text-caption text-[var(--text-tertiary)] mt-2">
                    La dirección exacta se comparte con huéspedes confirmados.
                  </p>
                </div>
              </>
            )}

            {/* Reseñas */}
            <div className="divider" />
            <PropertyReviews propertyId={property.id} />

            {/* Reportar anuncio */}
            <div className="mt-8 flex justify-center">
              <ReportButton
                targetTitle={property.title}
                targetType="property"
              />
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
                {<Price amount={property.price_per_night} />}
              </span>
              <span className="text-caption text-[var(--text-secondary)]"> / noche</span>
            </div>
            {searchParams.check_in && searchParams.check_out ? (
              <a
                href={`/p/${property.id}/reservar?check_in=${searchParams.check_in}&check_out=${searchParams.check_out}&huespedes=${searchParams.huespedes ?? 1}`}
                className="btn btn-primary px-6"
              >
                Reservar
              </a>
            ) : (
              <a
                href="#booking-widget-mobile"
                className="btn btn-primary px-6"
              >
                Elegir fechas
              </a>
            )}
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
