"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, ChevronLeft, ChevronRight, CalendarDays, Users, Ticket } from "lucide-react";
import Navbar from "@/components/Navbar";
import Price from "@/components/Price";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useSafeAuth";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { ExperienceBooking } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente", confirmed: "Confirmada", rejected: "Rechazada",
  cancelled_guest: "Cancelada", cancelled_host: "Cancelada", completed: "Completada",
};

export default function ExperienceBookingsPage() {
  const router = useRouter();
  const { get } = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [tab, setTab] = useState<"guest" | "host">("guest");
  const [bookings, setBookings] = useState<ExperienceBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (which: "guest" | "host") => {
    setLoading(true);
    const path = which === "guest" ? "/experiences/bookings/mine" : "/experiences/bookings/host";
    try {
      const d = await get<{ bookings: ExperienceBooking[] }>(`${path}?per_page=50`);
      setBookings(d.bookings ?? []);
    } catch { setBookings([]); }
    finally { setLoading(false); }
  }, [get]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) { router.replace("/iniciar-sesion?callbackUrl=/experiencias/reservas"); return; }
    if (isSignedIn) load(tab);
  }, [isLoaded, isSignedIn, tab, load, router]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/experiencias" className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4">
          <ChevronLeft size={16} /> Experiencias
        </Link>
        <h1 className="text-display font-display font-semibold text-[var(--text-primary)] mb-4">Reservas de experiencias</h1>

        <div className="flex gap-2 mb-6">
          {(["guest", "host"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-body-sm font-medium transition-colors ${
                tab === t ? "bg-[var(--color-primary)] text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
              }`}
            >
              {t === "guest" ? "Como huésped" : "Como anfitrión"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-[var(--color-primary)]" size={30} /></div>
        ) : bookings.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-3">
              <Ticket size={24} className="text-[var(--color-primary)]" />
            </div>
            <p className="text-body font-semibold text-[var(--text-primary)] mb-1">Sin reservas todavía</p>
            <p className="text-body-sm text-[var(--text-secondary)]">
              {tab === "guest" ? "Explora experiencias y reserva la primera." : "Cuando reserven tus experiencias, aparecerán aquí."}
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-[var(--border-subtle)] overflow-hidden">
            {bookings.map((b) => {
              const exp = b.experience;
              const photo = exp?.photos?.find((p) => p.is_primary) ?? exp?.photos?.[0];
              const other = tab === "guest" ? b.host?.full_name : b.guest?.full_name;
              return (
                <Link key={b.id} href={`/experiencias/reservas/${b.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-[var(--bg-subtle)] transition-colors">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-subtle)]">
                    {photo?.url && <Image src={photo.url} alt={exp?.title ?? ""} fill className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-semibold text-[var(--text-primary)] truncate">{exp?.title}</p>
                    <p className="text-caption text-[var(--text-tertiary)] flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1"><CalendarDays size={12} /> {format(parseISO(b.booking_date), "d MMM yyyy", { locale: es })}</span>
                      <span className="flex items-center gap-1"><Users size={12} /> {b.participants}</span>
                    </p>
                    {other && <p className="text-caption text-[var(--text-tertiary)] truncate">{tab === "guest" ? "Anfitrión" : "Huésped"}: {other}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-body-sm font-semibold text-[var(--text-primary)]">
                      <Price amount={tab === "host" ? b.host_net_payout : b.total_amount} />
                    </p>
                    <p className="text-caption text-[var(--text-tertiary)]">{STATUS_LABEL[b.status] ?? b.status}</p>
                  </div>
                  <ChevronRight size={16} className="text-[var(--text-tertiary)] flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
