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
import { Calendar, MapPin, ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface ReservationDetail {
  id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests_count: number;
  total_amount: number;
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
  const { get, post } = useApi();
  const [reservation, setReservation] = useState<ReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalNotification, setModalNotification] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const handleCancel = () => {
    setShowConfirmModal(true);
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await post(`/reservations/${id}/cancel`, { reason: "Cancelado por el huésped" });
      const updated = await get<ReservationDetail>(`/reservations/${id}`);
      setReservation(updated);
      setModalNotification({
        type: "success",
        title: "Cancelación exitosa",
        message: "Tu reservación ha sido cancelada exitosamente."
      });
    } catch (err: any) {
      setModalNotification({
        type: "error",
        title: "Error al cancelar",
        message: err.message || "Ocurrió un error al intentar cancelar la reservación."
      });
    } finally {
      setCancelling(false);
      setShowConfirmModal(false);
    }
  };

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
                <p className="text-body text-[var(--text-primary)]">{reservation.guests_count}</p>
              </div>
            </div>

            <div className="divider my-6" />

            <div className="flex items-center justify-between">
              <p className="text-body text-[var(--text-secondary)]">Total pagado</p>
              <p className="text-heading font-semibold text-[var(--text-primary)]">
                {<Price amount={reservation.total_amount} />}
              </p>
            </div>
          </div>
        </div>

        {(reservation.status === "pending" || reservation.status === "confirmed") && (
          <div className="mt-4 space-y-2">
            {reservation.status === "confirmed" && (
              <Link
                href={`/mensajes?conv=${reservation.id}`}
                className="btn btn-outline w-full justify-center"
              >
                Contactar al{" "}
                {reservation.host?.full_name ?? "anfitrión"}
              </Link>
            )}
            
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="btn !border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error-light)] w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {cancelling ? "Cancelando..." : "Cancelar reservación"}
            </button>
          </div>
        )}
      </div>

      {showConfirmModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" 
          onClick={() => setShowConfirmModal(false)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-error-light)] flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="text-[var(--color-error)]" />
              </div>
              <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-2 font-display">
                ¿Cancelar reservación?
              </h3>
              <p className="text-body-sm text-[var(--text-secondary)] mb-6">
                ¿Estás seguro de que deseas cancelar esta reservación? Esta acción no se puede deshacer.
              </p>
            </div>
            
            <div className="flex gap-3 justify-center w-full">
              <button 
                onClick={() => setShowConfirmModal(false)} 
                disabled={cancelling}
                className="btn btn-ghost flex-1 justify-center"
              >
                No, mantener
              </button>
              <button 
                onClick={confirmCancel} 
                disabled={cancelling} 
                className="btn bg-[var(--color-error)] text-white hover:bg-red-600 border-none flex-1 justify-center disabled:opacity-50"
              >
                {cancelling ? "Cancelando..." : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalNotification && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" 
          onClick={() => setModalNotification(null)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                modalNotification.type === "success" 
                  ? "bg-[var(--color-success-light)]" 
                  : "bg-[var(--color-error-light)]"
              }`}>
                {modalNotification.type === "success" ? (
                  <CheckCircle2 size={24} className="text-[var(--color-success)]" />
                ) : (
                  <XCircle size={24} className="text-[var(--color-error)]" />
                )}
              </div>
              <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-2 font-display">
                {modalNotification.title}
              </h3>
              <p className="text-body-sm text-[var(--text-secondary)] mb-6">
                {modalNotification.message}
              </p>
            </div>
            
            <div className="flex justify-center w-full">
              <button 
                onClick={() => setModalNotification(null)} 
                className={`btn w-full justify-center ${
                  modalNotification.type === "success"
                    ? "btn-primary"
                    : "bg-[var(--color-error)] text-white hover:bg-red-600 border-none"
                }`}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
