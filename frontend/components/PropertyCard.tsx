"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRating } from "@/lib/utils";
import Price from "@/components/Price";
import type { Property } from "@/types";

interface PropertyCardProps {
  property: Property;
  /** Para destacar en mapa (cuando el pin está activo) */
  highlighted?: boolean;
}

export default function PropertyCard({
  property,
  highlighted = false,
}: PropertyCardProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  const photos = property.photos;
  const hasMultiplePhotos = photos.length > 1;

  function prevPhoto(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  }

  function nextPhoto(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1));
  }

  const currentPhoto = photos[photoIndex];
  const photoUrl = currentPhoto?.url ?? "";

  const locationLabel = [property.neighborhood, property.city]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/p/${property.id}`}
      className={cn(
        "card group block",
        highlighted && "ring-2 ring-[var(--color-primary)]"
      )}
    >
      {/* Foto */}
      <div className="card-photo">
        {photoUrl && !imgError ? (
          <Image
            src={photoUrl}
            alt={property.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-[var(--color-primary-light)] flex items-center justify-center">
            <span className="text-[var(--color-primary)] text-4xl opacity-30">🏠</span>
          </div>
        )}

        {/* Navegación fotos */}
        {hasMultiplePhotos && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              aria-label="Foto anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              aria-label="Foto siguiente"
            >
              <ChevronRight size={14} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {photos.slice(0, 5).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-1 h-1 rounded-full transition-all",
                    i === photoIndex
                      ? "bg-white w-2"
                      : "bg-white/60"
                  )}
                />
              ))}
            </div>
          </>
        )}

        {/* Guardar (próximamente) */}
        {/* Botón oculto hasta implementar favoritos en backend */}

        {/* Badge reserva inmediata */}
        {property.instant_booking && (
          <div className="absolute top-3 left-3">
            <span className="badge badge-fast gap-1">
              <Zap size={9} className="fill-current" />
              Reserva ya
            </span>
          </div>
        )}

        {/* Host chip */}
        <div className="host-chip">
          {property.host.avatar_url ? (
            <Image
              src={property.host.avatar_url}
              alt={property.host.full_name}
              width={20}
              height={20}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="avatar avatar-sm" style={{ width: 20, height: 20, fontSize: 9 }}>
              {property.host.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[11px] font-medium text-[var(--text-primary)] leading-none">
            {property.host.full_name.split(" ")[0]}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        {/* Fila top: ubicación + rating */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-body font-medium text-[var(--text-primary)] line-clamp-1 flex-1">
            {property.title}
          </p>
          {property.avg_rating && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star size={12} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
              <span className="text-caption font-medium text-[var(--text-primary)]">
                {formatRating(property.avg_rating)}
              </span>
              {property.total_reviews > 0 && (
                <span className="text-caption text-[var(--text-tertiary)]">
                  ({property.total_reviews})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Ubicación */}
        <p className="text-body-sm text-[var(--text-secondary)] line-clamp-1">
          {locationLabel}
        </p>

        {/* Capacidad */}
        <p className="text-caption text-[var(--text-tertiary)]">
          {property.bedrooms} hab · {property.beds} camas · {property.bathrooms} baños
        </p>

        {/* Precio */}
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-body font-semibold text-[var(--text-primary)]">
            {<Price amount={property.price_per_night} />}
          </span>
          <span className="text-caption text-[var(--text-secondary)]">noche</span>
        </div>
      </div>
    </Link>
  );
}

/** Skeleton mientras carga */
export function PropertyCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="card-photo skeleton" />
      <div className="p-3 flex flex-col gap-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/3 rounded mt-1" />
      </div>
    </div>
  );
}
