"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Star, Shield, Loader2, MessageCircle, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useSafeAuth";
import { formatRating } from "@/lib/utils";
import type { Property } from "@/types";

interface HostReview {
  id: string;
  reviewer_name: string;
  reviewer_avatar?: string | null;
  overall_rating: number;
  comment?: string | null;
  property_title?: string | null;
  created_at: string;
}

interface HostProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  is_identity_verified: boolean;
  role: string;
  host_since?: string | null;
  created_at: string;
  total_listings: number;
  avg_rating?: number | null;
  total_reviews: number;
  properties: Property[];
  reviews: HostReview[];
}

export default function HostProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { get, post } = useApi();
  const { isSignedIn, isLoaded, userId } = useAuth();

  const [profile, setProfile] = useState<HostProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showMsg, setShowMsg] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [msgError, setMsgError] = useState("");

  useEffect(() => {
    if (!id) return;
    get<HostProfile>(`/users/${id}/host-profile`)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, get]);

  async function sendMessage() {
    if (!msg.trim()) return;
    setSending(true);
    setMsgError("");
    try {
      await post("/conversations", { host_id: id, first_message: msg.trim() });
      setShowMsg(false);
      router.push("/mensajes");
    } catch (e) {
      setMsgError(e instanceof Error ? e.message : "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  function openMessage() {
    if (!isSignedIn) {
      router.push(`/iniciar-sesion?callbackUrl=/u/${id}`);
      return;
    }
    setShowMsg(true);
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

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-h1 font-display text-[var(--text-primary)] mb-2">Anfitrión no encontrado</h1>
          <p className="text-body text-[var(--text-secondary)]">Este perfil no existe o no está disponible.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const isOwnProfile = userId === profile.id;
  const memberYear = profile.host_since
    ? new Date(profile.host_since).getFullYear()
    : new Date(profile.created_at).getFullYear();

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="card p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">
          <div className="flex-shrink-0">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name}
                width={96}
                height={96}
                className="rounded-full object-cover w-24 h-24 ring-2 ring-[var(--color-primary-border)]"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-3xl font-bold text-[var(--color-primary)]">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-h1 font-display font-semibold text-[var(--text-primary)]">
                {profile.full_name}
              </h1>
              {profile.is_identity_verified && (
                <span title="Identidad verificada" className="inline-flex items-center gap-1 text-caption font-medium text-[var(--color-primary)]">
                  <Shield size={14} className="fill-[var(--color-primary-light)]" /> Verificado
                </span>
              )}
            </div>
            <p className="text-body-sm text-[var(--text-tertiary)] mb-4">
              Anfitrión en Beel desde {memberYear}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-2 text-body-sm">
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Star size={15} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
                {profile.avg_rating ? (
                  <><strong className="text-[var(--text-primary)]">{formatRating(profile.avg_rating)}</strong> · {profile.total_reviews} {profile.total_reviews === 1 ? "reseña" : "reseñas"}</>
                ) : (
                  "Sin reseñas aún"
                )}
              </span>
              <span className="text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">{profile.total_listings}</strong>{" "}
                {profile.total_listings === 1 ? "hospedaje" : "hospedajes"}
              </span>
            </div>
          </div>

          {!isOwnProfile && (
            <button onClick={openMessage} className="btn btn-primary px-5 py-2.5 flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto">
              <MessageCircle size={16} /> Enviar mensaje
            </button>
          )}
        </div>

        {/* Propiedades */}
        <section className="mb-12">
          <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-5">
            Hospedajes de {profile.full_name.split(" ")[0]}
          </h2>
          {profile.properties.length === 0 ? (
            <p className="text-body text-[var(--text-tertiary)]">Este anfitrión aún no tiene hospedajes publicados.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {profile.properties.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          )}
        </section>

        {/* Reseñas */}
        {profile.reviews.length > 0 && (
          <section className="mb-12">
            <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-5">
              Lo que dicen los huéspedes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {profile.reviews.map((r) => (
                <div key={r.id} className="card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    {r.reviewer_avatar ? (
                      <Image src={r.reviewer_avatar} alt={r.reviewer_name} width={36} height={36} className="rounded-full object-cover w-9 h-9" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-sm font-semibold text-[var(--color-primary)]">
                        {r.reviewer_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-body-sm font-semibold text-[var(--text-primary)] leading-tight">{r.reviewer_name}</p>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={12} className={i < r.overall_rating ? "fill-[var(--color-accent)] text-[var(--color-accent)]" : "text-[var(--border-default)]"} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-body-sm text-[var(--text-secondary)] leading-relaxed">{r.comment}</p>
                  )}
                  {r.property_title && (
                    <p className="text-caption text-[var(--text-tertiary)] mt-2">— {r.property_title}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Modal enviar mensaje */}
      {showMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--bg-overlay)]" onClick={() => setShowMsg(false)}>
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3 font-semibold text-[var(--text-primary)]">Mensaje a {profile.full_name.split(" ")[0]}</h3>
              <button onClick={() => setShowMsg(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"><X size={18} /></button>
            </div>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={4}
              placeholder="Hola, me interesa tu hospedaje..."
              className="input w-full resize-none mb-3"
              style={{ fontSize: "16px" }}
            />
            {msgError && <p className="text-caption text-red-600 mb-3">{msgError}</p>}
            <button onClick={sendMessage} disabled={sending || !msg.trim()} className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2">
              {sending ? <Loader2 size={16} className="animate-spin" /> : "Enviar mensaje"}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
