"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Star, Clock, Users, Utensils, Mountain, Landmark, Palette,
  Trees, Dumbbell, Heart, Moon, MapPin, Sparkles,
} from "lucide-react";
import { cn, formatRating } from "@/lib/utils";
import Price from "@/components/Price";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useAuth } from "@/hooks/useSafeAuth";
import type { Experience, ExperienceCategory } from "@/types";

const CATEGORY: Record<ExperienceCategory, { label: string; icon: React.ReactNode }> = {
  gastronomia:   { label: "Gastronomía",   icon: <Utensils size={11} /> },
  aventura:      { label: "Aventura",      icon: <Mountain size={11} /> },
  cultura:       { label: "Cultura",       icon: <Landmark size={11} /> },
  arte:          { label: "Arte",          icon: <Palette size={11} /> },
  naturaleza:    { label: "Naturaleza",    icon: <Trees size={11} /> },
  deporte:       { label: "Deporte",       icon: <Dumbbell size={11} /> },
  bienestar:     { label: "Bienestar",     icon: <Heart size={11} /> },
  vida_nocturna: { label: "Vida nocturna", icon: <Moon size={11} /> },
  tour:          { label: "Tour",          icon: <MapPin size={11} /> },
  otro:          { label: "Experiencia",   icon: <Sparkles size={11} /> },
};

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

interface ExperienceCardProps {
  experience: Experience;
  priority?: boolean;
}

export default function ExperienceCard({ experience, priority = false }: ExperienceCardProps) {
  const [imgError, setImgError] = useState(false);
  const router = useRouter();
  const cardRef = useRef<HTMLAnchorElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  };

  const handleNavigation = (e: React.MouseEvent) => {
    if ((document as any).startViewTransition) {
      e.preventDefault();
      (document as any).startViewTransition(() => {
        router.push(`/experiencias/${experience.id}`);
      });
    }
  };
  const { isSignedIn } = useAuth();
  const { isExperienceFavorite, toggleExperienceFavorite } = useFavorites();
  const photo = experience.photos?.[0]?.url;
  const cat = CATEGORY[experience.category] ?? CATEGORY.otro;
  const fav = isExperienceFavorite(experience.id);

  function onHeartClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      router.push(`/iniciar-sesion?callbackUrl=/experiencias/${experience.id}`);
      return;
    }
    toggleExperienceFavorite(experience.id);
  }

  return (
    <Link
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onClick={handleNavigation}
      href={`/experiencias/${experience.id}`}
      className="card group block glow-card"
    >
      <div className="card-photo">
        {photo && !imgError ? (
          <Image
            src={photo}
            alt={experience.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-[800ms] ease-out group-hover:scale-[1.06] view-transition-img"
            style={{ viewTransitionName: `exp-img-${experience.id}` } as React.CSSProperties}
            priority={priority}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-[var(--color-primary-light)] flex items-center justify-center">
            <span className="text-[var(--color-primary)] text-4xl opacity-30">✨</span>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-md"
            style={{ background: "rgba(255,255,255,0.85)", color: "var(--color-tierra)" }}>
            {cat.icon}
            {cat.label}
          </span>
        </div>
        <button
          onClick={onHeartClick}
          aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
          className="absolute top-2.5 right-2.5 z-20 p-2 rounded-full transition-transform active:scale-90 hover:scale-110"
        >
          <Heart
            size={22}
            className={cn(
              "drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-colors",
              fav ? "fill-[var(--color-accent)] text-[var(--color-accent)] animate-heart-pop" : "fill-black/25 text-white"
            )}
          />
        </button>
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-body-sm font-semibold text-[var(--text-primary)] leading-tight line-clamp-2">
            {experience.title}
          </h3>
          {experience.avg_rating != null && (
            <span className="flex items-center gap-0.5 flex-shrink-0 text-caption text-[var(--text-secondary)]">
              <Star size={12} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
              {formatRating(experience.avg_rating)}
            </span>
          )}
        </div>
        <p className="text-caption text-[var(--text-tertiary)] mt-0.5">{experience.city}</p>
        <div className="flex items-center gap-3 mt-1.5 text-caption text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(experience.duration_minutes)}</span>
          <span className="flex items-center gap-1"><Users size={12} /> hasta {experience.max_participants}</span>
        </div>
        <p className="text-body-sm text-[var(--text-primary)] mt-2">
          <span className="font-semibold"><Price amount={experience.price_per_person} /></span>
          <span className="text-[var(--text-tertiary)]"> / persona</span>
        </p>
      </div>
    </Link>
  );
}
