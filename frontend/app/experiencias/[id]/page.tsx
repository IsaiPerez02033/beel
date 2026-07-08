"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Clock, Users, Star, Shield, Loader2, ChevronLeft, MessageCircle, X, CalendarDays,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Price from "@/components/Price";
import PropertyMap from "@/components/PropertyMap";
import { formatDuration } from "@/components/ExperienceCard";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useSafeAuth";
import { formatRating } from "@/lib/utils";
import type { Experience } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  gastronomia: "Gastronomía", aventura: "Aventura", cultura: "Cultura", arte: "Arte",
  naturaleza: "Naturaleza", deporte: "Deporte", bienestar: "Bienestar",
  vida_nocturna: "Vida nocturna", tour: "Tour", otro: "Experiencia",
};

export default function ExperienceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { get, post } = useApi();
  const { isSignedIn, userId } = useAuth();
  const [exp, setExp] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState(1);
  const [bookingDate, setBookingDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [bookErr, setBookErr] = useState("");
  const [showMsg, setShowMsg] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    get<Experience>(`/experiences/${id}`).then(setExp).catch(() => {}).finally(() => setLoading(false));
  }, [id, get]);

  useEffect(() => {
    if (exp) setParticipants(exp.min_participants || 1);
  }, [exp]);

  async function createBooking() {
    if (!exp) return;
    if (!isSignedIn) { router.push(`/iniciar-sesion?callbackUrl=/experiencias/${id}`); return; }
    if (!bookingDate) { setBookErr("Elige una fecha."); return; }
    setBookErr("");
    setCreating(true);
    try {
      const booking = await post<{ id: string }>("/experiences/bookings", {
        experience_id: id, booking_date: bookingDate, participants,
      });
      router.push(`/experiencias/reservas/${booking.id}`);
    } catch (e) {
      setBookErr(e instanceof Error ? e.message : "No se pudo crear la reserva.");
    } finally {
      setCreating(false);
    }
  }

  async function contactHost() {
    if (!isSignedIn) { router.push(`/iniciar-sesion?callbackUrl=/experiencias/${id}`); return; }
    if (!msg.trim() || !exp) return;
    setSending(true);
    try {
      await post("/conversations", { host_id: exp.host_id ?? exp.host.id, first_message: msg.trim() });
      router.push("/mensajes");
    } catch { /* noop */ } finally { setSending(false); }
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
  if (!exp) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h1 className="text-h1 font-display text-[var(--text-primary)]">Experiencia no encontrada</h1>
        </div>
        <Footer />
      </div>
    );
  }

  const total = Number(exp.price_per_person) * participants;
  const isOwner = Boolean(userId && (exp.host_id === userId || exp.host?.id === userId));

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <Link href="/experiencias" className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4">
          <ChevronLeft size={16} /> Experiencias
        </Link>

        {/* Galería */}
        {exp.photos?.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl overflow-hidden mb-6">
            {exp.photos.slice(0, 4).map((p, i) => (
              <div key={p.id} className={`relative ${i === 0 ? "sm:col-span-2 aspect-[16/9]" : "aspect-[4/3]"}`}>
                <Image src={p.url} alt={exp.title} fill className="object-cover" sizes="(max-width:640px) 100vw, 50vw" />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-8 items-start">
          {/* Info */}
          <div>
            <span className="inline-block text-caption font-semibold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-1 rounded-lg mb-2">
              {CATEGORY_LABEL[exp.category] ?? "Experiencia"}
            </span>
            <h1 className="text-display font-display font-semibold text-[var(--text-primary)] mb-2">{exp.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-body-sm text-[var(--text-secondary)] mb-4">
              <span className="flex items-center gap-1.5"><Clock size={15} /> {formatDuration(exp.duration_minutes)}</span>
              <span className="flex items-center gap-1.5"><Users size={15} /> {exp.min_participants}–{exp.max_participants} personas</span>
              {exp.avg_rating != null && (
                <span className="flex items-center gap-1"><Star size={14} className="fill-[var(--color-accent)] text-[var(--color-accent)]" /> {formatRating(exp.avg_rating)} ({exp.total_reviews})</span>
              )}
              <span>{exp.city}{exp.state ? `, ${exp.state}` : ""}</span>
            </div>

            <div className="divider" />
            <h2 className="text-h2 text-[var(--text-primary)] mb-2 mt-4">Sobre esta experiencia</h2>
            <p className="text-body text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{exp.description}</p>

            {exp.included && (<><h3 className="text-h3 font-semibold text-[var(--text-primary)] mt-6 mb-2">Qué incluye</h3><p className="text-body-sm text-[var(--text-secondary)] whitespace-pre-wrap">{exp.included}</p></>)}
            {exp.requirements && (<><h3 className="text-h3 font-semibold text-[var(--text-primary)] mt-6 mb-2">Requisitos</h3><p className="text-body-sm text-[var(--text-secondary)] whitespace-pre-wrap">{exp.requirements}</p></>)}
            {exp.languages && <p className="text-body-sm text-[var(--text-tertiary)] mt-4">Idiomas: {exp.languages}</p>}

            <div className="divider my-6" />
            {/* Host */}
            <Link href={`/u/${exp.host_id ?? exp.host?.id}`} className="flex items-center gap-3 group">
              {exp.host?.avatar_url ? (
                <Image src={exp.host.avatar_url} alt={exp.host.full_name} width={48} height={48} className="rounded-full object-cover" />
              ) : (
                <div className="avatar avatar-lg">{exp.host?.full_name?.charAt(0).toUpperCase()}</div>
              )}
              <div>
                <p className="text-body font-medium text-[var(--text-primary)] group-hover:text-[var(--color-primary)]">
                  Anfitrión: {exp.host?.full_name} {exp.host?.is_identity_verified && <Shield size={13} className="inline text-[var(--color-primary)]" />}
                </p>
                <p className="text-caption text-[var(--text-tertiary)]">Ver perfil →</p>
              </div>
            </Link>

            {/* Mapa */}
            {exp.latitude_approx != null && exp.longitude_approx != null && (
              <div className="mt-6">
                <h3 className="text-h3 font-semibold text-[var(--text-primary)] mb-2">Punto de encuentro</h3>
                <p className="text-body-sm text-[var(--text-secondary)] mb-2">{exp.neighborhood ? `${exp.neighborhood}, ` : ""}{exp.city}</p>
                <PropertyMap lat={Number(exp.latitude_approx)} lng={Number(exp.longitude_approx)} title={exp.title} />
              </div>
            )}
          </div>

          {/* Reserva */}
          <div className="md:sticky md:top-24">
            <div className="card p-5">
              <p className="text-h2 font-semibold text-[var(--text-primary)]">
                <Price amount={exp.price_per_person} /> <span className="text-body-sm font-normal text-[var(--text-tertiary)]">/ persona</span>
              </p>

              {/* Fecha */}
              <label className="block mt-4">
                <span className="text-caption text-[var(--text-tertiary)] uppercase tracking-wide font-medium flex items-center gap-1.5">
                  <CalendarDays size={13} /> Fecha
                </span>
                <input
                  type="date"
                  value={bookingDate}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="input w-full mt-1"
                  style={{ fontSize: "16px" }}
                  disabled={isOwner}
                />
              </label>

              <div className="flex items-center justify-between mt-3 py-3 border-y border-[var(--border-subtle)]">
                <span className="text-body-sm text-[var(--text-secondary)]">Participantes</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setParticipants((p) => Math.max(exp.min_participants, p - 1))} className="w-7 h-7 rounded-full border border-[var(--border-default)] flex items-center justify-center">−</button>
                  <span className="min-w-[1.5ch] text-center">{participants}</span>
                  <button onClick={() => setParticipants((p) => Math.min(exp.max_participants, p + 1))} className="w-7 h-7 rounded-full border border-[var(--border-default)] flex items-center justify-center">+</button>
                </div>
              </div>
              <div className="flex justify-between text-body-sm text-[var(--text-secondary)] mt-3">
                <span><Price amount={exp.price_per_person} /> × {participants}</span>
                <span><Price amount={total} /></span>
              </div>
              <div className="flex justify-between text-body font-semibold text-[var(--text-primary)] mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <span>Total</span><span><Price amount={total} /></span>
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Impuestos y tarifa de servicio se calculan al confirmar.</p>

              {bookErr && <p className="text-caption text-red-600 mt-2">{bookErr}</p>}

              {isOwner ? (
                <p className="text-caption text-[var(--text-tertiary)] text-center mt-4">Esta es tu experiencia.</p>
              ) : (
                <>
                  <button
                    onClick={createBooking}
                    disabled={creating}
                    className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2 py-3"
                  >
                    {creating ? <Loader2 size={16} className="animate-spin" /> : (exp.instant_booking ? "Reservar y pagar" : "Solicitar reserva")}
                  </button>
                  <button
                    onClick={() => { setShowMsg(true); setMsg(`Hola, tengo una duda sobre tu experiencia "${exp.title}".`); }}
                    className="btn btn-outline w-full mt-2 flex items-center justify-center gap-2 text-body-sm"
                  >
                    <MessageCircle size={15} /> Escribir al anfitrión
                  </button>
                </>
              )}
              <p className="text-caption text-[var(--text-tertiary)] text-center mt-3">
                {exp.instant_booking ? "Confirmación inmediata." : "El anfitrión confirma antes del pago."}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal contactar */}
      {showMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)]" onClick={() => setShowMsg(false)}>
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-semibold text-[var(--text-primary)]">Reservar / consultar</h3>
              <button onClick={() => setShowMsg(false)} className="text-[var(--text-tertiary)]"><X size={18} /></button>
            </div>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className="input w-full resize-none mb-3" style={{ fontSize: "16px" }} />
            <button onClick={contactHost} disabled={sending || !msg.trim()} className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2">
              {sending ? <Loader2 size={16} className="animate-spin" /> : "Enviar al anfitrión"}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
