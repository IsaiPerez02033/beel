"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import Price from "@/components/Price";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, MapPin, ArrowLeft } from "lucide-react";

interface ReservationDetail {
  id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total_price: number;
  currency: string;
  status: string;
  guest_message?: string;
  created_at: string;
  reservation_property: {
    id: string;
    title: string;
    city: string;
    neighborhood?: string;
    photos: { url: string; is_primary: boolean }[];
  };
  host: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  guest: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "badge-accent" },
  confirmed: { label: "Confirmada", className: "badge-verified" },
  rejected: { label: "Rechazada", className: "text-red-500 bg-red-50" },
  cancelled_guest: { label: "Cancelada", className: "badge-neutral" },
  cancelled_host: { label: "Cancelada por anfitrión", className: "badge-neutral" },
  completed: { label: "Completada", className: "badge-neutral" },
};

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { get } = useApi();
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/iniciar-sesion");
      return;
    }
    get<ReservationDetail>(`/reservations/${id}`)
      .then(setReservation)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded, id, get, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="skeleton h-8 w-48 mb-4" />
          <div className="skeleton h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <div className="empty-state max-w-md mx-auto mt-20 text-center px-4">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-heading text-[var(--text-primary)]">Reserva no encontrada</h2>
          <Link href="/reservaciones" className="btn btn-primary mt-4">
            Ver mis viajes
          </Link>
        </div>
      </div>
    );
  }

  const st = STATUS[reservation.status] ?? { label: reservation.status, className: "badge-neutral" };
  const primaryPhoto = reservation.reservation_property.photos.find((p) => p.is_primary) ?? reservation.reservation_property.photos[0];

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/reservaciones" className="flex items-center gap-2 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6">
          <ArrowLeft size={16} />
          Mis viajes
        </Link>

        <div className="card overflow-hidden">
          {primaryPhoto && (
            <div className="relative w-full h-56">
              <Image src={primaryPhoto.url} alt={reservation.reservation_property.title} fill className="object-cover" />
            </div>
          )}

          <div className="p-6">
            <div className="flex items-center justify-between mb-1">
              <span className={`badge ${st.className}`}>{st.label}</span>
            </div>

            <h1 className="text-heading font-display text-[var(--text-primary)] mt-2">
              {reservation.reservation_property.title}
            </h1>

            <div className="flex items-center gap-1 mt-1 text-body-sm text-[var(--text-secondary)]">
              <MapPin size={14} />
              {reservation.reservation_property.neighborhood && `${reservation.reservation_property.neighborhood}, `}
              {reservation.reservation_property.city}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-caption text-[var(--text-tertiary)]">Check-in</p>
                <p className="text-body font-medium text-[var(--text-primary)]">
                  {format(parseISO(reservation.check_in), "d 'de' MMM, yyyy", { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-caption text-[var(--text-tertiary)]">Check-out</p>
                <p className="text-body font-medium text-[var(--text-primary)]">
                  {format(parseISO(reservation.check_out), "d 'de' MMM, yyyy", { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-caption text-[var(--text-tertiary)]">Noches</p>
                <p className="text-body text-[var(--text-primary)]">{reservation.nights}</p>
              </div>
              <div>
                <p className="text-caption text-[var(--text-tertiary)]">Huéspedes</p>
                <p className="text-body text-[var(--text-primary)]">{reservation.guests}</p>
              </div>
            </div>

            <div className="divider my-6" />

            <div className="flex items-center justify-between">
              <p className="text-body text-[var(--text-secondary)]">Total pagado</p>
              <p className="text-heading font-semibold text-[var(--text-primary)]">
                {<Price amount={reservation.total_price} />}
              </p>
            </div>
          </div>
        </div>

        {reservation.status === "confirmed" && (
          <div className="mt-4">
            <Link
              href={`/mensajes?conv=${reservation.id}`}
              className="btn btn-outline w-full text-center"
            >
              Contactar al{" "}
              {reservation.host?.full_name ?? "anfitrión"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
