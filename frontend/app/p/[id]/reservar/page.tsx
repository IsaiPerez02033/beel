"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import { formatPrice, pluralNights } from "@/lib/utils";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { Shield, ChevronLeft, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Property {
  id: string;
  title: string;
  price_per_night: number;
  cleaning_fee: number;
  security_deposit: number;
  cancellation_policy: string;
  instant_booking: boolean;
  photos: { url: string; is_primary: boolean }[];
  host: { full_name: string; avatar_url?: string };
}

interface PriceBreakdown {
  nights: number;
  price_per_night: number;
  subtotal: number;
  cleaning_fee: number;
  platform_fee: number;
  total: number;
  currency: string;
}

type Step = "review" | "payment" | "confirmed";

const POLICY_DESC: Record<string, string> = {
  flexible: "Cancelación gratuita hasta 24 h antes del check-in.",
  moderada: "Cancelación gratuita hasta 5 días antes del check-in.",
  estricta: "Sin reembolso una vez confirmada la reserva.",
};

export default function ReservarPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { get, post } = useApi();

  const checkIn = searchParams.get("check_in") ?? "";
  const checkOut = searchParams.get("check_out") ?? "";
  const guests = Number(searchParams.get("huespedes") ?? 1);

  const [property, setProperty] = useState<Property | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [step, setStep] = useState<Step>("review");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nights = checkIn && checkOut
    ? differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
    : 0;

  useEffect(() => {
    if (!isSignedIn) {
      router.push(`/iniciar-sesion?redirect_url=/p/${id}/reservar?${searchParams}`);
      return;
    }
    if (!checkIn || !checkOut || nights <= 0) {
      router.push(`/p/${id}`);
      return;
    }
    Promise.all([
      get<Property>(`/properties/${id}`),
      get<PriceBreakdown>(
        `/reservations/price-breakdown?property_id=${id}&check_in=${checkIn}&check_out=${checkOut}`
      ),
    ])
      .then(([prop, bd]) => {
        setProperty(prop);
        setBreakdown(bd);
      })
      .catch(() => router.push(`/p/${id}`))
      .finally(() => setLoading(false));
  }, [id, checkIn, checkOut, isSignedIn]);

  async function handleConfirm() {
    if (!property) return;
    setSubmitting(true);
    setError(null);
    try {
      const reservation = await post<{ id: string }>("/reservations", {
        property_id: id,
        check_in: checkIn,
        check_out: checkOut,
        guests,
      });
      setReservationId(reservation.id);

      // Iniciar pago con MercadoPago
      const checkout = await post<{ checkout_url: string; sandbox_init_point: string }>(
        `/payments/checkout/${reservation.id}`,
        {}
      );
      const url = process.env.NODE_ENV === "development"
        ? checkout.sandbox_init_point
        : checkout.checkout_url;
      setCheckoutUrl(url);
      setStep("payment");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg ?? "Ocurrió un error al crear la reserva");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
        </div>
      </div>
    );
  }

  if (!property || !breakdown) return null;

  const photo = property.photos.find((p) => p.is_primary) ?? property.photos[0];

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href={`/p/${id}`}
          className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ChevronLeft size={14} /> Volver
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
          {/* ── Columna izquierda ── */}
          <div>
            {step === "review" && (
              <>
                <h1 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-6">
                  Confirma tu reserva
                </h1>

                {/* Resumen del viaje */}
                <section className="mb-6">
                  <h2 className="text-h2 text-[var(--text-primary)] mb-3">Tu viaje</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-caption text-[var(--text-tertiary)] uppercase tracking-wide font-medium mb-0.5">
                        Llegada
                      </p>
                      <p className="text-body text-[var(--text-primary)]">
                        {format(parseISO(checkIn), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption text-[var(--text-tertiary)] uppercase tracking-wide font-medium mb-0.5">
                        Salida
                      </p>
                      <p className="text-body text-[var(--text-primary)]">
                        {format(parseISO(checkOut), "d 'de' MMMM, yyyy", { locale: es })}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption text-[var(--text-tertiary)] uppercase tracking-wide font-medium mb-0.5">
                        Huéspedes
                      </p>
                      <p className="text-body text-[var(--text-primary)]">
                        {guests} {guests === 1 ? "huésped" : "huéspedes"}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="divider mb-6" />

                {/* Política de cancelación */}
                <section className="mb-6">
                  <h2 className="text-h2 text-[var(--text-primary)] mb-2">
                    Política de cancelación
                  </h2>
                  <p className="text-body text-[var(--text-secondary)]">
                    {POLICY_DESC[property.cancellation_policy] ?? property.cancellation_policy}
                  </p>
                </section>

                <div className="divider mb-6" />

                {/* Protección */}
                <section className="mb-8">
                  <div className="flex items-start gap-3">
                    <Shield size={20} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-body font-medium text-[var(--text-primary)]">
                        Tu reserva está protegida
                      </p>
                      <p className="text-body-sm text-[var(--text-secondary)]">
                        Beel solo libera el pago al anfitrión 24 h después del check-in, para garantizar que todo esté correcto.
                      </p>
                    </div>
                  </div>
                </section>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="btn btn-primary w-full justify-center py-3.5 text-body"
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Procesando...</>
                  ) : property.instant_booking ? (
                    "Confirmar y pagar"
                  ) : (
                    "Solicitar reserva"
                  )}
                </button>

                <p className="text-caption text-center text-[var(--text-tertiary)] mt-3">
                  No se te cobrará hasta que el pago sea confirmado
                </p>
              </>
            )}

            {step === "payment" && checkoutUrl && (
              <div className="text-center py-10">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-h1 text-[var(--text-primary)] mb-2">
                  ¡Reserva creada!
                </h2>
                <p className="text-body text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                  Completa el pago en MercadoPago para confirmar tu estadía.
                </p>
                <a
                  href={checkoutUrl}
                  className="btn btn-accent px-8 py-3 text-body"
                >
                  Ir a pagar con MercadoPago
                </a>
                <p className="mt-4">
                  <Link
                    href="/reservaciones"
                    className="text-body-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                  >
                    Ver mis reservas
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* ── Tarjeta de la propiedad ── */}
          <div>
            <div className="card p-4 sticky top-24">
              <div className="flex gap-3 mb-4">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--color-primary-light)]">
                  {photo?.url && (
                    <Image src={photo.url} alt={property.title} fill className="object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium text-[var(--text-primary)] line-clamp-2">
                    {property.title}
                  </p>
                  <p className="text-caption text-[var(--text-secondary)] mt-1">
                    Anfitrión: {property.host.full_name}
                  </p>
                </div>
              </div>

              <div className="divider mb-4" />

              <h3 className="text-h3 text-[var(--text-primary)] mb-3">Detalle del precio</h3>
              <div className="space-y-0">
                <div className="price-row">
                  <span>{formatPrice(breakdown.price_per_night)} × {pluralNights(breakdown.nights)}</span>
                  <span>{formatPrice(breakdown.subtotal)}</span>
                </div>
                {breakdown.cleaning_fee > 0 && (
                  <div className="price-row">
                    <span>Limpieza</span>
                    <span>{formatPrice(breakdown.cleaning_fee)}</span>
                  </div>
                )}
                {breakdown.platform_fee > 0 && (
                  <div className="price-row">
                    <span>Cargo por servicio</span>
                    <span>{formatPrice(breakdown.platform_fee)}</span>
                  </div>
                )}
                <div className="price-row total">
                  <span>Total</span>
                  <span>{formatPrice(breakdown.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
