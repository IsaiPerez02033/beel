"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import Price from "@/components/Price";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/components/ExperienceCard";
import {
  ShieldCheck, RefreshCw, Check, X, MapPin, Users, Clock,
  Loader2, ChevronLeft, BadgeCheck, Trash2, Search,
} from "lucide-react";
import type { Experience } from "@/types";

type Tab = "pending_review" | "active" | "suspended";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending_review", label: "En revisión" },
  { key: "active", label: "Aprobadas" },
  { key: "suspended", label: "Rechazadas" },
];

const CATEGORY_LABEL: Record<string, string> = {
  gastronomia: "Gastronomía", aventura: "Aventura", cultura: "Cultura", arte: "Arte",
  naturaleza: "Naturaleza", deporte: "Deporte", bienestar: "Bienestar",
  vida_nocturna: "Vida nocturna", tour: "Tour", otro: "Experiencia",
};

export default function AdminExperienciasPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { get, post, del } = useApi();

  const [tab, setTab] = useState<Tab>("pending_review");
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

  const fetchExps = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await get<Experience[]>(`/experiences/admin/pending?status_filter=${tab}`);
      setExperiences(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar. ¿Eres admin?");
      setExperiences([]);
    } finally {
      setLoading(false);
    }
  }, [get, tab]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/iniciar-sesion?redirect_url=/admin/experiencias"); return; }
    get<{ role: string }>("/users/me")
      .then((u) => {
        if (u.role !== "admin") { router.replace("/"); return; }
        setIsAdmin(true);
        fetchExps();
      })
      .catch(() => router.replace("/"));
  }, [isSignedIn, isLoaded, get, fetchExps, router]);

  async function approve(id: string) {
    setActionLoading(id);
    try {
      await post(`/experiences/${id}/approve`, {});
      setExperiences((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aprobar");
    } finally {
      setActionLoading(null);
    }
  }

  async function reject() {
    if (!rejectModal) return;
    const id = rejectModal.id;
    setActionLoading(id);
    try {
      await post(`/experiences/${id}/reject`, {});
      setExperiences((prev) => prev.filter((x) => x.id !== id));
      setRejectModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo rechazar");
    } finally {
      setActionLoading(null);
    }
  }

  async function doDelete() {
    if (!deleteModal) return;
    const id = deleteModal.id;
    setActionLoading(id);
    try {
      await del(`/experiences/${id}`);
      setExperiences((prev) => prev.filter((x) => x.id !== id));
      setDeleteModal(null);
    } catch (e) {
      if (String(e instanceof Error ? e.message : "").toLowerCase().includes("encontrada")) {
        setExperiences((prev) => prev.filter((x) => x.id !== id));
        setDeleteModal(null);
      } else {
        setError(e instanceof Error ? e.message : "No se pudo eliminar");
      }
    } finally {
      setActionLoading(null);
    }
  }

  if (isAdmin !== true) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <div className="flex justify-center py-32">
          <Loader2 className="animate-spin text-[var(--text-tertiary)]" />
        </div>
      </div>
    );
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
                Moderación de experiencias
              </h1>
              <p className="text-body text-[var(--text-secondary)]">
                Revisa y aprueba las experiencias antes de que se publiquen
              </p>
            </div>
          </div>
          <button onClick={fetchExps} className="btn btn-outline flex items-center gap-2" disabled={loading}>
            <RefreshCw size={16} className={cn(loading && "animate-spin")} /> Actualizar
          </button>
        </div>

        {/* Buscador */}
        <div className="input w-full flex items-center gap-2 p-0 overflow-hidden focus-within:ring-1 focus-within:ring-neutral-900 focus-within:border-neutral-900 mb-4">
          <span className="pl-3 flex-shrink-0 text-[var(--text-tertiary)]"><Search size={15} /></span>
          <input
            className="flex-1 py-2.5 pr-3 outline-none border-none bg-transparent text-sm placeholder-[var(--text-tertiary)]"
            placeholder="Buscar por título, anfitrión o ciudad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="pr-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <X size={14} />
            </button>
          )}
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
        ) : (() => {
          const q = search.toLowerCase().trim();
          const filtered = q
            ? experiences.filter((x) =>
                x.title?.toLowerCase().includes(q) ||
                x.host?.full_name?.toLowerCase().includes(q) ||
                x.city?.toLowerCase().includes(q)
              )
            : experiences;
          return filtered.length === 0 ? (
            <div className="text-center py-20">
              <Clock size={40} className="text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-body text-[var(--text-secondary)]">
                {q ? `Sin resultados para "${search}"` : tab === "pending_review" ? "No hay experiencias en revisión 🎉" : "Sin experiencias en esta categoría"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((x) => (
                <ExperienceReviewCard
                  key={x.id}
                  experience={x}
                  tab={tab}
                  loading={actionLoading === x.id}
                  onApprove={() => approve(x.id)}
                  onReject={() => setRejectModal({ id: x.id, title: x.title })}
                  onDelete={() => setDeleteModal({ id: x.id, title: x.title })}
                />
              ))}
            </div>
          );
        })()}
      </main>

      {/* Modal de rechazo */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-[var(--bg-elevated)] rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Rechazar experiencia</h3>
            <p className="text-body-sm text-[var(--text-secondary)] mb-4 truncate">{rejectModal.title}</p>
            <p className="text-body-sm text-[var(--text-secondary)] mb-5">
              La experiencia quedará como no aprobada y no aparecerá en las búsquedas.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectModal(null)} className="btn btn-outline">Cancelar</button>
              <button onClick={reject} disabled={actionLoading === rejectModal.id} className="btn bg-red-600 text-white hover:bg-red-700">
                {actionLoading === rejectModal.id ? "Rechazando…" : "Rechazar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de eliminación */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteModal(null)}>
          <div className="bg-[var(--bg-elevated)] rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Eliminar experiencia</h3>
            <p className="text-body-sm text-[var(--text-secondary)] mb-2 truncate">{deleteModal.title}</p>
            <p className="text-body-sm text-[var(--text-secondary)] mb-5">
              Se eliminará de la plataforma (soft-delete). Úsalo solo en casos de contenido
              indebido o problemas con el anfitrión. No se puede deshacer desde aquí.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal(null)} className="btn btn-outline">Cancelar</button>
              <button onClick={doDelete} disabled={actionLoading === deleteModal.id} className="btn bg-red-600 text-white hover:bg-red-700">
                {actionLoading === deleteModal.id ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExperienceReviewCard({
  experience: x, tab, loading, onApprove, onReject, onDelete,
}: {
  experience: Experience; tab: Tab; loading: boolean;
  onApprove: () => void; onReject: () => void; onDelete: () => void;
}) {
  const photo = x.photos?.find((p) => p.is_primary) ?? x.photos?.[0];
  return (
    <div className="card p-4 flex flex-col sm:flex-row gap-4">
      <div className="w-full sm:w-44 h-40 sm:h-32 rounded-xl overflow-hidden bg-[var(--color-primary-light)] flex-shrink-0">
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={x.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">✨</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-body font-semibold text-[var(--text-primary)]">{x.title}</h3>
          <span className="text-body font-semibold text-[var(--text-primary)] whitespace-nowrap">
            <Price amount={x.price_per_person} /><span className="text-caption text-[var(--text-secondary)] font-normal"> /persona</span>
          </span>
        </div>
        <p className="text-body-sm text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
          <MapPin size={13} /> {x.city}{x.state ? `, ${x.state}` : ""}
        </p>
        <div className="flex items-center gap-4 text-caption text-[var(--text-tertiary)] mt-1">
          <span>{CATEGORY_LABEL[x.category] ?? "Experiencia"}</span>
          <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(x.duration_minutes)}</span>
          <span className="flex items-center gap-1"><Users size={12} /> hasta {x.max_participants}</span>
        </div>
        {x.description && <p className="text-caption text-[var(--text-tertiary)] mt-1 line-clamp-2">{x.description}</p>}

        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-caption text-[var(--text-secondary)]">
            Anfitrión: <span className="font-medium text-[var(--text-primary)]">{x.host?.full_name}</span>
            {x.host?.is_identity_verified && <BadgeCheck size={14} className="text-[var(--color-primary)]" />}
          </span>

          <div className="flex items-center gap-2">
            {tab === "pending_review" && (
              <>
                <button onClick={onReject} disabled={loading} className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50 px-3 py-2 flex items-center gap-1.5">
                  <X size={15} /> Rechazar
                </button>
                <button onClick={onApprove} disabled={loading} className="btn btn-primary px-3 py-2 flex items-center gap-1.5">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Aprobar
                </button>
              </>
            )}
            {tab === "suspended" && (
              <button onClick={onApprove} disabled={loading} className="btn btn-primary px-3 py-2 flex items-center gap-1.5">
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Reactivar
              </button>
            )}
            <Link href={`/experiencias/${x.id}`} className="text-body-sm text-[var(--color-primary)] hover:underline whitespace-nowrap">Ver ↗</Link>
            <button onClick={onDelete} disabled={loading} className="btn btn-ghost text-caption px-2 py-2 text-red-600 hover:bg-red-50" title="Eliminar experiencia">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
