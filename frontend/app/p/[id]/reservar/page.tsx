"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import { pluralNights } from "@/lib/utils";
import Price from "@/components/Price";
import { format, parseISO, differenceInCalendarDays, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Shield, ChevronLeft, Loader2, Pencil, X, Plus, Minus, CalendarDays, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface Property {
  id: string;
  title: string;
  price_per_night: number;
  cleaning_fee: number;
  security_deposit: number;
  cancellation_policy: string;
  instant_booking: boolean;
  max_guests: number;
  min_stay_nights: number;
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

type Step = "review" | "payment";

const POLICY_DESC: Record<string, string> = {
  flexible: "Cancelación gratuita hasta 24 h antes del check-in.",
  moderate: "Cancelación gratuita hasta 5 días antes del check-in.",
  strict: "Sin reembolso una vez confirmada la reserva.",
  moderada: "Cancelación gratuita hasta 5 días antes del check-in.",
  estricta: "Sin reembolso una vez confirmada la reserva.",
};

const IVA_RATE = 0.16;

export default function ReservarPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { get, post } = useApi();

  const [checkIn, setCheckIn] = useState(searchParams.get("check_in") ?? "");
  const [checkOut, setCheckOut] = useState(searchParams.get("check_out") ?? "");
  const [guests, setGuests] = useState(Number(searchParams.get("huespedes") ?? 1));

  const [property, setProperty] = useState<Property | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [step, setStep] = useState<Step>("review");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editores inline
  const [editingDates, setEditingDates] = useState(false);
  const [editingGuests, setEditingGuests] = useState(false);
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({});

  const nights = checkIn && checkOut
    ? differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
    : 0;

  const iva = breakdown ? breakdown.total * IVA_RATE : 0;
  const totalWithIva = breakdown ? breakdown.total + iva : 0;

  const fetchBreakdown = useCallback(async (ci: string, co: string) => {
    if (!ci || !co) return;
    try {
      const bd = await get<PriceBreakdown>(
        `/reservations/price-breakdown?property_id=${id}&check_in=${ci}&check_out=${co}`
      );
      setBreakdown(bd);
    } catch {}
  }, [id, get]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      const dest = `/p/${id}/reservar?${searchParams.toString()}`;
      router.push(`/iniciar-sesion?redirect_url=${encodeURIComponent(dest)}`);
      return;
    }
    if (!checkIn || !checkOut || nights <= 0) { router.push(`/p/${id}`); return; }

    Promise.all([
      get<Property>(`/properties/${id}`),
      get<PriceBreakdown>(`/reservations/price-breakdown?property_id=${id}&check_in=${checkIn}&check_out=${checkOut}`),
    ])
      .then(([prop, bd]) => { setProperty(prop); setBreakdown(bd); })
      .catch(() => router.push(`/p/${id}`))
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded]);

  async function handleConfirm() {
    if (!property) return;
    setSubmitting(true);
    setError(null);
    try {
      const reservation = await post<{ id: string }>("/reservations", {
        property_id: id, check_in: checkIn, check_out: checkOut, guests_count: guests,
      });
      const checkout = await post<{ checkout_url: string; sandbox_init_point: string }>(
        `/payments/checkout/${reservation.id}`, {}
      );
      const url = process.env.NODE_ENV === "development"
        ? checkout.sandbox_init_point : checkout.checkout_url;
      setCheckoutUrl(url);
      setStep("payment");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ocurrió un error al crear la reserva");
    } finally {
      setSubmitting(false);
    }
  }

  function applyDates() {
    if (!draftRange.from || !draftRange.to) return;
    const ci = format(draftRange.from, "yyyy-MM-dd");
    const co = format(draftRange.to, "yyyy-MM-dd");
    setCheckIn(ci);
    setCheckOut(co);
    setEditingDates(false);
    fetchBreakdown(ci, co);
  }

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
      </div>
    </div>
  );

  if (!property || !breakdown) return null;

  const photo = property.photos.find((p) => p.is_primary) ?? property.photos[0];

  const formatDate = (d: string) => d ? format(parseISO(d), "d MMM yyyy", { locale: es }) : "";

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link href={`/p/${id}`} className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors">
          <ChevronLeft size={14} /> Volver
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ── Columna izquierda ── */}
          <div>
            {step === "review" && (
              <>
                <h1 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-6">
                  Confirmar y pagar
                </h1>

                {/* ── 1. Tu viaje ── */}
                <section className="mb-6">
                  <h2 className="text-h2 text-[var(--text-primary)] mb-4">Tu viaje</h2>

                  {/* Fechas */}
                  <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-3">
                      <CalendarDays size={18} className="text-[var(--text-secondary)] flex-shrink-0" />
                      <div>
                        <p className="text-caption text-[var(--text-tertiary)] uppercase tracking-wide font-medium">Fechas</p>
                        <p className="text-body text-[var(--text-primary)]">
                          {formatDate(checkIn)} – {formatDate(checkOut)}
                        </p>
                        <p className="text-caption text-[var(--text-secondary)]">{pluralNights(nights)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setDraftRange({ from: parseISO(checkIn), to: parseISO(checkOut) }); setEditingDates(!editingDates); setEditingGuests(false); }}
                      className="text-body-sm font-semibold text-[var(--text-primary)] underline hover:no-underline"
                    >
                      Modificar
                    </button>
                  </div>

                  {/* Editor de fechas inline */}
                  {editingDates && (
                    <div className="border border-[var(--border-subtle)] rounded-2xl p-4 mt-3 bg-white shadow-sm">
                      <DayPicker
                        mode="range"
                        selected={{ from: draftRange.from, to: draftRange.to }}
                        onSelect={(r) => setDraftRange(r ?? {})}
                        locale={es}
                        disabled={{ before: addDays(new Date(), 1) }}
                        numberOfMonths={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2 mt-3 justify-end">
                        <button onClick={() => setEditingDates(false)} className="btn btn-outline px-4 py-2 text-body-sm">Cancelar</button>
                        <button
                          onClick={applyDates}
                          disabled={!draftRange.from || !draftRange.to}
                          className="btn btn-primary px-4 py-2 text-body-sm disabled:opacity-50"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Huéspedes */}
                  <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] mt-1">
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-[var(--text-secondary)] flex-shrink-0" />
                      <div>
                        <p className="text-caption text-[var(--text-tertiary)] uppercase tracking-wide font-medium">Huéspedes</p>
                        <p className="text-body text-[var(--text-primary)]">
                          {guests} {guests === 1 ? "huésped" : "huéspedes"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditingGuests(!editingGuests); setEditingDates(false); }}
                      className="text-body-sm font-semibold text-[var(--text-primary)] underline hover:no-underline"
                    >
                      Modificar
                    </button>
                  </div>

                  {/* Editor de huéspedes inline */}
                  {editingGuests && (
                    <div className="border border-[var(--border-subtle)] rounded-2xl p-4 mt-3 bg-white shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-body font-medium text-[var(--text-primary)]">Huéspedes</p>
                        <p className="text-caption text-[var(--text-secondary)]">Máximo {property.max_guests}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setGuests((g) => Math.max(1, g - 1))}
                          disabled={guests <= 1}
                          className="w-8 h-8 rounded-full border border-[var(--border-default)] flex items-center justify-center hover:border-[var(--text-primary)] disabled:opacity-30 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-body font-medium w-5 text-center">{guests}</span>
                        <button
                          onClick={() => setGuests((g) => Math.min(property.max_guests, g + 1))}
                          disabled={guests >= property.max_guests}
                          className="w-8 h-8 rounded-full border border-[var(--border-default)] flex items-center justify-center hover:border-[var(--text-primary)] disabled:opacity-30 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                        <button onClick={() => setEditingGuests(false)} className="ml-2 text-neutral-400 hover:text-neutral-700">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                <div className="divider mb-6" />

                {/* ── 2. Cancelación ── */}
                <section className="mb-6">
                  <h2 className="text-h2 text-[var(--text-primary)] mb-2">Política de cancelación</h2>
                  <p className="text-body text-[var(--text-secondary)]">
                    {POLICY_DESC[property.cancellation_policy] ?? property.cancellation_policy}
                  </p>
                </section>

                <div className="divider mb-6" />

                {/* ── 3. Protección ── */}
                <section className="mb-8">
                  <div className="flex items-start gap-3">
                    <Shield size={20} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-body font-medium text-[var(--text-primary)]">Tu reserva está protegida</p>
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
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="btn btn-primary w-full justify-center py-3.5 text-body"
                >
                  {submitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Procesando...</>
                  ) : property.instant_booking ? "Confirmar y pagar" : "Solicitar reserva"}
                </button>
                <p className="text-caption text-center text-[var(--text-tertiary)] mt-3">
                  No se te cobrará hasta que el pago sea confirmado
                </p>
              </>
            )}

            {step === "payment" && checkoutUrl && (
              <div className="text-center py-10">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-h1 text-[var(--text-primary)] mb-2">¡Reserva creada!</h2>
                <p className="text-body text-[var(--text-secondary)] mb-6 max-w-sm mx-auto">
                  Completa el pago en MercadoPago para confirmar tu estadía.
                </p>
                <a href={checkoutUrl} className="btn btn-accent px-8 py-3 text-body">
                  Ir a pagar con MercadoPago
                </a>
                <p className="mt-4">
                  <Link href="/reservaciones" className="text-body-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
                    Ver mis reservas
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* ── Tarjeta derecha: propiedad + precio ── */}
          <div className="md:sticky md:top-24">
            <div className="card p-5">
              {/* Mini card propiedad */}
              <div className="flex gap-3 mb-5">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--color-primary-light)]">
                  {photo?.url && <Image src={photo.url} alt={property.title} fill className="object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium text-[var(--text-primary)] line-clamp-2">{property.title}</p>
                  <p className="text-caption text-[var(--text-secondary)] mt-1">Anfitrión: {property.host.full_name}</p>
                  {property.cancellation_policy === "flexible" && (
                    <span className="inline-block mt-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Cancelación gratuita
                    </span>
                  )}
                </div>
              </div>

              <div className="divider mb-4" />

              {/* Desglose de precio */}
              <h3 className="text-body font-semibold text-[var(--text-primary)] mb-3">Detalle del precio</h3>
              <div className="space-y-2.5 text-body-sm">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span><Price amount={breakdown.price_per_night} /> × {pluralNights(breakdown.nights)}</span>
                  <span><Price amount={breakdown.subtotal} /></span>
                </div>
                {breakdown.cleaning_fee > 0 && (
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Limpieza</span>
                    <span><Price amount={breakdown.cleaning_fee} /></span>
                  </div>
                )}
                {breakdown.platform_fee > 0 && (
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Cargo por servicio</span>
                    <span><Price amount={breakdown.platform_fee} /></span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>IVA (16%)</span>
                  <span><Price amount={iva} /></span>
                </div>

                <div className="border-t border-[var(--border-subtle)] pt-3 mt-1 flex justify-between font-semibold text-[var(--text-primary)]">
                  <span>Total MXN</span>
                  <span><Price amount={totalWithIva} /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
