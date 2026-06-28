"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import Price from "@/components/Price";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, MapPin, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reservation {
  id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests_count: number;
  total_amount: number;
  currency: string;
  status: string;
  reservation_property: {
    id: string;
    title: string;
    city: string;
    neighborhood?: string;
    photos: { url: string; is_primary: boolean }[];
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:          { label: "Pendiente", color: "badge-accent" },
  confirmed:        { label: "Confirmada", color: "badge-verified" },
  rejected:         { label: "Rechazada", color: "text-red-500 bg-red-50" },
  cancelled_guest:  { label: "Cancelada", color: "badge-neutral" },
  cancelled_host:   { label: "Cancelada por anfitrión", color: "badge-neutral" },
  completed:        { label: "Completada", color: "badge-neutral" },
};

type Tab = "upcoming" | "past" | "cancelled";

export default function ReservacionesPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { get } = useApi();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/iniciar-sesion");
      return;
    }
    setLoading(true);
    get<{ reservations: Reservation[] }>("/reservations/my-trips")
      .then((d) => setReservations(d.reservations))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isSignedIn, get]);

  const filtered = reservations.filter((r) => {
    if (tab === "upcoming") return ["pending", "confirmed"].includes(r.status);
    if (tab === "past") return r.status === "completed";
    return ["cancelled_guest", "cancelled_host", "rejected"].includes(r.status);
  });

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-6">
          Mis viajes
        </h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border-subtle)]">
          {(["upcoming", "past", "cancelled"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-body-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {t === "upcoming" ? "Próximos" : t === "past" ? "Pasados" : "Cancelados"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card flex gap-4 p-4 animate-pulse">
                <div className="skeleton w-24 h-24 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state py-16">
            <div className="text-5xl">✈️</div>
            <h2 className="text-h1 text-[var(--text-primary)]">
              {tab === "upcoming" ? "Sin viajes próximos" : "Sin viajes aquí"}
            </h2>
            {tab === "upcoming" && (
              <Link href="/buscar" className="btn btn-primary mt-2">
                Explorar hospedajes
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => (
              <ReservationCard key={r.id} reservation={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ReservationCard({ reservation: r }: { reservation: Reservation }) {
  const photo = r.reservation_property.photos?.find((p) => p.is_primary) ?? r.reservation_property.photos?.[0];
  const statusInfo = STATUS_LABELS[r.status] ?? { label: r.status, color: "badge-neutral" };

  const checkIn = parseISO(r.check_in);
  const checkOut = parseISO(r.check_out);

  return (
    <Link href={`/reservaciones/${r.id}`} className="card flex flex-col sm:flex-row gap-4 p-4 hover:shadow-md transition-shadow">
      {/* Foto */}
      <div className="relative w-full h-48 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--color-primary-light)]">
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
          <span className={cn("badge flex-shrink-0 text-xs", statusInfo.color)}>
            {statusInfo.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-1 text-body-sm text-[var(--text-secondary)]">
          <MapPin size={12} />
          <span>{r.reservation_property.neighborhood ?? r.reservation_property.city}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-1 text-body-sm text-[var(--text-secondary)]">
          <Calendar size={12} />
          <span>
            {format(checkIn, "d MMM", { locale: es })} →{" "}
            {format(checkOut, "d MMM yyyy", { locale: es })}
          </span>
          <span className="text-[var(--text-tertiary)]">·</span>
          <span>{r.nights} {r.nights === 1 ? "noche" : "noches"}</span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-body-sm font-semibold text-[var(--text-primary)]">
            {<Price amount={r.total_amount} />}
          </span>
          <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
        </div>
      </div>
    </Link>
  );
}
