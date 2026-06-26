"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { useApi } from "@/hooks/useApi";
import { Star, Info } from "lucide-react";
import { formatRating, pluralNights } from "@/lib/utils";
import Price from "@/components/Price";
import DateRangePicker from "@/components/DateRangePicker";
import type { Property } from "@/types";

interface BookingWidgetProps {
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
}

export default function BookingWidget({
  property,
  initialCheckIn,
  initialCheckOut,
  initialGuests = 1,
}: BookingWidgetProps) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { get } = useApi();

  const [checkIn, setCheckIn] = useState(initialCheckIn ?? "");
  const [checkOut, setCheckOut] = useState(initialCheckOut ?? "");
  const [guests, setGuests] = useState(
    Math.min(initialGuests, property.max_guests)
  );
  const [loading, setLoading] = useState(false);
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);

  // Obtener disponibilidad para los próximos 12 meses
  useEffect(() => {
    let active = true;
    async function fetchAvailability() {
      try {
        const today = new Date();
        const startStr = format(today, "yyyy-MM-dd");
        const oneYearLater = new Date(today);
        oneYearLater.setFullYear(today.getFullYear() + 1);
        const endStr = format(oneYearLater, "yyyy-MM-dd");

        const res = await get<{ days: { date: string; is_available: boolean }[] }>(
          `/reservations/availability/${property.id}?start=${startStr}&end=${endStr}`
        );

        if (!active) return;

        const blocked = res.days
          .filter((d) => !d.is_available)
          .map((d) => parseISO(d.date));

        setDisabledDates(blocked);
      } catch (err) {
        console.error("Error al obtener disponibilidad:", err);
      }
    }

    if (property.id) {
      fetchAvailability();
    }
    return () => {
      active = false;
    };
  }, [property.id, get]);

  // Cálculo de noches y precios
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    try {
      return Math.max(
        0,
        differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
      );
    } catch {
      return 0;
    }
  }, [checkIn, checkOut]);

  // La API serializa los Decimal como strings; coaccionar a número o
  // el "+" concatena (ej. 2 + "0.00" = "20.00").
  const subtotal = nights * Number(property.price_per_night);
  const cleaningFee = Number(property.cleaning_fee ?? 0);
  const total = subtotal + cleaningFee;

  async function handleReserve() {
    if (!checkIn || !checkOut || nights < property.min_stay_nights) return;

    const params = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      huespedes: String(guests),
    });
    const dest = `/p/${property.id}/reservar?${params}`;

    // Solo redirigir a login si YA cargó la sesión y no hay usuario
    // (en móvil isSignedIn arranca false mientras carga → evita el bucle).
    if (isLoaded && !isSignedIn) {
      router.push(`/iniciar-sesion?redirect_url=${encodeURIComponent(dest)}`);
      return;
    }
    router.push(dest);
  }

  const canReserve =
    checkIn && checkOut && nights >= property.min_stay_nights && nights > 0;

  return (
    <div className="card p-5 shadow-lg">
      {/* Precio por noche */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <span className="text-h1 font-semibold text-[var(--text-primary)]">
            {<Price amount={property.price_per_night} />}
          </span>
          <span className="text-body-sm text-[var(--text-secondary)]"> / noche</span>
        </div>
        {property.avg_rating && (
          <div className="flex items-center gap-1 text-caption text-[var(--text-secondary)]">
            <Star size={12} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
            <span className="font-medium text-[var(--text-primary)]">
              {formatRating(property.avg_rating)}
            </span>
            <span>({property.total_reviews})</span>
          </div>
        )}
      </div>

      {/* Fechas — calendario estilo Airbnb */}
      <div className="border border-[var(--border-default)] rounded-xl mb-3 flex">
        <DateRangePicker
          checkIn={checkIn}
          checkOut={checkOut}
          onCheckIn={setCheckIn}
          onCheckOut={setCheckOut}
          disabledDates={disabledDates}
        />
      </div>

      {/* Huéspedes */}
      <div className="border border-[var(--border-default)] rounded-xl mb-3">
        <div className="p-3 flex items-center justify-between">
          <div>
            <label className="block text-[9px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-0.5">
              Huéspedes
            </label>
            <span className="text-body-sm text-[var(--text-secondary)]">
              {guests} {guests === 1 ? "huésped" : "huéspedes"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGuests(Math.max(1, guests - 1))}
              className="w-7 h-7 rounded-full border border-[var(--border-default)] flex items-center justify-center text-sm hover:border-[var(--border-strong)] transition-colors"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setGuests(Math.min(property.max_guests, guests + 1))}
              className="w-7 h-7 rounded-full border border-[var(--border-default)] flex items-center justify-center text-sm hover:border-[var(--border-strong)] transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Mínimo de noches */}
      {property.min_stay_nights > 1 && nights > 0 && nights < property.min_stay_nights && (
        <div className="flex items-start gap-2 text-caption text-[var(--color-error)] mb-3">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          <span>Estancia mínima: {pluralNights(property.min_stay_nights)}</span>
        </div>
      )}

      {/* Botón reservar */}
      <button
        type="button"
        onClick={handleReserve}
        disabled={!canReserve || loading}
        className="btn btn-primary w-full justify-center py-3 text-body disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "Procesando..."
          : !checkIn || !checkOut
          ? "Selecciona tus fechas"
          : nights < property.min_stay_nights
          ? `Mínimo ${pluralNights(property.min_stay_nights)}`
          : property.instant_booking
          ? "Reservar ahora"
          : "Solicitar reserva"}
      </button>

      {!property.instant_booking && (
        <p className="text-caption text-center text-[var(--text-tertiary)] mt-2">
          El anfitrión tiene 24 h para confirmar
        </p>
      )}

      {/* Desglose de precio */}
      {nights > 0 && (
        <div className="mt-4 space-y-0">
          <div className="price-row">
            <span>
              {<Price amount={property.price_per_night} />} × {pluralNights(nights)}
            </span>
            <span>{<Price amount={subtotal} />}</span>
          </div>
          {cleaningFee > 0 && (
            <div className="price-row">
              <span>Limpieza</span>
              <span>{<Price amount={cleaningFee} />}</span>
            </div>
          )}
          <div className="price-row total">
            <span>Total</span>
            <span>{<Price amount={total} />}</span>
          </div>
        </div>
      )}
    </div>
  );
}
