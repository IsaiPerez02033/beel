"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import BecomeHostModal from "@/components/BecomeHostModal";
import Price from "@/components/Price";
import { cn, formatRating } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Home, Calendar, DollarSign, Star, Plus, ChevronRight,
  Clock, CheckCircle, XCircle, AlertCircle, Settings, Trash2,
} from "lucide-react";
import type { Property } from "@/types";

interface HostReservation {
  id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests_count: number;
  total_amount: number;
  currency: string;
  status: string;
  guest: { full_name: string; avatar_url?: string };
  reservation_property: { id: string; title: string; photos: { url: string; is_primary: boolean }[] };
}

interface HostStats {
  total_listings: number;
  active_listings: number;
  pending_reservations: number;
  confirmed_this_month: number;
  earnings_this_month: number;
  avg_rating: number;
  total_reviews: number;
}

const RESERVATION_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:         { label: "Pendiente",  color: "badge-accent",  icon: <Clock size={12} /> },
  confirmed:       { label: "Confirmada", color: "badge-verified", icon: <CheckCircle size={12} /> },
  rejected:        { label: "Rechazada",  color: "text-red-600 bg-red-50", icon: <XCircle size={12} /> },
  cancelled_guest: { label: "Cancelada",  color: "badge-neutral", icon: <XCircle size={12} /> },
  cancelled_host:  { label: "Cancelada",  color: "badge-neutral", icon: <XCircle size={12} /> },
  completed:       { label: "Completada", color: "badge-neutral", icon: <CheckCircle size={12} /> },
};

type Tab = "reservaciones" | "propiedades";

