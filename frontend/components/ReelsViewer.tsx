"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, Volume2, VolumeX, X } from "lucide-react";
import type { Post } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Visor de reels a pantalla completa: scroll vertical con snap, autoplay del
 * video visible (muted por defecto), tap para sonido y doble tap para like.
 */
export default function ReelsViewer({
  posts,
  startIndex,
  isSignedIn,
  onClose,
  onToggleLike,
}: {
  posts: Post[];
  startIndex: number;
  isSignedIn: boolean;
  onClose: () => void;
  onToggleLike: (postId: string, liked: boolean) => void;
}) {
  const [muted, setMuted] = useState(true);
  const [heartBurstId, setHeartBurstId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const lastTapRef = useRef(0);

  // Arrancar en el reel tocado.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = startIndex * el.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reproducir solo el video visible (pausa el resto).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target.querySelector("video");
          if (!video) return;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { root: el, threshold: 0.6 }
    );
    el.querySelectorAll("[data-reel]").forEach((slide) => obs.observe(slide));
    return () => obs.disconnect();
  }, [posts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleTap(post: Post) {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Doble tap = like
      lastTapRef.current = 0;
      if (!isSignedIn) return;
      if (!post.liked) onToggleLike(post.id, true);
      setHeartBurstId(post.id);
      setTimeout(() => setHeartBurstId(null), 600);
      if (navigator.vibrate) navigator.vibrate(20);
    } else {
      lastTapRef.current = now;
      // Tap sencillo = alternar sonido (con retraso para no pisar el doble tap)
      setTimeout(() => {
        if (lastTapRef.current === now) setMuted((m) => !m);
      }, 300);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black animate-fade-in" role="dialog" aria-modal="true">
      <div
        ref={containerRef}
        className="h-dvh overflow-y-auto snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {posts.map((post) => {
          const video = post.media.find((m) => m.media_type === "video");
          if (!video) return null;
          return (
            <div
              key={post.id}
              data-reel
              className="relative h-dvh snap-start flex items-center justify-center"
              onClick={() => handleTap(post)}
            >
              <video
                ref={(el) => { videoRefs.current[post.id] = el; }}
                src={video.media_url}
                playsInline
                muted={muted}
                loop
                preload="metadata"
                className="w-full h-full object-contain sm:max-w-[440px]"
              />

              {/* Corazón del doble tap */}
              {heartBurstId === post.id && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Heart size={92} className="text-white drop-shadow-lg animate-heart-pop" fill="white" />
                </span>
              )}

              {/* Degradado inferior para legibilidad */}
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />

              {/* Info del anfitrión + caption + CTA */}
              <div className="absolute bottom-0 inset-x-0 p-4 pr-16 flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  {post.host.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.host.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-sm font-semibold">
                      {(post.host.full_name ?? "A").charAt(0)}
                    </span>
                  )}
                  <span className="text-white text-sm font-semibold">
                    {post.host.full_name ?? "Anfitrión"}
                  </span>
                </div>
                {post.caption && (
                  <p className="text-white/90 text-[13px] leading-snug line-clamp-2">{post.caption}</p>
                )}
                {post.property_id && (
                  <Link
                    href={`/p/${post.property_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="btn btn-primary rounded-full px-5 py-2 text-sm font-semibold text-white shadow-md self-start"
                  >
                    Ver propiedad
                  </Link>
                )}
              </div>

              {/* Acciones a la derecha */}
              <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSignedIn) onToggleLike(post.id, !post.liked);
                  }}
                  aria-label={post.liked ? "Quitar me gusta" : "Me gusta"}
                  className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
                >
                  <Heart
                    size={28}
                    className={cn("drop-shadow", post.liked ? "text-rose-500" : "text-white")}
                    fill={post.liked ? "currentColor" : "none"}
                  />
                  {post.like_count > 0 && (
                    <span className="text-white text-xs font-semibold drop-shadow">{post.like_count}</span>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
                  aria-label={muted ? "Activar sonido" : "Silenciar"}
                  className="text-white drop-shadow"
                >
                  {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X size={22} />
      </button>
    </div>
  );
}
