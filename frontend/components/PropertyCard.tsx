"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Star, ChevronLeft, ChevronRight, Zap, Home, Building2, Trees, Ship, Bed, Hotel, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRating } from "@/lib/utils";
import Price from "@/components/Price";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useAuth } from "@/hooks/useSafeAuth";
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
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(property.id);

  function onHeartClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      router.push(`/iniciar-sesion?callbackUrl=/p/${property.id}`);
      return;
    }
    toggleFavorite(property.id);
  }

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

  // Badge de tipo de propiedad
  const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string }> = {
    casa:         { icon: <Home size={10} />,      label: "Casa" },
    departamento: { icon: <Building2 size={10} />, label: "Depto" },
    cabaña:       { icon: <Trees size={10} />,     label: "Cabaña" },
    villa:        { icon: <Ship size={10} />,      label: "Villa" },
    habitacion:   { icon: <Bed size={10} />,       label: "Hab." },
    hostal:       { icon: <Hotel size={10} />,     label: "Hostal" },
  };
  const typeConfig = TYPE_CONFIG[property.property_type] ?? { icon: <Home size={10} />, label: property.property_type };

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
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-elevated)]"
              aria-label="Foto anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-elevated)]"
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
                      ? "bg-[var(--bg-elevated)] w-2"
                      : "bg-white/60"
                  )}
                />
              ))}
            </div>
          </>
        )}

        {/* Botón de favorito — esquina superior derecha */}
        <button
          onClick={onHeartClick}
          aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          className="absolute top-2.5 right-2.5 z-20 p-2 rounded-full transition-transform active:scale-90 hover:scale-110"
        >
          <Heart
            size={22}
            className={cn(
              "drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-colors",
              fav ? "fill-[var(--color-accent)] text-[var(--color-accent)]" : "fill-black/25 text-white"
            )}
          />
        </button>

        {/* Badges — esquina superior izquierda (apilados) */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5">
          {property.instant_booking && (
            <span className="badge badge-fast gap-1">
              <Zap size={9} className="fill-current" />
              Reserva ya
            </span>
          )}
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-md"
            style={{ background: "rgba(255,255,255,0.85)", color: "var(--color-tierra)" }}>
            {typeConfig.icon}
            {typeConfig.label}
          </span>
        </div>

        {/* Host chip — glassmorphism */}
        <div className="host-chip" style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(8px)",
          borderBottom: "2px solid var(--color-accent)",
          borderRadius: "8px",
        }}>
          {property.host.avatar_url ? (
            <Image
              src={property.host.avatar_url}
              alt={property.host.full_name}
              width={20}
              height={20}
              className="rounded-full object-cover ring-1 ring-white"
            />
          ) : (
            <div className="avatar avatar-sm" style={{ width: 20, height: 20, fontSize: 9 }}>
              {property.host.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[11px] font-semibold text-[#2C2C2A] leading-none">
            {property.host.full_name.split(" ")[0]}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 pt-2.5 flex flex-col gap-0.5">
        {/* Fila top: título + rating */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-body font-semibold text-[var(--text-primary)] line-clamp-1 flex-1">
            {property.title}
          </p>
          {property.avg_rating && (
            <div className="flex items-center gap-0.5 flex-shrink-0 bg-[var(--color-accent-light)] px-1.5 py-0.5 rounded-md">
              <Star size={10} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
              <span className="text-[11px] font-bold text-[var(--color-accent-dark)]">
                {formatRating(property.avg_rating)}
              </span>
            </div>
          )}
        </div>

        {/* Ubicación */}
        <p className="text-body-sm text-[var(--text-secondary)] line-clamp-1">
          {locationLabel}
        </p>

        {/* Capacidad */}
        <p className="text-caption text-[var(--text-tertiary)]">
          hasta {property.max_guests} huéspedes · {property.bedrooms} hab
        </p>

        {/* Precio — más visual */}
        <div className="flex items-baseline gap-1 mt-1 pt-1.5 border-t border-[var(--border-subtle)]">
          <span className="text-body font-bold text-[var(--text-primary)]">
            <Price amount={property.price_per_night} />
          </span>
          <span className="text-caption text-[var(--text-tertiary)]">/ noche</span>
          {property.total_reviews > 0 && (
            <span className="text-caption text-[var(--text-tertiary)] ml-auto">
              {property.total_reviews} reseñas
            </span>
          )}
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
