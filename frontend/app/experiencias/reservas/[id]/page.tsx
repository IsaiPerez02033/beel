"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2, ChevronLeft, CalendarDays, Users, Clock, CheckCircle2, XCircle,
  AlertTriangle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Price from "@/components/Price";
import { formatDuration } from "@/components/ExperienceCard";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useSafeAuth";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ExperienceBooking } from "@/types";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendiente de confirmación", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmada", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rechazada", cls: "bg-red-50 text-red-700 border-red-200" },
  cancelled_guest: { label: "Cancelada por el huésped", cls: "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]" },
  cancelled_host: { label: "Cancelada por el anfitrión", cls: "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-default)]" },
  completed: { label: "Completada", cls: "bg-[var(--color-primary-light)] text-[var(--color-primary)] border-[var(--color-primary)]" },
};

export default function ExperienceBookingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { get, post } = useApi();
  const { userId, isLoaded, isSignedIn } = useAuth();

  const [booking, setBooking] = useState<ExperienceBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const b = await get<ExperienceBooking>(`/experiences/bookings/${id}`);
      setBooking(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la reserva.");
    } finally {
      setLoading(false);
    }
  }, [id, get]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.replace(`/iniciar-sesion?callbackUrl=/experiencias/reservas/${id}`); return; }
    load();
  }, [isLoaded, isSignedIn, id, load, router]);

  // Al volver de MercadoPago, sincroniza el pago
  useEffect(() => {
    if (searchParams.get("pago") === "ok") {
      post(`/payments/experience/${id}/sync`, {}).catch(() => {}).finally(() => load());
    }
  }, [searchParams, id, post, load]);

  async function respond(action: "confirm" | "reject") {
    setActing(true); setError("");
    try {
      await post(`/experiences/bookings/${id}/respond`, { action });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar.");
    } finally { setActing(false); }
  }

  async function cancel() {
    if (!confirm("¿Seguro que quieres cancelar esta reserva?")) return;
    setActing(true); setError("");
    try {
      await post(`/experiences/bookings/${id}/cancel`, {});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar.");
    } finally { setActing(false); }
  }

  async function pay() {
    setActing(true); setError("");
    try {
      const checkout = await post<{ checkout_url: string; sandbox_init_point: string }>(
        `/payments/experience-checkout/${id}`, {}
      );
      const url = process.env.NODE_ENV === "development" ? checkout.sandbox_init_point : checkout.checkout_url;
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
      setActing(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-base)]"><Navbar />
      <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[var(--color-primary)]" size={32} /></div>
    </div>
  );
  if (!booking) return (
    <div className="min-h-screen bg-[var(--bg-base)]"><Navbar />
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-h1 font-display text-[var(--text-primary)]">Reserva no encontrada</h1>
        <p className="text-body-sm text-red-600 mt-2">{error}</p>
      </div>
    </div>
  );

  const isHost = userId === booking.host_id;
  const isGuest = userId === booking.guest_id;
  const exp = booking.experience;
  const photo = exp?.photos?.find((p) => p.is_primary) ?? exp?.photos?.[0];
  const st = STATUS_LABEL[booking.status] ?? { label: booking.status, cls: "" };
  const paid = booking.payment_status === "paid";
  const canPay = isGuest && booking.status === "confirmed" && !paid;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/experiencias/reservas" className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4">
          <ChevronLeft size={16} /> Mis reservas
        </Link>

        {/* Cabecera experiencia */}
        <div className="card p-5 mb-5">
          <div className="flex gap-4">
            <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-subtle)]">
              {photo?.url && <Image src={photo.url} alt={exp?.title ?? ""} fill className="object-cover" />}
            </div>
            <div className="min-w-0">
              <Link href={`/experiencias/${booking.experience_id}`} className="text-h3 font-semibold text-[var(--text-primary)] hover:text-[var(--color-primary)] line-clamp-2">
                {exp?.title}
              </Link>
              <p className="text-body-sm text-[var(--text-tertiary)] mt-1">{exp?.city}</p>
              <span className={`inline-block mt-2 text-caption font-semibold px-2.5 py-1 rounded-lg border ${st.cls}`}>{st.label}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5 text-center">
            <Info icon={<CalendarDays size={15} />} label="Fecha" value={format(parseISO(booking.booking_date), "d MMM yyyy", { locale: es })} />
            <Info icon={<Users size={15} />} label="Personas" value={String(booking.participants)} />
            {exp && <Info icon={<Clock size={15} />} label="Duración" value={formatDuration(exp.duration_minutes)} />}
          </div>
        </div>

        {/* Desglose */}
        <div className="card p-5 mb-5">
          <h2 className="text-body font-semibold text-[var(--text-primary)] mb-3">Detalle del precio</h2>
          <div className="space-y-2 text-body-sm">
            <Row label={`${booking.participants} × persona`}><Price amount={booking.subtotal} /></Row>
            {Number(booking.lodging_iva_snapshot) > 0 && <Row label="IVA (16%)"><Price amount={booking.lodging_iva_snapshot} /></Row>}
            {Number(booking.platform_fee_snapshot) > 0 && <Row label="Tarifa de servicio"><Price amount={booking.platform_fee_snapshot} /></Row>}
            <div className="border-t border-[var(--border-subtle)] pt-2 mt-1 flex justify-between font-semibold text-[var(--text-primary)]">
              <span>Total {isHost ? "que paga el huésped" : "MXN"}</span>
              <span><Price amount={booking.total_amount} /></span>
            </div>
            {isHost && (
              <div className="flex justify-between text-[var(--color-primary)] font-semibold">
                <span>Tú recibes (neto)</span><span><Price amount={booking.host_net_payout} /></span>
              </div>
            )}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">{error}</div>}

        {/* Aviso demo */}
        {canPay && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#F5A623]/40 bg-[#F5A623]/10 p-4">
            <AlertTriangle size={18} className="text-[#B5790F] flex-shrink-0 mt-0.5" />
            <p className="text-body-sm text-[var(--text-primary)] leading-snug">
              <strong>Beel está en fase de demostración.</strong> Esta experiencia es un ejemplo;
              por favor <strong>no realices ningún pago real</strong>.
            </p>
          </div>
        )}

        {/* Acciones */}
        {isHost && booking.status === "pending" && (
          <div className="flex gap-3">
            <button onClick={() => respond("reject")} disabled={acting} className="btn btn-outline flex-1 py-3 flex items-center justify-center gap-2">
              <XCircle size={16} /> Rechazar
            </button>
            <button onClick={() => respond("confirm")} disabled={acting} className="btn btn-primary flex-1 py-3 flex items-center justify-center gap-2">
              {acting ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Aceptar</>}
            </button>
          </div>
        )}

        {canPay && (
          <button onClick={pay} disabled={acting} className="btn btn-accent w-full py-3.5 flex items-center justify-center gap-2">
            {acting ? <Loader2 size={16} className="animate-spin" /> : "Pagar con MercadoPago"}
          </button>
        )}

        {isGuest && booking.status === "pending" && (
          <p className="text-center text-body-sm text-[var(--text-secondary)]">
            Esperando la confirmación del anfitrión. Te avisaremos para completar el pago.
          </p>
        )}

        {paid && (
          <div className="card p-5 text-center">
            <CheckCircle2 size={28} className="text-[var(--color-primary)] mx-auto mb-2" />
            <p className="text-body font-semibold text-[var(--text-primary)]">Pago confirmado</p>
            <p className="text-body-sm text-[var(--text-secondary)]">Tu experiencia está reservada. ¡Disfrútala!</p>
          </div>
        )}

        {(isGuest || isHost) && (booking.status === "pending" || booking.status === "confirmed") && !paid && (
          <button onClick={cancel} disabled={acting} className="block mx-auto mt-4 text-body-sm text-[var(--text-tertiary)] hover:text-red-600">
            Cancelar reserva
          </button>
        )}
      </main>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--bg-subtle)] py-2.5">
      <div className="flex items-center justify-center gap-1 text-[var(--text-tertiary)] text-caption">{icon} {label}</div>
      <p className="text-body-sm font-medium text-[var(--text-primary)] mt-0.5">{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-[var(--text-secondary)]"><span>{label}</span><span>{children}</span></div>
  );
}
