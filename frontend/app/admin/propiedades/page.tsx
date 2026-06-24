"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, RefreshCw, Check, X, MapPin, Users, BedDouble,
  Loader2, ChevronLeft, BadgeCheck, Clock,
} from "lucide-react";
import type { Property } from "@/types";

type Tab = "pending_review" | "active" | "suspended";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending_review", label: "En revisión" },
  { key: "active", label: "Aprobadas" },
  { key: "suspended", label: "Rechazadas" },
];

export default function AdminPropiedadesPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { get, post } = useApi();

  const [tab, setTab] = useState<Tab>("pending_review");
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchProps = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await get<Property[]>(`/properties/admin/pending?status_filter=${tab}`);
      setProperties(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cargar. ¿Eres admin?");
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, [get, tab]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/iniciar-sesion?redirect_url=/admin/propiedades"); return; }
    fetchProps();
  }, [isSignedIn, isLoaded, fetchProps, router]);

  async function approve(id: string) {
    setActionLoading(id);
    try {
      await post(`/properties/${id}/approve`, {});
      setProperties((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "No se pudo aprobar");
    } finally {
      setActionLoading(null);
    }
  }

  async function reject() {
    if (!rejectModal) return;
    const id = rejectModal.id;
    setActionLoading(id);
    try {
      await post(`/properties/${id}/reject`, { reason: rejectReason || undefined });
      setProperties((prev) => prev.filter((p) => p.id !== id));
      setRejectModal(null);
      setRejectReason("");
    } catch (e: any) {
      setError(e?.message ?? "No se pudo rechazar");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-5">
          <ChevronLeft size={14} /> Volver al panel
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-[var(--color-primary)]" />
            <div>
              <h1 className="text-display font-display font-medium text-[var(--text-primary)]">
                Moderación de propiedades
              </h1>
              <p className="text-body text-[var(--text-secondary)]">
                Revisa y aprueba las propiedades antes de que se publiquen
              </p>
            </div>
          </div>
          <button onClick={fetchProps} className="btn btn-outline flex items-center gap-2" disabled={loading}>
            <RefreshCw size={16} className={cn(loading && "animate-spin")} /> Actualizar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border-subtle)]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2.5 text-body-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.key
                  ? "border-[var(--color-primary)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-body-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[var(--text-tertiary)]" /></div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20">
            <Clock size={40} className="text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-body text-[var(--text-secondary)]">
              {tab === "pending_review" ? "No hay propiedades en revisión 🎉" : "Sin propiedades en esta categoría"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {properties.map((p) => (
              <PropertyReviewCard
                key={p.id}
                property={p}
                tab={tab}
                loading={actionLoading === p.id}
                onApprove={() => approve(p.id)}
                onReject={() => setRejectModal({ id: p.id, title: p.title })}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal de rechazo */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Rechazar propiedad</h3>
            <p className="text-body-sm text-[var(--text-secondary)] mb-4 truncate">{rejectModal.title}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Motivo del rechazo (opcional, se guarda para auditoría)"
              className="input w-full resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectModal(null)} className="btn btn-outline">Cancelar</button>
              <button onClick={reject} disabled={actionLoading === rejectModal.id} className="btn bg-red-600 text-white hover:bg-red-700">
                {actionLoading === rejectModal.id ? "Rechazando…" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyReviewCard({
  property: p, tab, loading, onApprove, onReject,
}: {
  property: Property; tab: Tab; loading: boolean;
  onApprove: () => void; onReject: () => void;
}) {
  const photo = p.photos?.find((x) => x.is_primary) ?? p.photos?.[0];
  return (
    <div className="card p-4 flex flex-col sm:flex-row gap-4">
      <div className="w-full sm:w-44 h-40 sm:h-32 rounded-xl overflow-hidden bg-[var(--color-primary-light)] flex-shrink-0">
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={p.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🏠</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-body font-semibold text-[var(--text-primary)]">{p.title}</h3>
          <span className="text-body font-semibold text-[var(--text-primary)] whitespace-nowrap">{formatPrice(p.price_per_night)}<span className="text-caption text-[var(--text-secondary)] font-normal"> /noche</span></span>
        </div>
        <p className="text-body-sm text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
          <MapPin size={13} /> {p.city}, {p.state}
        </p>
        <div className="flex items-center gap-4 text-caption text-[var(--text-tertiary)] mt-1">
          <span className="flex items-center gap-1"><Users size={12} /> {p.max_guests}</span>
          <span className="flex items-center gap-1"><BedDouble size={12} /> {p.bedrooms} rec.</span>
          <span className="capitalize">{p.property_type}</span>
        </div>
        <p className="text-caption text-[var(--text-tertiary)] mt-1 line-clamp-2">{p.address}</p>

        <div className="flex items-center justify-between gap-2 mt-3">
          <span className="flex items-center gap-1.5 text-caption text-[var(--text-secondary)]">
            Anfitrión: <span className="font-medium text-[var(--text-primary)]">{p.host?.full_name}</span>
            {p.host?.is_identity_verified && <BadgeCheck size={14} className="text-[var(--color-primary)]" />}
          </span>

          {tab === "pending_review" && (
            <div className="flex gap-2">
              <button onClick={onReject} disabled={loading} className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50 px-3 py-2 flex items-center gap-1.5">
                <X size={15} /> Rechazar
              </button>
              <button onClick={onApprove} disabled={loading} className="btn btn-primary px-3 py-2 flex items-center gap-1.5">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Aprobar
              </button>
            </div>
          )}
          {tab === "suspended" && (
            <button onClick={onApprove} disabled={loading} className="btn btn-primary px-3 py-2 flex items-center gap-1.5">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Reactivar
            </button>
          )}
          <Link href={`/p/${p.id}`} className="text-body-sm text-[var(--color-primary)] hover:underline whitespace-nowrap">Ver ↗</Link>
        </div>
      </div>
    </div>
  );
}
