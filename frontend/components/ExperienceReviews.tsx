"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import { Star, ChevronDown, MessageSquare, Loader2, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ExperienceBooking } from "@/types";

interface ExpReview {
  id: string;
  experience_id: string;
  reviewer_id: string;
  rating: number;
  comment?: string;
  response_text?: string;
  response_at?: string;
  reviewer?: { id: string; full_name: string; avatar_url?: string };
  created_at: string;
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={size}
          className={s <= rating ? "text-[var(--color-accent)]" : "text-[var(--border-strong)]"}
          fill={s <= rating ? "currentColor" : "none"} />
      ))}
    </div>
  );
}

export default function ExperienceReviews({ experienceId }: { experienceId: string }) {
  const { isSignedIn } = useAuth();
  const { get, post } = useApi();

  const [reviews, setReviews] = useState<ExpReview[]>([]);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [eligibleBooking, setEligibleBooking] = useState<ExperienceBooking | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  const PER_PAGE = 5;

  const fetchReviews = useCallback(async (p: number, reset = false) => {
    setLoading(true);
    try {
      const data = await get<{ reviews: ExpReview[]; total: number; avg_rating: number | null }>(
        `/experience-reviews/experience/${experienceId}?page=${p}&per_page=${PER_PAGE}`
      );
      setReviews((prev) => (reset ? data.reviews : [...prev, ...data.reviews]));
      setTotal(data.total);
      setAvgRating(data.avg_rating);
      setHasMore(p * PER_PAGE < data.total);
      setPage(p);
    } catch { /* demo sin reviews */ } finally { setLoading(false); }
  }, [experienceId, get]);

  useEffect(() => { fetchReviews(1, true); }, [fetchReviews]);

  useEffect(() => {
    if (!isSignedIn) return;
    const today = new Date().toISOString().slice(0, 10);
    get<{ bookings: ExperienceBooking[] }>("/experiences/bookings/mine?per_page=50")
      .then((d) => {
        const elig = d.bookings?.find(
          (b) => b.experience_id === experienceId
            && (b.status === "confirmed" || b.status === "completed")
            && b.booking_date < today
            && !b.guest_reviewed_at
        );
        setEligibleBooking(elig ?? null);
      })
      .catch(() => {});
  }, [isSignedIn, experienceId, get]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!eligibleBooking || rating === 0) { setFormError("Selecciona una calificación"); return; }
    setSubmitting(true); setFormError("");
    try {
      const nr = await post<ExpReview>("/experience-reviews", {
        booking_id: eligibleBooking.id, rating, comment: comment.trim() || null,
      });
      setReviews((prev) => [nr, ...prev]);
      setTotal((t) => t + 1);
      setSubmitted(true); setShowForm(false); setEligibleBooking(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al enviar la reseña");
    } finally { setSubmitting(false); }
  }

  if (loading && reviews.length === 0) {
    return <div className="skeleton h-24 w-full rounded-xl" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-h2 text-[var(--text-primary)]">Reseñas</h2>
          {avgRating && (
            <div className="flex items-center gap-1.5">
              <Stars rating={Math.round(avgRating)} size={16} />
              <span className="text-body font-semibold text-[var(--text-primary)]">{avgRating.toFixed(1)}</span>
              <span className="text-body-sm text-[var(--text-secondary)]">({total})</span>
            </div>
          )}
        </div>
        {isSignedIn && eligibleBooking && !submitted && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-outline flex items-center gap-2 text-body-sm">
            <Star size={14} /> Escribir reseña
          </button>
        )}
      </div>

      {showForm && eligibleBooking && (
        <div className="card p-5 mb-6 border-2 border-[var(--color-primary-light)]">
          <h3 className="text-h3 font-semibold text-[var(--text-primary)] mb-4">Tu reseña</h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(s)} className="transition-transform hover:scale-110">
                  <Star size={26} className={(hover || rating) >= s ? "text-[var(--color-accent)]" : "text-[var(--border-strong)]"}
                    fill={(hover || rating) >= s ? "currentColor" : "none"} />
                </button>
              ))}
            </div>
            <textarea className="input w-full resize-none" rows={4} maxLength={2000}
              placeholder="¿Cómo estuvo la experiencia?" value={comment} onChange={(e) => setComment(e.target.value)}
              style={{ fontSize: "16px" }} />
            {formError && <p className="text-caption text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline flex-1">Cancelar</button>
              <button type="submit" disabled={submitting || rating === 0} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <><Check size={15} /> Publicar</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {submitted && (
        <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary)] rounded-xl p-4 mb-6 flex items-center gap-3">
          <Check size={16} className="text-[var(--color-primary)]" />
          <p className="text-body-sm font-medium text-[var(--color-primary)]">¡Gracias! Tu reseña fue publicada.</p>
        </div>
      )}

      {reviews.length === 0 && !loading ? (
        <div className="text-center py-8">
          <MessageSquare size={32} className="text-[var(--border-strong)] mx-auto mb-3" />
          <p className="text-body text-[var(--text-secondary)]">Sin reseñas aún</p>
          <p className="text-body-sm text-[var(--text-tertiary)]">Sé el primero en reseñar tras vivir la experiencia.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          {hasMore && (
            <button onClick={() => fetchReviews(page + 1)} disabled={loading}
              className="btn btn-outline w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <><ChevronDown size={15} /> Ver más ({total - reviews.length})</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: ExpReview }) {
  const initial = review.reviewer?.full_name?.charAt(0).toUpperCase() ?? "?";
  const date = format(parseISO(review.created_at), "MMMM yyyy", { locale: es });
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        {review.reviewer?.avatar_url ? (
          <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
            <Image src={review.reviewer.avatar_url} alt={review.reviewer.full_name} fill className="object-cover" />
          </div>
        ) : (
          <div className="avatar avatar-sm flex-shrink-0">{initial}</div>
        )}
        <div>
          <p className="text-body-sm font-medium text-[var(--text-primary)]">{review.reviewer?.full_name ?? "Huésped"}</p>
          <p className="text-caption text-[var(--text-tertiary)] capitalize">{date}</p>
        </div>
        <div className="ml-auto"><Stars rating={review.rating} size={13} /></div>
      </div>
      {review.comment && <p className="text-body-sm text-[var(--text-primary)] leading-relaxed">{review.comment}</p>}
      {review.response_text && (
        <div className="mt-3 pl-4 border-l-2 border-[var(--border-subtle)]">
          <p className="text-caption font-medium text-[var(--text-secondary)] mb-1">Respuesta del anfitrión</p>
          <p className="text-body-sm text-[var(--text-secondary)] leading-relaxed">{review.response_text}</p>
        </div>
      )}
      <div className="divider mt-5" />
    </div>
  );
}
