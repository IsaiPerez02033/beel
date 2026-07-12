"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Eye, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

export interface StoryItem {
  id: string;
  host_id: string;
  property_id?: string | null;
  media_url: string;
  media_type: string;
  caption?: string | null;
  created_at: string;
  expires_at: string;
  seen: boolean;
  view_count?: number | null;
}

export interface StoryGroup {
  host: { id: string; full_name?: string | null; avatar_url?: string | null };
  stories: StoryItem[];
  all_seen: boolean;
}

const DURATION_MS = 5000;

function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `hace ${hours} h`;
}

/** Visor de historias a pantalla completa: barras de progreso, auto-avance,
 *  tap izquierda/derecha, cierre con ✕/Escape/deslizar hacia abajo. */
export default function StoryViewer({
  groups,
  initialGroup,
  myId,
  onClose,
  onSeen,
  onDeleted,
}: {
  groups: StoryGroup[];
  initialGroup: number;
  myId: string | null;
  onClose: () => void;
  onSeen: (storyId: string) => void;
  onDeleted: () => void;
}) {
  const { isSignedIn } = useAuth();
  const { post, del } = useApi();

  const [gIdx, setGIdx] = useState(initialGroup);
  const [sIdx, setSIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 de la historia actual
  const [paused, setPaused] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const touchY = useRef(0);
  const seenSentRef = useRef<Set<string>>(new Set());

  const group = groups[gIdx];
  const story = group?.stories[sIdx];
  const isMine = story?.host_id === myId;

  const goNext = useCallback(() => {
    if (!group) return;
    if (sIdx < group.stories.length - 1) {
      setSIdx((i) => i + 1);
    } else if (gIdx < groups.length - 1) {
      setGIdx((i) => i + 1);
      setSIdx(0);
    } else {
      onClose();
    }
  }, [group, sIdx, gIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (sIdx > 0) {
      setSIdx((i) => i - 1);
    } else if (gIdx > 0) {
      const prevGroup = groups[gIdx - 1];
      setGIdx((i) => i - 1);
      setSIdx(prevGroup.stories.length - 1);
    }
  }, [sIdx, gIdx, groups]);

  // Temporizador de auto-avance (rAF para poder pausar con precisión).
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = performance.now();

    const tick = (now: number) => {
      if (!paused) {
        const elapsed = elapsedRef.current + (now - startRef.current);
        const p = elapsed / DURATION_MS;
        if (p >= 1) {
          goNext();
          return;
        }
        setProgress(p);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, paused]);

  // Pausar acumulando el tiempo transcurrido.
  useEffect(() => {
    if (paused) {
      elapsedRef.current += performance.now() - startRef.current;
    } else {
      startRef.current = performance.now();
    }
  }, [paused]);

  // Marcar vista (best-effort, una vez por historia).
  useEffect(() => {
    if (!story || !isSignedIn || seenSentRef.current.has(story.id)) return;
    seenSentRef.current.add(story.id);
    onSeen(story.id);
    post(`/stories/${story.id}/view`, {}).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.id, isSignedIn]);

  // Teclado: flechas y Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  async function handleDelete() {
    if (!story || deleting) return;
    setDeleting(true);
    try {
      await del(`/stories/${story.id}`);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  if (!group || !story) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => { touchY.current = e.touches[0].clientY; setPaused(true); }}
      onTouchEnd={(e) => {
        setPaused(false);
        const dy = e.changedTouches[0].clientY - touchY.current;
        if (dy > 80) onClose();
      }}
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
    >
      <div className="relative w-full h-full sm:w-[420px] sm:h-[92vh] sm:rounded-2xl overflow-hidden bg-neutral-900">
        {/* Imagen */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={story.media_url}
          alt={story.caption ?? "Historia"}
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Degradados para legibilidad */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {/* Barras de progreso */}
        <div className="absolute top-2.5 inset-x-2.5 flex gap-1">
          {group.stories.map((s, i) => (
            <span key={s.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
              <span
                className="block h-full bg-white rounded-full"
                style={{ width: i < sIdx ? "100%" : i === sIdx ? `${progress * 100}%` : "0%" }}
              />
            </span>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 inset-x-3 flex items-center gap-2.5">
          {group.host.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.host.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center font-semibold">
              {(group.host.full_name ?? "A").charAt(0)}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">
              {isMine ? "Tu historia" : group.host.full_name ?? "Anfitrión"}
            </p>
            <p className="text-white/70 text-[11px]">{timeAgo(story.created_at)}</p>
          </div>
          {isMine && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              disabled={deleting}
              aria-label="Eliminar historia"
              className="p-2 rounded-full text-white/80 hover:bg-white/10 disabled:opacity-50"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Cerrar"
            className="p-2 rounded-full text-white hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Zonas de tap para navegar */}
        <button
          aria-label="Anterior"
          onClick={goPrev}
          className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
        />
        <button
          aria-label="Siguiente"
          onClick={goNext}
          className="absolute inset-y-0 right-0 w-1/3 cursor-pointer"
        />

        {/* Flechas visibles en desktop */}
        {(sIdx > 0 || gIdx > 0) && (
          <span className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60">
            <ChevronLeft size={28} />
          </span>
        )}
        {(sIdx < group.stories.length - 1 || gIdx < groups.length - 1) && (
          <span className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60">
            <ChevronRight size={28} />
          </span>
        )}

        {/* Footer: caption + vistas + CTA */}
        <div className="absolute bottom-0 inset-x-0 p-4 flex flex-col gap-3">
          {story.caption && (
            <p className="text-white text-sm leading-snug drop-shadow">{story.caption}</p>
          )}
          <div className="flex items-center justify-between gap-3">
            {isMine && typeof story.view_count === "number" ? (
              <span className="flex items-center gap-1.5 text-white/85 text-xs font-medium">
                <Eye size={14} /> {story.view_count} {story.view_count === 1 ? "vista" : "vistas"}
              </span>
            ) : <span />}
            {story.property_id && (
              <Link
                href={`/p/${story.property_id}`}
                onClick={(e) => e.stopPropagation()}
                className="btn btn-primary rounded-full px-5 py-2 text-sm font-semibold text-white shadow-md"
              >
                Ver propiedad
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
