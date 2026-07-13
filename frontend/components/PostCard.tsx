"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Heart, MoreHorizontal, Trash2 } from "lucide-react";
import type { Post } from "@/types";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** Tarjeta de publicación estilo Instagram: header, carrusel, like y caption. */
export default function PostCard({
  post,
  isSignedIn,
  isOwn,
  onToggleLike,
  onDelete,
}: {
  post: Post;
  isSignedIn: boolean;
  isOwn: boolean;
  onToggleLike: (postId: string, liked: boolean) => void;
  onDelete?: (postId: string) => void;
}) {
  const [slide, setSlide] = useState(0);
  const [heartBurst, setHeartBurst] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastTapRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const media = post.media ?? [];

  function handleDoubleTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (!isSignedIn) return;
      if (!post.liked) onToggleLike(post.id, true);
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 600);
      if (navigator.vibrate) navigator.vibrate(20);
    } else {
      lastTapRef.current = now;
    }
  }

  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <article className="bg-[var(--bg-elevated)] sm:border sm:border-[var(--border-subtle)] sm:rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {post.host.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.host.avatar_url}
            alt=""
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center text-sm font-semibold">
            {(post.host.full_name ?? "A").charAt(0)}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate leading-tight">
            {post.host.full_name ?? "Anfitrión"}
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)] leading-tight">
            {timeAgo(post.created_at)}
          </p>
        </div>
        {isOwn && onDelete && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Opciones"
              className="p-1.5 rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)]"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <button
                onClick={() => { setMenuOpen(false); onDelete(post.id); }}
                className="absolute right-0 top-9 z-10 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-lg text-body-sm text-red-500 font-medium whitespace-nowrap"
              >
                <Trash2 size={15} /> Eliminar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Carrusel */}
      <div className="relative" onClick={handleDoubleTap}>
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={m.media_url}
              alt={post.caption ?? "Publicación"}
              loading="lazy"
              draggable={false}
              className="w-full flex-shrink-0 snap-start object-cover aspect-square select-none bg-[var(--bg-subtle)]"
            />
          ))}
        </div>

        {/* Corazón del doble tap */}
        {heartBurst && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart size={84} className="text-white drop-shadow-lg animate-heart-pop" fill="white" />
          </span>
        )}

        {/* Dots del carrusel */}
        {media.length > 1 && (
          <span className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
            {media.map((m, i) => (
              <span
                key={m.id}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === slide ? "bg-white" : "bg-white/45"
                )}
              />
            ))}
          </span>
        )}
      </div>

      {/* Acciones */}
      <div className="px-3 pt-2.5 pb-3 space-y-1.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => isSignedIn && onToggleLike(post.id, !post.liked)}
            aria-label={post.liked ? "Quitar me gusta" : "Me gusta"}
            className="active:scale-90 transition-transform"
          >
            <Heart
              size={24}
              className={post.liked ? "text-rose-500" : "text-[var(--text-primary)]"}
              fill={post.liked ? "currentColor" : "none"}
            />
          </button>
          {post.property_id && (
            <Link
              href={`/p/${post.property_id}`}
              className="ml-auto text-[13px] font-semibold text-[var(--color-primary)]"
            >
              Ver propiedad
            </Link>
          )}
        </div>

        {post.like_count > 0 && (
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">
            {post.like_count} {post.like_count === 1 ? "me gusta" : "me gusta"}
          </p>
        )}

        {post.caption && (
          <p className="text-[13px] text-[var(--text-primary)] leading-snug">
            <span className="font-semibold mr-1.5">{post.host.full_name ?? "Anfitrión"}</span>
            {post.caption}
          </p>
        )}
      </div>
    </article>
  );
}
