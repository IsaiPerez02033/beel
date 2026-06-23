"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import BecomeHostModal from "@/components/BecomeHostModal";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Home, Calendar, DollarSign, Star, Plus, ChevronRight,
  Clock, CheckCircle, XCircle, AlertCircle, Settings,
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
  const { get, post } = useApi();

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
      const [resData, propData] = await Promise.all([
        get<{ reservations: HostReservation[] }>("/reservations/host"),
        get<{ properties: Property[] }>("/properties/my-listings"),
      ]);
      setReservations(resData.reservations);
      setProperties(propData.properties);

      // Calcular stats localmente
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const confirmedThisMonth = resData.reservations.filter(
        (r) => r.status === "confirmed" && r.check_in.startsWith(thisMonth)
      );
      const activeProps = propData.properties.filter((p) => p.status === "active");
      const ratings = propData.properties.filter((p) => p.avg_rating).map((p) => p.avg_rating!);

      setStats({
        total_listings: propData.properties.length,
        active_listings: activeProps.length,
        pending_reservations: resData.reservations.filter((r) => r.status === "pending").length,
        confirmed_this_month: confirmedThisMonth.length,
        earnings_this_month: confirmedThisMonth.reduce((s, r) => s + r.total_amount, 0),
        avg_rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
        total_reviews: propData.properties.reduce((s, p) => s + p.total_reviews, 0),
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
      await post(`/reservations/${id}/${action === "confirm" ? "confirm" : "reject"}`, {});
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
            <button onClick={() => setShowHostModal(true)} className="btn btn-primary w-full">
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-display font-display font-medium text-[var(--text-primary)]">
              Panel del anfitrión
            </h1>
            <p className="text-body text-[var(--text-secondary)] mt-1">
              Gestiona tus propiedades y reservas
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/anfitrion/configuracion" className="btn btn-outline flex items-center gap-2">
              <Settings size={16} />
              Configuración
            </Link>
            <Link href="/p/nueva" className="btn btn-primary flex items-center gap-2">
              <Plus size={16} />
              Nueva propiedad
            </Link>
          </div>
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
              value={formatPrice(stats.earnings_this_month)}
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
          <PropertiesTab properties={properties} />
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
  value: string | number;
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

          <div className="flex items-center gap-3 mt-1 text-body-sm text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {format(parseISO(r.check_in), "d MMM", { locale: es })} →{" "}
              {format(parseISO(r.check_out), "d MMM yyyy", { locale: es })}
            </span>
            <span>· {r.nights} {r.nights === 1 ? "noche" : "noches"}</span>
            <span>· {r.guests_count} {r.guests_count === 1 ? "huésped" : "huéspedes"}</span>
          </div>

          <p className="text-body-sm font-semibold text-[var(--text-primary)] mt-1">
            {formatPrice(r.total_amount)}
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

function PropertiesTab({ properties }: { properties: Property[] }) {
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
              <div className="flex items-center justify-between mt-2">
                <span className="text-body-sm font-semibold text-[var(--text-primary)]">
                  {formatPrice(p.price_per_night)}/noche
                </span>
                <div className="flex items-center gap-2">
                  {p.avg_rating ? (
                    <span className="text-caption text-[var(--text-secondary)]">
                      ★ {p.avg_rating.toFixed(1)} ({p.total_reviews})
                    </span>
                  ) : null}
                  <Link
                    href={`/p/${p.id}/editar`}
                    className="btn btn-ghost text-caption px-3 py-1"
                  >
                    Editar
                  </Link>
                  <Link
                    href={`/p/${p.id}`}
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
  );
}