export default function AnfitrionPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { get, post, del } = useApi();

  const [tab, setTab] = useState<Tab>("reservaciones");
  const [reservations, setReservations] = useState<HostReservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<HostStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Gate de verificación: null = cargando, true/false = resultado
  const [verified, setVerified] = useState<boolean | null>(null);
  const [showHostModal, setShowHostModal] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/iniciar-sesion?redirect_url=/anfitrion");
      return;
    }
    // Verificar que el usuario esté verificado antes de mostrar el panel
    get<{ is_phone_verified: boolean; is_identity_verified: boolean }>("/users/me")
      .then((u) => {
        const ok = !!u.is_phone_verified && !!u.is_identity_verified;
        setVerified(ok);
        if (ok) fetchData();
        else setLoading(false);
      })
      .catch(() => { setVerified(false); setLoading(false); });
  }, [isSignedIn, isLoaded]);

  async function fetchData() {
    setLoading(true);
    try {
      // Independientes: si una falla, la otra igual carga.
      const [resSettled, propSettled] = await Promise.allSettled([
        get<{ reservations: HostReservation[] }>("/reservations/host-requests"),
        get<{ properties: Property[] }>("/properties/host/my-listings"),
      ]);
      const reservas = resSettled.status === "fulfilled" ? resSettled.value.reservations : [];
      const props = propSettled.status === "fulfilled" ? propSettled.value.properties : [];
      if (resSettled.status === "rejected") console.error("reservas:", resSettled.reason);
      if (propSettled.status === "rejected") console.error("propiedades:", propSettled.reason);
      setReservations(reservas);
      setProperties(props);

      // Calcular stats localmente
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const confirmedThisMonth = reservas.filter(
        (r) => r.status === "confirmed" && r.check_in.startsWith(thisMonth)
      );
      const activeProps = props.filter((p) => p.status === "active");
      const ratings = props.filter((p) => p.avg_rating).map((p) => Number(p.avg_rating));

      setStats({
        total_listings: props.length,
        active_listings: activeProps.length,
        pending_reservations: reservas.filter((r) => r.status === "pending").length,
        confirmed_this_month: confirmedThisMonth.length,
        earnings_this_month: confirmedThisMonth.reduce((s, r) => s + r.total_amount, 0),
        avg_rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        total_reviews: props.reduce((s, p) => s + p.total_reviews, 0),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleReservationAction(id: string, action: "confirm" | "reject") {
    setActionLoading(id);
    try {
      await post(`/reservations/${id}/respond`, { action });
      setReservations((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: action === "confirm" ? "confirmed" : "rejected" } : r
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteProperty(id: string) {
    try {
      await del(`/properties/${id}`);
    } catch (e) {
      // 404 = la propiedad ya no existe; la quitamos igual.
      if (!String(e).toLowerCase().includes("encontrada")) throw e;
    }
    setProperties((prev) => prev.filter((p) => p.id !== id));
  }

  const pendingRes = reservations.filter((r) => r.status === "pending");
  const upcomingRes = reservations.filter((r) => r.status === "confirmed");
  const pastRes = reservations.filter((r) => ["completed", "cancelled_guest", "cancelled_host", "rejected"].includes(r.status));

  // Gate: usuario no verificado → no mostrar el panel
  if (verified === false) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <BecomeHostModal open={showHostModal} onClose={() => setShowHostModal(false)} />
        <main className="max-w-lg mx-auto px-4 py-16">
          <div className="card p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
              <Settings size={26} className="text-[var(--color-primary)]" />
            </div>
            <h1 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-2">
              Verifica tu cuenta para ser anfitrión
            </h1>
            <p className="text-body text-[var(--text-secondary)] mb-6">
              Para acceder al panel de anfitrión necesitas verificar tu teléfono
              y tu identidad. Es rápido y solo se hace una vez.
            </p>
            <button onClick={() => setShowHostModal(true)} className="btn btn-primary w-full justify-center">
              Verificar mi cuenta
            </button>
            <Link href="/" className="block text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-4">
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h1 className="text-h1 sm:text-display font-display font-medium text-[var(--text-primary)] leading-tight">
                Panel del anfitrión
              </h1>
              <p className="text-body-sm sm:text-body text-[var(--text-secondary)] mt-0.5">
                Gestiona tus propiedades y reservas
              </p>
            </div>
            <Link href="/anfitrion/configuracion" className="btn btn-outline flex items-center gap-1.5 flex-shrink-0 px-3 py-2 text-body-sm">
              <Settings size={15} />
              <span className="hidden sm:inline">Configuración</span>
            </Link>
          </div>
          <Link href="/p/nueva" className="btn btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
            <Plus size={16} />
            Nueva propiedad
          </Link>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="skeleton h-3 w-1/2 rounded mb-2" />
                <div className="skeleton h-6 w-2/3 rounded" />
              </div>
            ))}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<Home size={18} className="text-[var(--color-primary)]" />}
              label="Propiedades activas"
              value={`${stats.active_listings} / ${stats.total_listings}`}
            />
            <StatCard
              icon={<AlertCircle size={18} className="text-[var(--color-accent)]" />}
              label="Reservas pendientes"
              value={stats.pending_reservations}
              highlight={stats.pending_reservations > 0}
            />
            <StatCard
              icon={<DollarSign size={18} className="text-[var(--color-primary)]" />}
              label="Ingresos este mes"
              value={<Price amount={stats.earnings_this_month} />}
            />
            <StatCard
              icon={<Star size={18} className="text-[var(--color-accent)]" />}
              label="Calificación promedio"
              value={stats.avg_rating > 0 ? `${stats.avg_rating.toFixed(1)} ★` : "—"}
            />
          </div>
        )}

        {/* Alerta de reservas pendientes */}
        {!loading && pendingRes.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-body-sm font-medium text-amber-800">
                Tienes {pendingRes.length} {pendingRes.length === 1 ? "solicitud" : "solicitudes"} de reserva esperando respuesta
              </p>
              <p className="text-caption text-amber-700 mt-0.5">
                Las solicitudes sin respuesta se cancelan automáticamente en 24 h
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border-subtle)]">
          {(["reservaciones", "propiedades"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-body-sm font-medium border-b-2 transition-colors -mb-px capitalize",
                tab === t
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {t === "reservaciones" ? "Reservas" : "Mis propiedades"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card flex gap-4 p-4 animate-pulse">
                <div className="skeleton w-20 h-20 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === "reservaciones" ? (
          <ReservationsTab
            pending={pendingRes}
            upcoming={upcomingRes}
            past={pastRes}
            actionLoading={actionLoading}
            onAction={handleReservationAction}
          />
        ) : (
          <PropertiesTab properties={properties} onDelete={handleDeleteProperty} />
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon, label, value, highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn("card p-4", highlight && "border-amber-300 bg-amber-50")}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-caption text-[var(--text-secondary)] mb-1">{label}</p>
      <p className={cn("text-h2 font-semibold", highlight ? "text-amber-700" : "text-[var(--text-primary)]")}>
        {value}
      </p>
    </div>
  );
}

function ReservationsTab({
  pending, upcoming, past, actionLoading, onAction,
}: {
  pending: HostReservation[];
  upcoming: HostReservation[];
  past: HostReservation[];
  actionLoading: string | null;
  onAction: (id: string, action: "confirm" | "reject") => void;
}) {
  if (pending.length === 0 && upcoming.length === 0 && past.length === 0) {
    return (
      <div className="empty-state py-16">
        <div className="text-5xl">📋</div>
        <h2 className="text-h1 text-[var(--text-primary)]">Sin reservas aún</h2>
        <p className="text-body text-[var(--text-secondary)]">
          Las solicitudes de tus huéspedes aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <h2 className="text-h3 font-semibold text-[var(--text-primary)] mb-3">
            Solicitudes pendientes ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((r) => (
              <ReservationRow
                key={r.id}
                reservation={r}
                showActions
                actionLoading={actionLoading}
                onAction={onAction}
              />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-h3 font-semibold text-[var(--text-primary)] mb-3">
            Próximas estancias ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map((r) => <ReservationRow key={r.id} reservation={r} actionLoading={null} onAction={onAction} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-h3 font-semibold text-[var(--text-primary)] mb-3">
            Historial
          </h2>
          <div className="space-y-3">
            {past.map((r) => <ReservationRow key={r.id} reservation={r} actionLoading={null} onAction={onAction} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function ReservationRow({
  reservation: r, showActions = false, actionLoading, onAction,
}: {
  reservation: HostReservation;
  showActions?: boolean;
  actionLoading: string | null;
  onAction: (id: string, action: "confirm" | "reject") => void;
}) {
  const photo = r.reservation_property.photos?.find((p) => p.is_primary) ?? r.reservation_property.photos?.[0];
  const statusInfo = RESERVATION_STATUS[r.status] ?? { label: r.status, color: "badge-neutral", icon: null };
  const isLoading = actionLoading === r.id;

  return (
    <div className="card p-4">
      <div className="flex gap-4">
        {/* Foto */}
        <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--color-primary-light)]">
          {photo?.url && (
            <Image src={photo.url} alt={r.reservation_property.title} fill className="object-cover" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-body font-medium text-[var(--text-primary)] line-clamp-1">
              {r.reservation_property.title}
            </p>
            <span className={cn("badge flex-shrink-0 flex items-center gap-1", statusInfo.color)}>
              {statusInfo.icon}
              {statusInfo.label}
            </span>
          </div>

          <p className="text-body-sm text-[var(--text-secondary)] mt-0.5">
            Huésped: <span className="font-medium text-[var(--text-primary)]">{r.guest.full_name}</span>
          </p>

          <div className="mt-1 text-body-sm text-[var(--text-secondary)]">
            <span className="flex items-center gap-1 flex-wrap">
              <Calendar size={12} className="flex-shrink-0" />
              {format(parseISO(r.check_in), "d MMM", { locale: es })} →{" "}
              {format(parseISO(r.check_out), "d MMM yyyy", { locale: es })}
              <span className="text-[var(--border-default)]">·</span>
              {r.nights} {r.nights === 1 ? "noche" : "noches"}
              <span className="text-[var(--border-default)]">·</span>
              {r.guests_count} {r.guests_count === 1 ? "huésped" : "huéspedes"}
            </span>
          </div>

          <p className="text-body-sm font-semibold text-[var(--text-primary)] mt-1">
            {<Price amount={r.total_amount} />}
          </p>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-3 mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={() => onAction(r.id, "confirm")}
            disabled={isLoading}
            className="btn btn-primary flex-1"
          >
            {isLoading ? "Procesando…" : "Aceptar reserva"}
          </button>
          <button
            onClick={() => onAction(r.id, "reject")}
            disabled={isLoading}
            className="btn btn-outline flex-1 text-red-600 border-red-200 hover:bg-red-50"
          >
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

function PropertiesTab({ properties, onDelete }: { properties: Property[]; onDelete: (id: string) => Promise<void> }) {
  const [confirmDel, setConfirmDel] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await onDelete(confirmDel.id);
      setConfirmDel(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  if (properties.length === 0) {
    return (
      <div className="empty-state py-16">
        <div className="text-5xl">🏡</div>
        <h2 className="text-h1 text-[var(--text-primary)]">Sin propiedades aún</h2>
        <p className="text-body text-[var(--text-secondary)]">
          Publica tu primer hospedaje para empezar a recibir huéspedes
        </p>
        <Link href="/p/nueva" className="btn btn-primary mt-2">
          <Plus size={16} className="mr-1" />
          Agregar propiedad
        </Link>
      </div>
    );
  }

  const STATUS_PROP: Record<string, { label: string; color: string }> = {
    active:         { label: "Activa",           color: "badge-verified" },
    inactive:       { label: "Inactiva",          color: "badge-neutral" },
    pending_review: { label: "En revisión",       color: "badge-accent" },
    suspended:      { label: "Suspendida",        color: "text-red-600 bg-red-50" },
  };

  return (
    <>
    {confirmDel && (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => !deleting && setConfirmDel(null)}>
        <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">¿Eliminar propiedad?</h3>
          <p className="text-body-sm text-[var(--text-secondary)] mb-1 truncate">{confirmDel.title}</p>
          <p className="text-body-sm text-[var(--text-secondary)] mb-5">
            Esta acción la quitará de tu panel y de las búsquedas. No se puede deshacer.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setConfirmDel(null)} disabled={deleting} className="btn btn-outline">Cancelar</button>
            <button onClick={doDelete} disabled={deleting} className="btn bg-red-600 text-white hover:bg-red-700">
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="space-y-3">
      {properties.map((p) => {
        const photo = p.photos?.find((ph) => ph.is_primary) ?? p.photos?.[0];
        const statusInfo = STATUS_PROP[p.status] ?? { label: p.status, color: "badge-neutral" };
        return (
          <div key={p.id} className="card p-4 flex gap-4">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--color-primary-light)]">
              {photo?.url && (
                <Image src={photo.url} alt={p.title} fill className="object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-medium text-[var(--text-primary)] line-clamp-1">{p.title}</p>
                <span className={cn("badge flex-shrink-0", statusInfo.color)}>{statusInfo.label}</span>
              </div>
              <p className="text-body-sm text-[var(--text-secondary)] mt-0.5">
                {p.city} · {p.bedrooms} {p.bedrooms === 1 ? "habitación" : "habitaciones"} · hasta {p.max_guests} huéspedes
              </p>

              {p.status === "pending_review" && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-[var(--color-accent-light,#fef3c7)] px-3 py-2">
                  <Clock size={14} className="text-[var(--color-accent,#d97706)] mt-0.5 flex-shrink-0" />
                  <p className="text-caption text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">En revisión.</span>{" "}
                    El equipo de Beel está verificando tu propiedad. Se publicará en cuanto se apruebe (normalmente en menos de 24 h).
                  </p>
                </div>
              )}
              {p.status === "suspended" && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2">
                  <XCircle size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-caption text-[var(--text-secondary)]">
                    <span className="font-medium text-red-700">No aprobada.</span>{" "}
                    Esta propiedad no cumplió la revisión. Edítala y contáctanos para que la volvamos a revisar.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-body-sm font-semibold text-[var(--text-primary)]">
                    <Price amount={p.price_per_night} />/noche
                  </span>
                  {p.avg_rating ? (
                    <span className="text-caption text-[var(--text-secondary)]">
                      ★ {formatRating(p.avg_rating)} ({p.total_reviews})
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/p/${p.id}/editar`} className="btn btn-ghost text-caption px-3 py-1">
                    Editar
                  </Link>
                  <button
                    onClick={() => setConfirmDel({ id: p.id, title: p.title })}
                    className="btn btn-ghost text-caption px-2 py-1 text-red-600 hover:bg-red-50"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                  <Link
                    href={p.status === "active" ? `/p/${p.id}` : `/p/${p.id}/editar`}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
