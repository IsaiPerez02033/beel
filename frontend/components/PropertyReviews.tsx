"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Star, ChevronDown, MessageSquare, Loader2, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Reviewer {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface Review {
  id: string;
  reservation_id: string;
  reviewer_id: string;
  review_type: string;
  overall_rating: number;
  cleanliness_rating?: number;
  communication_rating?: number;
  location_rating?: number;
  value_rating?: number;
  comment?: string;
  response_text?: string;
  response_at?: string;
  reviewer?: Reviewer;
  created_at: string;
}

interface CompletedReservation {
  id: string;
  reservation_property: { id: string; title: string };
  check_out: string;
  status: string;
}

const SUB_RATINGS = [
  { key: "cleanliness_rating", label: "Limpieza" },
  { key: "communication_rating", label: "Comunicación" },
  { key: "location_rating", label: "Ubicación" },
  { key: "value_rating", label: "Valor" },
] as const;

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? "text-[var(--color-accent)]" : "text-[var(--border-strong)]"}
          fill={s <= rating ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

function InteractiveStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={24}
            className={(hover || value) >= s ? "text-[var(--color-accent)]" : "text-[var(--border-strong)]"}
            fill={(hover || value) >= s ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

export default function PropertyReviews({ propertyId }: { propertyId: string }) {
  const { isSignedIn } = useAuth();
  const { get, post } = useApi();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Reservas completadas elegibles para reseña
  const [eligibleReservation, setEligibleReservation] = useState<CompletedReservation | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [rating, setRating] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [location, setLocation] = useState(0);
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  const PER_PAGE = 5;

  useEffect(() => {
    fetchReviews(1, true);
  }, [propertyId]);

  useEffect(() => {
    if (!isSignedIn) return;
    // Buscar si el usuario tiene una reserva completada para esta propiedad
    get<{ reservations: CompletedReservation[] }>("/reservations/my-trips")
      .then((d) => {
        const eligible = d.reservations?.find(
          (r) => r.reservation_property?.id === propertyId && r.status === "completed"
        );
        setEligibleReservation(eligible ?? null);
      })
      .catch(() => {});
  }, [isSignedIn, propertyId]);

  async function fetchReviews(p: number, reset = false) {
    setLoading(true);
    try {
      const data = await get<{ reviews: Review[]; total: number; avg_rating: number | null }>(
        `/reviews/property/${propertyId}?page=${p}&per_page=${PER_PAGE}`
      );
      setReviews((prev) => reset ? data.reviews : [...prev, ...data.reviews]);
      setTotal(data.total);
      setAvgRating(data.avg_rating);
      setHasMore(p * PER_PAGE < data.total);
      setPage(p);
    } catch {
      // Silencioso — puede ser modo demo sin reviews
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!eligibleReservation || rating === 0) {
      setFormError("Selecciona al menos una calificación general");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const newReview = await post<Review>("/reviews", {
        reservation_id: eligibleReservation.id,
        rating,
        comment: comment.trim() || null,
        cleanliness: cleanliness || null,
        communication: communication || null,
        location: location || null,
        value: value || null,
      });
      setReviews((prev) => [newReview, ...prev]);
      setTotal((t) => t + 1);
      setSubmitted(true);
      setShowForm(false);
      setEligibleReservation(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al enviar la reseña");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && reviews.length === 0) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-6 w-32 rounded" />
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="flex items-center gap-3">
              <div className="skeleton w-9 h-9 rounded-full" />
              <div className="skeleton h-4 w-28 rounded" />
            </div>
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-h2 text-[var(--text-primary)]">Reseñas</h2>
          {avgRating && (
            <div className="flex items-center gap-1.5">
              <Stars rating={Math.round(avgRating)} size={16} />
              <span className="text-body font-semibold text-[var(--text-primary)]">
                {avgRating.toFixed(1)}
              </span>
              <span className="text-body-sm text-[var(--text-secondary)]">
                ({total} {total === 1 ? "reseña" : "reseñas"})
              </span>
            </div>
          )}
        </div>

        {/* Botón escribir reseña */}
        {isSignedIn && eligibleReservation && !submitted && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-outline flex items-center gap-2 text-body-sm"
          >
            <Star size={14} />
            Escribir reseña
          </button>
        )}
      </div>

      {/* Formulario de reseña */}
      {showForm && eligibleReservation && (
        <div className="card p-5 mb-6 border-2 border-[var(--color-primary-light)]">
          <h3 className="text-h3 font-semibold text-[var(--text-primary)] mb-4">
            Tu reseña
          </h3>
          <form onSubmit={handleSubmitReview} className="space-y-5">
            {/* Rating general */}
            <div>
              <p className="text-body-sm font-medium text-[var(--text-primary)] mb-2">
                Calificación general <span className="text-red-500">*</span>
              </p>
              <InteractiveStars value={rating} onChange={setRating} />
              {rating > 0 && (
                <p className="text-caption text-[var(--text-secondary)] mt-1">
                  {["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"][rating]}
                </p>
              )}
            </div>

            {/* Sub-ratings */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Limpieza", val: cleanliness, set: setCleanliness },
                { label: "Comunicación", val: communication, set: setCommunication },
                { label: "Ubicación", val: location, set: setLocation },
                { label: "Valor", val: value, set: setValue },
              ].map(({ label, val, set: setVal }) => (
                <div key={label}>
                  <p className="text-caption font-medium text-[var(--text-secondary)] mb-1.5">{label}</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setVal(s)}
                        className="p-0.5"
                      >
                        <Star
                          size={16}
                          className={val >= s ? "text-[var(--color-accent)]" : "text-[var(--border-strong)]"}
                          fill={val >= s ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Comentario */}
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                Cuéntanos tu experiencia
              </label>
              <textarea
                className="input w-full resize-none"
                rows={4}
                placeholder="¿Qué fue lo que más te gustó? ¿Algo que mejorar?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
              />
              <p className="text-caption text-[var(--text-tertiary)] mt-1 text-right">
                {comment.length}/2000
              </p>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm">
                {formError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || rating === 0}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={15} className="animate-spin" /> Enviando…</>
                ) : (
                  <><Check size={15} /> Publicar reseña</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {submitted && (
        <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary)] rounded-xl p-4 mb-6 flex items-center gap-3">
          <Check size={16} className="text-[var(--color-primary)]" />
          <p className="text-body-sm font-medium text-[var(--color-primary)]">
            ¡Gracias! Tu reseña fue publicada.
          </p>
        </div>
      )}

      {/* Lista de reviews */}
      {reviews.length === 0 && !loading ? (
        <div className="text-center py-8">
          <MessageSquare size={32} className="text-[var(--border-strong)] mx-auto mb-3" />
          <p className="text-body text-[var(--text-secondary)]">Sin reseñas aún</p>
          <p className="text-body-sm text-[var(--text-tertiary)]">
            Sé el primero en dejar una reseña después de tu estadía
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}

          {hasMore && (
            <button
              onClick={() => fetchReviews(page + 1)}
              disabled={loading}
              className="btn btn-outline w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <><ChevronDown size={15} /> Ver más reseñas ({total - reviews.length} restantes)</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const initial = review.reviewer?.full_name?.charAt(0).toUpperCase() ?? "?";
  const date = format(parseISO(review.created_at), "MMMM yyyy", { locale: es });

  return (
    <div>
      {/* Reviewer */}
      <div className="flex items-center gap-3 mb-3">
        {review.reviewer?.avatar_url ? (
          <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
            <Image src={review.reviewer.avatar_url} alt={review.reviewer.full_name} fill className="object-cover" />
          </div>
        ) : (
          <div className="avatar avatar-sm flex-shrink-0">{initial}</div>
        )}
        <div>
          <p className="text-body-sm font-medium text-[var(--text-primary)]">
            {review.reviewer?.full_name ?? "Huésped"}
          </p>
          <p className="text-caption text-[var(--text-tertiary)] capitalize">{date}</p>
        </div>
        <div className="ml-auto">
          <Stars rating={review.overall_rating} size={13} />
        </div>
      </div>

      {/* Sub-ratings */}
      {(review.cleanliness_rating || review.communication_rating || review.location_rating || review.value_rating) && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3">
          {SUB_RATINGS.map(({ key, label }) => {
            const val = review[key];
            if (!val) return null;
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-caption text-[var(--text-secondary)]">{label}</span>
                <Stars rating={val} size={11} />
              </div>
            );
          })}
        </div>
      )}

      {/* Comentario */}
      {review.comment && (
        <p className="text-body-sm text-[var(--text-primary)] leading-relaxed">
          {review.comment}
        </p>
      )}

      {/* Respuesta del anfitrión */}
      {review.response_text && (
        <div className="mt-3 pl-4 border-l-2 border-[var(--border-subtle)]">
          <p className="text-caption font-medium text-[var(--text-secondary)] mb-1">
            Respuesta del anfitrión
          </p>
          <p className="text-body-sm text-[var(--text-secondary)] leading-relaxed">
            {review.response_text}
          </p>
        </div>
      )}

      <div className="divider mt-6" />
    </div>
  );
}
